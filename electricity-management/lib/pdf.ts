import PDFDocument from "pdfkit";
import { generateUpiQrDataUrl } from "@/lib/qr";

export interface BillData {
  flatNo: string;
  residentName: string;
  billDate: Date;
  dueDate: Date;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  sanctionedLoad: number;
  unitArea: number;
  ncplPrevious: number;
  ncplCurrent: number;
  ncplUnits: number;
  dgPrevious: number;
  dgCurrent: number;
  dgUnits: number;
  ratePerUnit: number;
  ncplCharge: number;
  dgCharge: number;
  fixedCharge: number;
  previousDues: number;
  totalAmount: number;
  billNumber: string;
  paidAmount?: number;
  status?: string;
}

export interface ReceiptData {
  receiptNumber: string;
  residentName: string;
  flatNo: string;
  billNumber: string;
  amount: number;
  paymentDate: Date;
  razorpayPaymentId?: string;
  method: string;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Column layout for A4 (595pt wide, 40pt margins → content 40–555, width 515pt)
// Info table
const I1 = 40,  I1W = 120;
const I2 = 170, I2W = 120;
const I3 = 300, I3W = 135;
const I4 = 445, I4W = 110;

// Meter readings table
const M1 = 40,  M1W = 90;   // Power Source
const M2 = 135, M2W = 80;   // From
const M3 = 220, M3W = 80;   // To
const M4 = 305, M4W = 60;   // Previous
const M5 = 370, M5W = 60;   // Current
const M6 = 435, M6W = 60;   // Units

// Bill summary
const BL = 40,  BLW = 380;  // Label
const BR = 425, BRW = 130;  // Amount (right-aligned)

function cell(doc: InstanceType<typeof PDFDocument>, text: string, x: number, y: number, width: number, opts: Record<string, unknown> = {}) {
  doc.text(text, x, y, { width, lineBreak: false, ...opts });
}

export async function generateBillPdf(data: BillData): Promise<Buffer> {
  // Generate QR code before entering the PDFKit Promise callback (no await inside Promise constructor)
  const qrPayable = (data.status === "PARTIAL" && data.paidAmount && data.paidAmount > 0)
    ? data.totalAmount - data.paidAmount
    : data.totalAmount;
  const qrDataUrl = await generateUpiQrDataUrl(qrPayable);
  const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ""), "base64");

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Header ──────────────────────────────────────────────
    doc.fontSize(14).font("Helvetica-Bold")
      .text("OASIS BUILDMART INDIA PVT. LTD.", 40, doc.y, { width: 515, align: "center" });
    doc.fontSize(9).font("Helvetica")
      .text("Oasis Venetia Heights, Plot No-HRA, 12, A, Site-C, Greater Noida - 201306 (UP)", 40, doc.y, { width: 515, align: "center" });
    doc.text("Phone: 9355011978", 40, doc.y, { width: 515, align: "center" });
    doc.fontSize(12).font("Helvetica-Bold")
      .text("ELECTRICITY BILL", 40, doc.y, { width: 515, align: "center" });
    doc.moveDown(0.6);

    // ── Property Info Row 1 ──────────────────────────────────
    let y = doc.y;
    doc.fontSize(8).font("Helvetica-Bold");
    cell(doc, "PROPERTY NO.", I1, y, I1W);
    cell(doc, "BILL DATE",    I2, y, I2W);
    cell(doc, "BILLING CYCLE", I3, y, I3W);
    cell(doc, "SANCT. LOAD",  I4, y, I4W);

    y += 14;
    doc.font("Helvetica").fontSize(9);
    cell(doc, data.flatNo,                         I1, y, I1W);
    cell(doc, formatDate(data.billDate),            I2, y, I2W);
    cell(doc, `${formatDate(data.billingPeriodStart)} to ${formatDate(data.billingPeriodEnd)}`, I3, y, I3W);
    cell(doc, `${data.sanctionedLoad} KW`,          I4, y, I4W);
    doc.moveDown(1.8);

    // ── Property Info Row 2 ──────────────────────────────────
    y = doc.y;
    doc.fontSize(8).font("Helvetica-Bold");
    cell(doc, "NAME",     I1, y, I1W);
    cell(doc, "DUE DATE", I2, y, I2W);
    cell(doc, "AREA",     I3, y, I3W);

    y += 14;
    doc.font("Helvetica").fontSize(9);
    cell(doc, data.residentName,           I1, y, I1W);
    cell(doc, formatDate(data.dueDate),    I2, y, I2W);
    cell(doc, `${data.unitArea} Sq.Ft.`,   I3, y, I3W);
    doc.moveDown(1.8);

    doc.font("Helvetica").fontSize(9)
      .text(`ADDRESS: Flat No ${data.flatNo}, Oasis Venetia Heights, Greater Noida - 201306`, 40, doc.y, { width: 515 });
    doc.moveDown(0.4);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.4);

    // ── Meter Readings ───────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(9).text("METER READING DETAILS", 40, doc.y);
    doc.moveDown(0.4);

    y = doc.y;
    doc.fontSize(8).font("Helvetica-Bold");
    cell(doc, "Power Source", M1, y, M1W);
    cell(doc, "From",         M2, y, M2W);
    cell(doc, "To",           M3, y, M3W);
    cell(doc, "Previous",     M4, y, M4W);
    cell(doc, "Current",      M5, y, M5W);
    cell(doc, "Units",        M6, y, M6W);

    y += 14;
    doc.font("Helvetica").fontSize(9);
    cell(doc, "NPCL Power",                       M1, y, M1W);
    cell(doc, formatDate(data.billingPeriodStart), M2, y, M2W);
    cell(doc, formatDate(data.billingPeriodEnd),   M3, y, M3W);
    cell(doc, String(data.ncplPrevious),           M4, y, M4W);
    cell(doc, String(data.ncplCurrent),            M5, y, M5W);
    cell(doc, String(data.ncplUnits),              M6, y, M6W);

    y += 16;
    cell(doc, "DG Power",                         M1, y, M1W);
    cell(doc, formatDate(data.billingPeriodStart), M2, y, M2W);
    cell(doc, formatDate(data.billingPeriodEnd),   M3, y, M3W);
    cell(doc, String(data.dgPrevious),             M4, y, M4W);
    cell(doc, String(data.dgCurrent),              M5, y, M5W);
    cell(doc, String(data.dgUnits),                M6, y, M6W);

    // advance cursor past last row
    doc.text("", 40, y + 16);
    doc.moveDown(0.4);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // ── Bill Summary ─────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(10)
      .text("BILL SUMMARY & BREAKDOWN", 40, doc.y, { width: 515 });
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(9);

    const summaryRows: [string, number][] = [
      [`Current Energy Charges of NPCL Power (${data.ncplUnits} units x Rs.${data.ratePerUnit}/unit)`, data.ncplCharge],
      [`Current Energy Charges of DG Power (Fixed)`, data.dgCharge],
      [`Fixed Energy Charges (@ Rs.115 per kW/month)`, data.fixedCharge],
    ];
    if (data.previousDues > 0) {
      summaryRows.push([`Previous Outstanding Balance`, data.previousDues]);
    }

    for (const [label, amount] of summaryRows) {
      y = doc.y;
      cell(doc, label, BL, y, BLW);
      cell(doc, `Rs. ${formatCurrency(amount)}`, BR, y, BRW, { align: "right" });
      doc.text("", 40, y + 14);
    }

    doc.moveDown(0.2);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);

    const paidAmount = data.paidAmount ?? 0;
    const isPartial = data.status === "PARTIAL" && paidAmount > 0;

    if (isPartial) {
      // Gross payable
      y = doc.y;
      doc.font("Helvetica-Bold").fontSize(10);
      cell(doc, "Gross Payable Amount", BL, y, BLW);
      cell(doc, `Rs. ${formatCurrency(data.totalAmount)}`, BR, y, BRW, { align: "right" });
      doc.text("", 40, y + 14);

      // Amount paid (green)
      y = doc.y;
      doc.fillColor("#16a34a").font("Helvetica").fontSize(9);
      cell(doc, "Amount Already Paid", BL, y, BLW);
      cell(doc, `- Rs. ${formatCurrency(paidAmount)}`, BR, y, BRW, { align: "right" });
      doc.text("", 40, y + 14);
      doc.fillColor("black");

      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.3);

      // Balance due amber box
      const balanceDue = data.totalAmount - paidAmount;
      y = doc.y;
      doc.rect(40, y, 515, 36).fill("#fff7ed");
      doc.moveTo(40, y).lineTo(555, y).strokeColor("#f97316").lineWidth(1).stroke();
      doc.moveTo(40, y + 36).lineTo(555, y + 36).strokeColor("#f97316").lineWidth(1).stroke();
      doc.strokeColor("black").lineWidth(0.5);
      doc.fillColor("#b45309").font("Helvetica-Bold").fontSize(12);
      cell(doc, "BALANCE DUE", BL, y + 10, BLW);
      cell(doc, `Rs. ${formatCurrency(balanceDue)}`, BR, y + 10, BRW, { align: "right" });
      doc.text("", 40, y + 44);
      doc.fillColor("black");
    } else {
      // Net payable
      y = doc.y;
      doc.font("Helvetica-Bold").fontSize(11);
      cell(doc, "Net Payable Amount", BL, y, BLW);
      cell(doc, `Rs. ${formatCurrency(data.totalAmount)}`, BR, y, BRW, { align: "right" });
      doc.text("", 40, y + 16);
    }

    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // ── Terms ────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(9).text("TERMS & NOTES", 40, doc.y, { width: 515 });
    doc.font("Helvetica").fontSize(8);
    doc.text("1. NPCL Rate: Rs.7.00/unit | DG Rate: Rs.16.00/unit", 40, doc.y, { width: 515 });
    doc.text("2. Electricity will be disconnected after due date without further notice.", 40, doc.y, { width: 515 });
    doc.text("3. Reconnection fee: Rs.500 + 24% p.a. interest on outstanding amount.", 40, doc.y, { width: 515 });

    doc.moveDown(0.6);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // ── Payment Details ──────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(9).text("PAYMENT DETAILS", 40, doc.y, { width: 515 });
    doc.moveDown(0.4);

    const qrTop = doc.y;
    const qrSize = 110;

    // QR code on the right side
    doc.image(qrBuffer, 555 - qrSize, qrTop, { width: qrSize, height: qrSize });

    // Bank details on the left
    const bankX = 40;
    const bankW = 380;
    doc.font("Helvetica-Bold").fontSize(8);
    doc.text("Pay via UPI / Bank Transfer:", bankX, qrTop, { width: bankW });
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(8);

    const bankRows: [string, string][] = [
      ["Beneficiary Name", "OASIS BUILDMART INDIA PVT LTD"],
      ["Bank Name", "Bank of Baroda"],
      ["Account Number", "88340200001343"],
      ["IFSC Code", "BARB0DBGREA"],
      ["Branch", "Greater Noida"],
      ["UPI ID", "oasis88268343@barodampay"],
    ];

    for (const [label, value] of bankRows) {
      const rowY = doc.y;
      doc.font("Helvetica-Bold").text(`${label}: `, bankX, rowY, { width: bankW, continued: true });
      doc.font("Helvetica").text(value, { width: bankW });
    }

    // Scan label under QR
    doc.font("Helvetica").fontSize(7)
      .text("Scan to Pay", 555 - qrSize, qrTop + qrSize + 2, { width: qrSize, align: "center" });

    doc.end();
  });
}

export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 0, size: "A4" });

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = 595;   // page width
    const L  = 40;   // left margin
    const CW = 515;  // content width

    // ── Navy header background ────────────────────────────────────────────
    doc.rect(0, 0, PW, 108).fill("#1e3a5f");

    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(15)
      .text("OASIS BUILDMART INDIA PVT. LTD.", L, 22, { width: CW, align: "center" });
    doc.fillColor("#93b8d4").font("Helvetica").fontSize(8.5)
      .text("Oasis Venetia Heights, Plot No-HRA, 12, A, Site-C, Greater Noida - 201306 (UP)", L, 42, { width: CW, align: "center" });
    doc.fillColor("#93b8d4").fontSize(8.5)
      .text("Phone: 9355011978", L, 56, { width: CW, align: "center" });

    // "PAYMENT RECEIPT" badge on header
    doc.rect(PW / 2 - 75, 74, 150, 22).fill("#2563eb");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10)
      .text("PAYMENT RECEIPT", L, 79, { width: CW, align: "center" });

    // ── Receipt # and Date ────────────────────────────────────────────────
    let y = 126;
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5)
      .text("RECEIPT NUMBER", L, y, { width: 240 });
    doc.text("DATE", 310, y, { width: 245 });

    y += 13;
    doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(12)
      .text(data.receiptNumber, L, y, { width: 240 });
    doc.fillColor("#374151").font("Helvetica").fontSize(10)
      .text(formatDate(data.paymentDate), 310, y, { width: 245 });

    // divider
    y += 28;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.8).stroke();

    // ── Billed To / Flat No ───────────────────────────────────────────────
    y += 14;
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5)
      .text("BILLED TO", L, y, { width: 280 });
    doc.text("FLAT NO.", 370, y, { width: 185 });

    y += 13;
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12)
      .text(data.residentName, L, y, { width: 300 });
    doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(16)
      .text(data.flatNo, 370, y - 2, { width: 185 });

    // divider
    y += 34;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.8).stroke();

    // ── Payment Details rows ──────────────────────────────────────────────
    y += 14;
    doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8.5)
      .text("PAYMENT DETAILS", L, y, { width: CW });

    y += 16;
    const detailRows: [string, string][] = [
      ["Bill Number", data.billNumber],
      ["Payment Method", data.method],
      ["Payment Date", formatDate(data.paymentDate)],
    ];
    if (data.razorpayPaymentId) {
      detailRows.push(["Transaction ID", data.razorpayPaymentId]);
    }

    for (let i = 0; i < detailRows.length; i++) {
      const [label, value] = detailRows[i];
      if (i % 2 === 0) {
        doc.rect(L, y - 4, CW, 22).fill("#f9fafb");
      }
      doc.fillColor("#6b7280").font("Helvetica").fontSize(8.5)
        .text(label, L + 8, y, { width: 200, lineBreak: false });
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8.5)
        .text(value, 260, y, { width: CW - 222, lineBreak: false });
      y += 22;
    }

    // ── Amount box ────────────────────────────────────────────────────────
    y += 14;
    doc.rect(L, y, CW, 80).fill("#eef2ff");
    doc.fillColor("#4b5563").font("Helvetica").fontSize(8)
      .text("TOTAL AMOUNT PAID", L, y + 14, { width: CW, align: "center" });
    doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(28)
      .text(`Rs. ${formatCurrency(data.amount)}`, L, y + 28, { width: CW, align: "center" });

    // ── Confirmation box ──────────────────────────────────────────────────
    y += 96;
    doc.rect(L, y, CW, 62).fill("#f0fdf4");
    doc.rect(L, y, CW, 62).strokeColor("#86efac").lineWidth(1).stroke();

    // Checkmark circle
    const cx = L + 30, cy = y + 31;
    doc.circle(cx, cy, 11).fill("#16a34a");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(14)
      .text("✓", cx - 5, cy - 9, { width: 12, lineBreak: false });

    doc.fillColor("#166534").font("Helvetica-Bold").fontSize(13)
      .text("PAYMENT CONFIRMED", L + 52, y + 14, { width: CW - 60 });
    doc.fillColor("#4b7a5a").font("Helvetica").fontSize(8)
      .text("This is a computer-generated receipt and does not require a signature.", L + 52, y + 33, { width: CW - 60 });
    doc.fillColor("#6b7280").font("Helvetica-Oblique").fontSize(7.5)
      .text("Note: Payment is subject to realization.", L + 52, y + 47, { width: CW - 60 });

    // ── Footer ────────────────────────────────────────────────────────────
    y += 78;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 8;
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(7)
      .text(
        "Oasis Buildmart India Pvt. Ltd.  |  Oasis Venetia Heights, Greater Noida - 201306 (UP)  |  Phone: 9355011978",
        L, y, { width: CW, align: "center" }
      );

    doc.end();
  });
}

export interface MaintenanceBillPdfData {
  billNumber: string;
  flatNo: string;
  residentName: string;
  billDate: Date;
  dueDate: Date;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  unitArea: number;
  ratePerSqFt: number;
  amount: number;
  interestCharge: number;
  previousDue: number;
  paidAmount: number;
  status: string;
  cgstRate: number;
  sgstRate: number;
}

export function generateMaintenanceBillPdf(data: MaintenanceBillPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 0, size: "A4" });

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = 595;
    const L = 40;
    const CW = 515;

    // ── Navy header ──────────────────────────────────────────
    doc.rect(0, 0, PW, 108).fill("#1e3a5f");

    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(15)
      .text("OASIS BUILDMART INDIA PVT. LTD.", L, 22, { width: CW, align: "center" });
    doc.fillColor("#93b8d4").font("Helvetica").fontSize(8.5)
      .text("Oasis Venetia Heights, Plot No-HRA, 12, A, Site-C, Greater Noida - 201306 (UP)", L, 42, { width: CW, align: "center" });
    doc.fillColor("#93b8d4").fontSize(8.5)
      .text("Phone: 9355011978", L, 56, { width: CW, align: "center" });

    doc.rect(PW / 2 - 75, 74, 150, 22).fill("#2563eb");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10)
      .text("MAINTENANCE BILL", L, 79, { width: CW, align: "center" });

    // ── Bill No and Date ─────────────────────────────────────
    let y = 126;
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5)
      .text("BILL NUMBER", L, y, { width: 240 });
    doc.text("BILL DATE", 310, y, { width: 245 });

    y += 13;
    doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(12)
      .text(data.billNumber, L, y, { width: 240 });
    doc.fillColor("#374151").font("Helvetica").fontSize(10)
      .text(formatDate(data.billDate), 310, y, { width: 245 });

    // divider
    y += 28;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.8).stroke();

    // ── Flat / Resident ──────────────────────────────────────
    y += 14;
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5)
      .text("FLAT NO.", L, y, { width: 200 });
    doc.text("RESIDENT NAME", 280, y, { width: 275 });

    y += 13;
    doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(16)
      .text(data.flatNo, L, y - 2, { width: 200 });
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12)
      .text(data.residentName, 280, y, { width: 275 });

    // divider
    y += 34;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.8).stroke();

    // ── Billing period + due date ────────────────────────────
    y += 14;
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5)
      .text("BILLING PERIOD", L, y, { width: 240 });
    doc.text("DUE DATE", 310, y, { width: 245 });

    y += 13;
    doc.fillColor("#374151").font("Helvetica").fontSize(10)
      .text(`${formatDate(data.billingPeriodStart)} – ${formatDate(data.billingPeriodEnd)}`, L, y, { width: 240 });
    doc.fillColor("#374151").font("Helvetica").fontSize(10)
      .text(formatDate(data.dueDate), 310, y, { width: 245 });

    y += 28;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.8).stroke();

    // ── Charge breakdown ─────────────────────────────────────
    y += 14;
    doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8.5)
      .text("CHARGE BREAKDOWN", L, y, { width: CW });

    y += 16;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const cgstPct         = data.cgstRate / 100;
    const sgstPct         = data.sgstRate / 100;
    const cgst            = r2(data.amount * cgstPct);
    const sgst            = r2(data.amount * sgstPct);
    const totalGst        = r2(cgst + sgst);
    const currentMonthTotal = r2(data.amount + totalGst);

    // [label, amount, isRed, isBold, isSummary, isDivider]
    type ChargeRow = [string, number, boolean, boolean, boolean, boolean];
    const chargeRows: ChargeRow[] = [
      [`Maintenance Charge (${data.unitArea} sq ft x Rs.${Number(data.ratePerSqFt).toFixed(2)}/sq ft)`, data.amount, false, false, false, false],
      [`CGST @ ${data.cgstRate}%`, cgst, false, false, false, false],
      [`SGST @ ${data.sgstRate}%`, sgst, false, false, false, false],
      [`Total GST (${data.cgstRate + data.sgstRate}%)`, totalGst, false, true, true, false],
      [`Total Current Month Bill`, currentMonthTotal, false, true, false, true],
    ];
    if (data.previousDue > 0) {
      chargeRows.push([`Previous Due (Outstanding from prior months)`, data.previousDue, true, false, false, false]);
    }
    if (data.interestCharge > 0) {
      chargeRows.push([`Interest Charge (24% p.a. overdue)`, data.interestCharge, true, false, false, false]);
    }
    if (data.paidAmount > 0) {
      chargeRows.push([`Amount Already Paid`, -data.paidAmount, false, false, false, false]);
    }

    for (let i = 0; i < chargeRows.length; i++) {
      const [label, amount, isRed, isBold, isSummary, isDivider] = chargeRows[i];
      if (isDivider) {
        // Divider row with top border and darker background
        doc.moveTo(L, y - 4).lineTo(L + CW, y - 4).strokeColor("#d1d5db").lineWidth(0.6).stroke();
        doc.rect(L, y - 4, CW, 22).fill("#f0f4ff");
        doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(8.5)
          .text(label, L + 8, y, { width: 380, lineBreak: false });
        doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(8.5)
          .text(`Rs. ${formatCurrency(Math.abs(amount))}`, L + 390, y, { width: 125, align: "right", lineBreak: false });
        doc.moveTo(L, y + 18).lineTo(L + CW, y + 18).strokeColor("#d1d5db").lineWidth(0.6).stroke();
      } else {
        const bgColor = isSummary ? "#eff6ff" : (i % 2 === 0 ? "#f9fafb" : "#ffffff");
        doc.rect(L, y - 4, CW, 22).fill(bgColor);
        doc.fillColor(isRed ? "#dc2626" : (isSummary ? "#1e3a5f" : "#6b7280"))
          .font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5)
          .text(label, L + 8, y, { width: 380, lineBreak: false });
        doc.fillColor(isRed ? "#dc2626" : (isSummary ? "#1e3a5f" : "#111827"))
          .font("Helvetica-Bold").fontSize(8.5)
          .text(`Rs. ${formatCurrency(Math.abs(amount))}`, L + 390, y, { width: 125, align: "right", lineBreak: false });
      }
      y += 22;
    }

    // ── Net payable box ──────────────────────────────────────
    const netPayable = r2(currentMonthTotal + data.previousDue + data.interestCharge - data.paidAmount);
    y += 8;
    doc.rect(L, y, CW, 80).fill("#eef2ff");
    doc.fillColor("#4b5563").font("Helvetica").fontSize(8)
      .text("NET PAYABLE AMOUNT", L, y + 14, { width: CW, align: "center" });
    doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(28)
      .text(`Rs. ${formatCurrency(netPayable > 0 ? netPayable : 0)}`, L, y + 28, { width: CW, align: "center" });

    if (data.status === "PAID") {
      y += 96;
      doc.rect(L, y, CW, 44).fill("#f0fdf4");
      doc.rect(L, y, CW, 44).strokeColor("#86efac").lineWidth(1).stroke();
      doc.fillColor("#166534").font("Helvetica-Bold").fontSize(13)
        .text("FULLY PAID", L, y + 14, { width: CW, align: "center" });
      y += 60;
    } else {
      y += 96;
    }

    // ── Terms ────────────────────────────────────────────────
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 10;
    doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8).text("TERMS & NOTES", L, y, { width: CW });
    y += 14;
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5)
      .text(`1. Rate: Rs.${Number(data.ratePerSqFt).toFixed(2)}/sq ft  .  Area: ${data.unitArea} sq ft`, L, y, { width: CW });
    y += 12;
    doc.text(`2. GST: CGST ${data.cgstRate}% + SGST ${data.sgstRate}% = ${data.cgstRate + data.sgstRate}% applicable on maintenance charge.`, L, y, { width: CW });
    y += 12;
    doc.text(`3. Payment due by ${formatDate(data.dueDate)}. Late payment attracts 24% p.a. interest.`, L, y, { width: CW });
    y += 12;
    doc.text("4. This is a computer-generated bill and does not require a signature.", L, y, { width: CW });

    // ── Footer ────────────────────────────────────────────────
    y += 24;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 8;
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(7)
      .text(
        "Oasis Buildmart India Pvt. Ltd.  |  Oasis Venetia Heights, Greater Noida - 201306 (UP)  |  Phone: 9355011978",
        L, y, { width: CW, align: "center" }
      );

    doc.end();
  });
}
