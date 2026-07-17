import PDFDocument from "pdfkit";

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

export function generateBillPdf(data: BillData): Promise<Buffer> {
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
    doc.text("Phone: 8130334857", 40, doc.y, { width: 515, align: "center" });
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

    // Net payable
    y = doc.y;
    doc.font("Helvetica-Bold").fontSize(11);
    cell(doc, "Net Payable Amount", BL, y, BLW);
    cell(doc, `Rs. ${formatCurrency(data.totalAmount)}`, BR, y, BRW, { align: "right" });
    doc.text("", 40, y + 16);

    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // ── Terms ────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(9).text("TERMS & NOTES", 40, doc.y, { width: 515 });
    doc.font("Helvetica").fontSize(8);
    doc.text("1. NPCL Rate: Rs.7.00/unit | DG Rate: Rs.16.00/unit", 40, doc.y, { width: 515 });
    doc.text("2. Electricity will be disconnected after due date without further notice.", 40, doc.y, { width: 515 });
    doc.text("3. Reconnection fee: Rs.500 + 24% p.a. interest on outstanding amount.", 40, doc.y, { width: 515 });

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
      .text("Phone: 8130334857", L, 56, { width: CW, align: "center" });

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

    // ── Footer ────────────────────────────────────────────────────────────
    y += 78;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 8;
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(7)
      .text(
        "Oasis Buildmart India Pvt. Ltd.  |  Oasis Venetia Heights, Greater Noida - 201306 (UP)  |  Phone: 8130334857",
        L, y, { width: CW, align: "center" }
      );

    doc.end();
  });
}
