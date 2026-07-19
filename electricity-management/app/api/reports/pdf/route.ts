import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PDFDocument from "pdfkit";

function fmt(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function inr(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildBuckets(
  paidBills: { billDate: Date; totalAmount: number }[],
  start: Date,
  end: Date
): { label: string; revenue: number }[] {
  const diffDays = (end.getTime() - start.getTime()) / 86400000;

  // ≤14 days → daily
  if (diffDays <= 14) {
    const result: { label: string; revenue: number }[] = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      const next = new Date(cursor);
      next.setDate(cursor.getDate() + 1);
      result.push({
        label: cursor.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }),
        revenue: paidBills.filter(b => b.billDate >= cursor && b.billDate < next).reduce((s, b) => s + Number(b.totalAmount), 0),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  // ≤90 days → weekly
  if (diffDays <= 90) {
    const result: { label: string; revenue: number }[] = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      const wEnd = new Date(cursor);
      wEnd.setDate(cursor.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);
      const actualEnd = wEnd > end ? new Date(end) : wEnd;
      result.push({
        label: `${cursor.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${actualEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
        revenue: paidBills.filter(b => b.billDate >= cursor && b.billDate <= actualEnd).reduce((s, b) => s + Number(b.totalAmount), 0),
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return result;
  }

  // >90 days → monthly
  const result: { label: string; revenue: number }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
    const actualEnd = mEnd > end ? new Date(end) : mEnd;
    result.push({
      label: cursor.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      revenue: paidBills.filter(b => b.billDate >= cursor && b.billDate <= actualEnd).reduce((s, b) => s + Number(b.totalAmount), 0),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startParam = req.nextUrl.searchParams.get("start");
  const endParam = req.nextUrl.searchParams.get("end");

  let start: Date;
  let end: Date;
  let label: string;

  if (startParam && endParam) {
    start = new Date(startParam + "T00:00:00");
    end = new Date(endParam + "T23:59:59");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    label = `${fmt(start)} to ${fmt(end)}`;
  } else {
    // fallback: monthly
    start = new Date(now);
    start.setDate(now.getDate() - 30);
    end = now;
    label = "Last 30 Days";
  }

  const bills = await prisma.bill.findMany({
    where: { billDate: { gte: start, lte: end } },
    select: {
      billNumber: true,
      billDate: true,
      totalAmount: true,
      status: true,
      connection: {
        select: {
          flatNo: true,
          tower: true,
          resident: {
            select: {
              user: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { billDate: "desc" },
  });

  const paid = bills.filter(b => b.status === "PAID");
  const totalRevenue = paid.reduce((s, b) => s + Number(b.totalAmount), 0);
  const overdueCount = bills.filter(b => b.status === "OVERDUE").length;
  const buckets = buildBuckets(paid.map(b => ({ ...b, totalAmount: Number(b.totalAmount) })), start, end);

  const doc = new PDFDocument({ margin: 0, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));

  await new Promise<void>((resolve, reject) => {
    doc.on("end", resolve);
    doc.on("error", reject);

    try {
      const PW = 595, L = 40, CW = 515;

      // ── Header ──
      doc.rect(0, 0, PW, 100).fill("#1e3a5f");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(14)
        .text("OASIS BUILDMART INDIA PVT. LTD.", L, 16, { width: CW, align: "center" });
      doc.fillColor("#93b8d4").font("Helvetica").fontSize(8)
        .text("Oasis Venetia Heights, Plot No-HRA 12A, Site-C, Greater Noida – 201306 (UP)  |  Phone: 8130334857", L, 34, { width: CW, align: "center" });
      doc.rect(PW / 2 - 85, 48, 170, 22).fill("#2563eb");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10)
        .text("FINANCIAL REPORT", L, 53, { width: CW, align: "center" });
      doc.fillColor("#d1e6f5").font("Helvetica").fontSize(8.5)
        .text(label, L, 76, { width: CW, align: "center" });

      let y = 112;

      doc.fillColor("#6b7280").font("Helvetica").fontSize(8)
        .text(`Generated: ${fmt(now)}`, L, y, { width: CW / 2 });
      doc.text(`Period: ${fmt(start)}  –  ${fmt(end)}`, L + CW / 2, y, { width: CW / 2, align: "right" });

      y += 18;
      doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.6).stroke();
      y += 12;

      // ── Summary boxes ──
      doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(9).text("SUMMARY", L, y);
      y += 14;

      const W4 = (CW - 12) / 4;
      const sBoxes = [
        { lbl: "TOTAL REVENUE", val: `Rs. ${inr(totalRevenue)}`, color: "#16a34a", big: true },
        { lbl: "BILLS GENERATED", val: String(bills.length), color: "#2563eb", big: false },
        { lbl: "PAID BILLS", val: String(paid.length), color: "#059669", big: false },
        { lbl: "OVERDUE BILLS", val: String(overdueCount), color: "#dc2626", big: false },
      ];
      sBoxes.forEach((s, i) => {
        const bx = L + i * (W4 + 4);
        doc.rect(bx, y, W4, 52).fill("#f8fafc");
        doc.rect(bx, y, W4, 52).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
        doc.fillColor("#6b7280").font("Helvetica").fontSize(6.5)
          .text(s.lbl, bx + 6, y + 8, { width: W4 - 12, lineBreak: false });
        doc.fillColor(s.color).font("Helvetica-Bold").fontSize(s.big ? 11 : 18)
          .text(s.val, bx + 6, y + 22, { width: W4 - 12, lineBreak: false });
      });
      y += 66;

      doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      y += 12;

      // ── Revenue Breakdown ──
      doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(9).text("REVENUE BREAKDOWN", L, y);
      y += 14;

      doc.rect(L, y, CW, 18).fill("#1e3a5f");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8)
        .text("Period", L + 8, y + 5, { width: 300, lineBreak: false });
      doc.text("Revenue (Rs.)", L + 308, y + 5, { width: CW - 316, align: "right", lineBreak: false });
      y += 18;

      buckets.forEach((b, i) => {
        if (y > 780) { doc.addPage(); y = 40; }
        if (i % 2 === 0) doc.rect(L, y, CW, 17).fill("#f9fafb");
        doc.fillColor("#374151").font("Helvetica").fontSize(8)
          .text(b.label, L + 8, y + 4, { width: 300, lineBreak: false });
        doc.font("Helvetica-Bold")
          .text(inr(b.revenue), L + 308, y + 4, { width: CW - 316, align: "right", lineBreak: false });
        y += 17;
      });

      doc.rect(L, y, CW, 20).fill("#dbeafe");
      doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(9)
        .text("TOTAL", L + 8, y + 5, { width: 300, lineBreak: false });
      doc.text(`Rs. ${inr(totalRevenue)}`, L + 308, y + 5, { width: CW - 316, align: "right", lineBreak: false });
      y += 30;

      doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      y += 12;

      // ── Bill Details ──
      doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(9).text("BILL DETAILS", L, y);
      y += 14;

      const C = [L, L + 82, L + 162, L + 292, L + 378, L + 458];
      const colW = [77, 77, 127, 83, 76, 55];

      doc.rect(L, y, CW, 18).fill("#1e3a5f");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5);
      ["Bill #", "Flat No", "Resident", "Bill Date", "Amount (Rs.)", "Status"].forEach((h, i) => {
        const align = i === 4 ? "right" : "left";
        doc.text(h, C[i] + 4, y + 5, { width: colW[i], lineBreak: false, align });
      });
      y += 18;

      for (const b of bills) {
        if (y > 790) { doc.addPage(); y = 40; }
        const idx = bills.indexOf(b);
        if (idx % 2 === 0) doc.rect(L, y, CW, 15).fill("#f9fafb");
        const sc = b.status === "PAID" ? "#16a34a" : b.status === "OVERDUE" ? "#dc2626" : "#d97706";
        doc.fillColor("#374151").font("Helvetica").fontSize(7);
        doc.text(b.billNumber, C[0] + 4, y + 3, { width: colW[0], lineBreak: false });
        doc.text(b.connection.flatNo, C[1] + 4, y + 3, { width: colW[1], lineBreak: false });
        doc.text(b.connection.resident.user.name.slice(0, 20), C[2] + 4, y + 3, { width: colW[2], lineBreak: false });
        doc.text(fmt(b.billDate), C[3] + 4, y + 3, { width: colW[3], lineBreak: false });
        doc.font("Helvetica-Bold")
          .text(inr(Number(b.totalAmount)), C[4] + 4, y + 3, { width: colW[4], align: "right", lineBreak: false });
        doc.fillColor(sc)
          .text(b.status, C[5] + 4, y + 3, { width: colW[5], lineBreak: false });
        y += 15;
      }

      if (bills.length === 0) {
        doc.fillColor("#9ca3af").font("Helvetica").fontSize(9)
          .text("No bills found for this period.", L, y + 10, { width: CW, align: "center" });
      }

      // ── Footer ──
      const fY = doc.page.height - 28;
      doc.moveTo(L, fY - 6).lineTo(L + CW, fY - 6).strokeColor("#e5e7eb").lineWidth(0.4).stroke();
      doc.fillColor("#9ca3af").font("Helvetica").fontSize(7)
        .text("Oasis Buildmart India Pvt. Ltd.  •  Computer-generated report  •  Not a tax document", L, fY, { width: CW, align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

  const startStr = startParam ?? "start";
  const endStr = endParam ?? "end";
  const filename = `report-${startStr}-to-${endStr}.pdf`;
  const inline = req.nextUrl.searchParams.get("inline") === "true";

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
    },
  });
}
