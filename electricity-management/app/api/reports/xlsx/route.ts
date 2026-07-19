import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

function fmt(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function inr(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ARGB color palette (FF prefix = fully opaque)
const C = {
  NAVY:       "FF1e3a5f",
  BLUE:       "FF2563eb",
  LIGHT_BLUE: "FFdbeafe",
  GREEN:      "FF16a34a",
  TEAL:       "FF059669",
  RED:        "FFdc2626",
  AMBER:      "FFd97706",
  WHITE:      "FFFFFFFF",
  ADDR_BLUE:  "FF93b8d4",
  GRAY_TEXT:  "FF6b7280",
  DARK_TEXT:  "FF374151",
  ROW_ALT:    "FFf9fafb",
  BOX_BG:     "FFf8fafc",
  HDR_BG:     "FFf0f4f8",
};

type HAlign = "left" | "center" | "right";

function thinBorder(c: ExcelJS.Cell) {
  const s = { style: "thin" as const, color: { argb: "FFe2e8f0" } };
  c.border = { top: s, left: s, bottom: s, right: s };
}

function mergedRow(
  ws: ExcelJS.Worksheet,
  row: number,
  value: string,
  bg: string,
  fg: string,
  size: number,
  bold: boolean,
  height: number,
  align: HAlign = "center"
) {
  ws.mergeCells(`A${row}:H${row}`);
  ws.getRow(row).height = height;
  const c = ws.getCell(`A${row}`);
  c.value = value;
  c.font = { bold, size, color: { argb: fg }, name: "Calibri" };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  c.alignment = { horizontal: align, vertical: "middle" };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startParam = req.nextUrl.searchParams.get("start");
  const endParam = req.nextUrl.searchParams.get("end");

  let start: Date, end: Date, label: string;
  if (startParam && endParam) {
    start = new Date(startParam + "T00:00:00");
    end = new Date(endParam + "T23:59:59");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    label = `${fmt(start)} to ${fmt(end)}`;
  } else {
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
      dueDate: true,
      totalAmount: true,
      status: true,
      connection: {
        select: {
          flatNo: true,
          tower: true,
          resident: { select: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { billDate: "desc" },
  });

  const paid = bills.filter(b => b.status === "PAID");
  const totalRevenue = paid.reduce((s, b) => s + Number(b.totalAmount), 0);
  const overdueCount = bills.filter(b => b.status === "OVERDUE").length;

  // ── Build Workbook ──────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "Oasis Venetia Heights";
  wb.created = now;

  const ws = wb.addWorksheet("Bills Report", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 },
    views: [{ state: "frozen", ySplit: 11 }],
  });

  ws.columns = [
    { key: "a", width: 23 },
    { key: "b", width: 11 },
    { key: "c", width: 10 },
    { key: "d", width: 28 },
    { key: "e", width: 14 },
    { key: "f", width: 14 },
    { key: "g", width: 17 },
    { key: "h", width: 12 },
  ];

  // ── Header ──────────────────────────────────────────────────────────────────
  mergedRow(ws, 1, "OASIS BUILDMART INDIA PVT. LTD.", C.NAVY, C.WHITE, 14, true, 30);
  mergedRow(ws, 2,
    "Oasis Venetia Heights, Plot No-HRA 12A, Site-C, Greater Noida – 201306 (UP)  |  Phone: 8130334857",
    C.NAVY, C.ADDR_BLUE, 8.5, false, 16);
  mergedRow(ws, 3, "ELECTRICITY BILL REPORT", C.BLUE, C.WHITE, 11, true, 22);
  mergedRow(ws, 4, `Period: ${label}   |   Generated: ${fmt(now)}`, C.HDR_BG, C.GRAY_TEXT, 8.5, false, 15);

  // Blank separator
  ws.getRow(5).height = 6;

  // ── Summary heading ─────────────────────────────────────────────────────────
  ws.mergeCells("A6:H6");
  ws.getRow(6).height = 18;
  const sumHdr = ws.getCell("A6");
  sumHdr.value = "SUMMARY";
  sumHdr.font = { bold: true, size: 9, color: { argb: C.NAVY }, name: "Calibri" };
  sumHdr.alignment = { vertical: "middle", indent: 1 };

  // ── Summary boxes (A-B, C-D, E-F, G-H) ─────────────────────────────────────
  const boxes = [
    { cols: ["A", "B"] as const, label: "TOTAL REVENUE",    value: `Rs. ${inr(totalRevenue)}`, color: C.GREEN  },
    { cols: ["C", "D"] as const, label: "BILLS GENERATED",  value: String(bills.length),         color: C.BLUE   },
    { cols: ["E", "F"] as const, label: "PAID BILLS",       value: String(paid.length),           color: C.TEAL   },
    { cols: ["G", "H"] as const, label: "OVERDUE BILLS",    value: String(overdueCount),          color: C.RED    },
  ];

  ws.getRow(7).height = 13;
  ws.getRow(8).height = 30;

  for (const box of boxes) {
    const [c1, c2] = box.cols;
    ws.mergeCells(`${c1}7:${c2}7`);
    const lc = ws.getCell(`${c1}7`);
    lc.value = box.label;
    lc.font = { size: 6.5, color: { argb: C.GRAY_TEXT }, name: "Calibri" };
    lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.BOX_BG } };
    lc.alignment = { horizontal: "center", vertical: "bottom" };
    thinBorder(lc);

    ws.mergeCells(`${c1}8:${c2}8`);
    const vc = ws.getCell(`${c1}8`);
    vc.value = box.value;
    vc.font = { bold: true, size: box.label === "TOTAL REVENUE" ? 13 : 18, color: { argb: box.color }, name: "Calibri" };
    vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.BOX_BG } };
    vc.alignment = { horizontal: "center", vertical: "middle" };
    thinBorder(vc);
  }

  // Blank separator
  ws.getRow(9).height = 6;

  // ── Bill Details heading ────────────────────────────────────────────────────
  ws.mergeCells("A10:H10");
  ws.getRow(10).height = 18;
  const detHdr = ws.getCell("A10");
  detHdr.value = "BILL DETAILS";
  detHdr.font = { bold: true, size: 9, color: { argb: C.NAVY }, name: "Calibri" };
  detHdr.alignment = { vertical: "middle", indent: 1 };

  // ── Column headers (row 11) ──────────────────────────────────────────────────
  const colHeaders = ["Bill Number", "Flat No", "Tower", "Resident Name", "Bill Date", "Due Date", "Amount (Rs.)", "Status"];
  const colAligns: HAlign[] = ["left", "left", "left", "left", "left", "left", "right", "left"];

  ws.getRow(11).height = 20;
  colHeaders.forEach((h, i) => {
    const col = String.fromCharCode(65 + i);
    const hc = ws.getCell(`${col}11`);
    hc.value = h;
    hc.font = { bold: true, size: 8, color: { argb: C.WHITE }, name: "Calibri" };
    hc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.NAVY } };
    hc.alignment = { horizontal: colAligns[i], vertical: "middle", indent: colAligns[i] === "left" ? 1 : 0 };
    thinBorder(hc);
  });

  // ── Data rows ───────────────────────────────────────────────────────────────
  bills.forEach((b, idx) => {
    const rowNum = 12 + idx;
    const bg = idx % 2 === 1 ? C.ROW_ALT : C.WHITE;
    const statusColor = b.status === "PAID" ? C.GREEN : b.status === "OVERDUE" ? C.RED : C.AMBER;

    ws.getRow(rowNum).height = 15;

    const rowData: (string | number)[] = [
      b.billNumber,
      b.connection.flatNo,
      b.connection.tower,
      b.connection.resident.user.name,
      fmt(b.billDate),
      fmt(b.dueDate),
      Number(b.totalAmount),
      b.status,
    ];

    rowData.forEach((val, ci) => {
      const col = String.fromCharCode(65 + ci);
      const dc = ws.getCell(`${col}${rowNum}`);
      dc.value = val;
      dc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      dc.alignment = { horizontal: colAligns[ci], vertical: "middle", indent: colAligns[ci] === "left" ? 1 : 0 };
      thinBorder(dc);

      if (ci === 6) {
        dc.font = { bold: true, size: 8, color: { argb: C.DARK_TEXT }, name: "Calibri" };
        dc.numFmt = "#,##0.00";
      } else if (ci === 7) {
        dc.font = { bold: true, size: 7.5, color: { argb: statusColor }, name: "Calibri" };
      } else {
        dc.font = { size: 8, color: { argb: C.DARK_TEXT }, name: "Calibri" };
      }
    });
  });

  // Empty state
  if (bills.length === 0) {
    const rowNum = 12;
    ws.mergeCells(`A${rowNum}:H${rowNum}`);
    ws.getRow(rowNum).height = 24;
    const ec = ws.getCell(`A${rowNum}`);
    ec.value = "No bills found for this period.";
    ec.font = { size: 9, color: { argb: C.GRAY_TEXT }, name: "Calibri" };
    ec.alignment = { horizontal: "center", vertical: "middle" };
  }

  // ── Total row ───────────────────────────────────────────────────────────────
  const totalRow = 12 + Math.max(bills.length, 1);
  ws.getRow(totalRow).height = 20;
  for (let ci = 0; ci < 8; ci++) {
    const col = String.fromCharCode(65 + ci);
    const tc = ws.getCell(`${col}${totalRow}`);
    tc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.LIGHT_BLUE } };
    thinBorder(tc);
    if (ci === 0) {
      tc.value = "TOTAL";
      tc.font = { bold: true, size: 9, color: { argb: C.NAVY }, name: "Calibri" };
      tc.alignment = { vertical: "middle", indent: 1 };
    } else if (ci === 6) {
      tc.value = totalRevenue;
      tc.font = { bold: true, size: 9, color: { argb: C.NAVY }, name: "Calibri" };
      tc.alignment = { horizontal: "right", vertical: "middle" };
      tc.numFmt = "#,##0.00";
    }
  }

  // ── Footer note ─────────────────────────────────────────────────────────────
  const footerRow = totalRow + 2;
  ws.mergeCells(`A${footerRow}:H${footerRow}`);
  ws.getRow(footerRow).height = 14;
  const fc = ws.getCell(`A${footerRow}`);
  fc.value = "Oasis Buildmart India Pvt. Ltd.  •  Computer-generated report  •  Not a tax document";
  fc.font = { size: 7, color: { argb: C.GRAY_TEXT }, name: "Calibri" };
  fc.alignment = { horizontal: "center", vertical: "middle" };

  // ── Stream response ─────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const startStr = startParam ?? "start";
  const endStr = endParam ?? "end";

  return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report-${startStr}-to-${endStr}.xlsx"`,
    },
  });
}
