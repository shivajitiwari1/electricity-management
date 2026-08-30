import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined): string => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const [residents, connections, bills, payments, meterReadings] = await Promise.all([
      prisma.resident.findMany({
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.connection.findMany({
        include: { resident: { include: { user: { select: { name: true, email: true } } } } },
        orderBy: { flatNo: "asc" },
      }),
      prisma.bill.findMany({
        include: { connection: { include: { resident: { include: { user: { select: { name: true } } } } } } },
        orderBy: { billDate: "asc" },
      }),
      prisma.payment.findMany({
        include: { bill: { include: { connection: { include: { resident: { include: { user: { select: { name: true } } } } } } } } },
        orderBy: { paymentDate: "asc" },
      }),
      prisma.meterReading.findMany({
        include: { connection: { select: { flatNo: true, tower: true } } },
        orderBy: { readingDate: "asc" },
      }),
    ]);

    const residentsCSV = toCSV(
      ["ID", "Resident No", "Name", "Email", "Phone", "Created At"],
      residents.map((r) => [r.id, r.residentNumber, r.user.name, r.user.email, r.phone ?? "", fmtDate(r.createdAt)])
    );

    const connectionsCSV = toCSV(
      ["ID", "Flat No", "Tower", "Floor", "Unit Type", "Unit Area (sqft)", "Meter No", "Sanctioned Load (kW)", "Status", "Connected At", "Resident Name", "Resident Email"],
      connections.map((c) => [
        c.id, c.flatNo, c.tower, c.floor, c.unitType, c.unitArea,
        c.meterNo ?? "", Number(c.sanctionedLoad), c.status, fmtDate(c.connectedAt),
        c.resident.user.name, c.resident.user.email,
      ])
    );

    const billsCSV = toCSV(
      ["Bill #", "Flat No", "Tower", "Resident Name", "Bill Date", "Due Date", "Period Start", "Period End", "NCPL Units", "Rate/Unit", "NCPL Charge", "DG Charge", "Fixed Charge", "Previous Dues", "Total Amount", "Paid Amount", "Balance", "Status"],
      bills.map((b) => [
        b.billNumber, b.connection.flatNo, b.connection.tower, b.connection.resident.user.name,
        fmtDate(b.billDate), fmtDate(b.dueDate), fmtDate(b.billingPeriodStart), fmtDate(b.billingPeriodEnd),
        Number(b.ncplUnits), Number(b.ratePerUnit), Number(b.ncplCharge), Number(b.dgCharge),
        Number(b.fixedCharge), Number(b.previousDues), Number(b.totalAmount), Number(b.paidAmount),
        Number(b.totalAmount) - Number(b.paidAmount), b.status,
      ])
    );

    const paymentsCSV = toCSV(
      ["Receipt #", "Flat No", "Resident Name", "Bill #", "Amount", "Payment Date", "Method", "Status", "Transaction / Ref ID"],
      payments.map((p) => [
        p.receiptNumber, p.bill.connection.flatNo, p.bill.connection.resident.user.name,
        p.bill.billNumber, Number(p.amount), fmtDate(p.paymentDate),
        p.method, p.status, p.razorpayPaymentId ?? "",
      ])
    );

    const meterReadingsCSV = toCSV(
      ["ID", "Flat No", "Tower", "Reading Date", "NCPL Previous", "NCPL Current", "NCPL Units", "DG Previous", "DG Current", "DG Units", "Recorded At"],
      meterReadings.map((m) => [
        m.id, m.connection.flatNo, m.connection.tower, fmtDate(m.readingDate),
        Number(m.ncplPrevious), Number(m.ncplCurrent), Number(m.ncplUnits),
        Number(m.dgPrevious), Number(m.dgCurrent), Number(m.dgUnits), fmtDate(m.createdAt),
      ])
    );

    const zip = new JSZip();
    zip.file("residents.csv", residentsCSV);
    zip.file("connections.csv", connectionsCSV);
    zip.file("bills.csv", billsCSV);
    zip.file("payments.csv", paymentsCSV);
    zip.file("meter_readings.csv", meterReadingsCSV);

    const zipUint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const zipBuffer = zipUint8.buffer.slice(zipUint8.byteOffset, zipUint8.byteOffset + zipUint8.byteLength) as ArrayBuffer;

    const today = new Date().toISOString().split("T")[0];
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="oasis-backup-${today}.zip"`,
        "Content-Length": zipBuffer.byteLength.toString(),
      },
    });
  } catch (err) {
    console.error("Backup failed", err);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
