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
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(14).font("Helvetica-Bold")
      .text("OASIS BUILDMART INDIA PVT. LTD.", 40, doc.y, { width: 515, align: "center" });
    doc.fontSize(10).font("Helvetica")
      .text("Oasis Venetia Heights, Greater Noida - 201306", 40, doc.y, { width: 515, align: "center" });
    doc.fontSize(12).font("Helvetica-Bold")
      .text("PAYMENT RECEIPT", 40, doc.y, { width: 515, align: "center" });
    doc.moveDown(1);

    const rows: [string, string][] = [
      ["Receipt Number", data.receiptNumber],
      ["Resident Name",  data.residentName],
      ["Flat Number",    data.flatNo],
      ["Bill Number",    data.billNumber],
      ["Amount Paid",    `Rs. ${formatCurrency(data.amount)}`],
      ["Payment Date",   formatDate(data.paymentDate)],
      ["Payment Method", data.method],
    ];
    if (data.razorpayPaymentId) {
      rows.push(["Transaction ID", data.razorpayPaymentId]);
    }

    const labelX = 40, labelW = 180, valueX = 230, valueW = 325;
    for (const [label, value] of rows) {
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(10);
      cell(doc, label + ":", labelX, y, labelW);
      doc.font("Helvetica");
      cell(doc, value, valueX, y, valueW);
      doc.text("", 40, y + 16);
    }

    doc.moveDown(2);
    doc.fontSize(12).font("Helvetica-Bold")
      .text("PAYMENT CONFIRMED", 40, doc.y, { width: 515, align: "center" });
    doc.fontSize(9).font("Helvetica").fillColor("gray")
      .text("This is a computer-generated receipt.", 40, doc.y, { width: 515, align: "center" });

    doc.end();
  });
}
