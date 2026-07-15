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

export function generateBillPdf(data: BillData): Buffer {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  doc.on("data", (chunk) => chunks.push(chunk));

  // Header
  doc.fontSize(14).font("Helvetica-Bold").text("OASIS BUILDMART INDIA PVT. LTD.", { align: "center" });
  doc.fontSize(10).font("Helvetica").text("Oasis Venetia Heights, Plot No-HRA, 12, A, Site-C, Greater Noida - 201306 (UP)", { align: "center" });
  doc.text("Phone: 8130334857", { align: "center" });
  doc.fontSize(12).font("Helvetica-Bold").text("ELECTRICITY BILL", { align: "center" });
  doc.moveDown(0.5);

  // Property info table
  const tableTop = doc.y;
  const col1 = 40, col2 = 180, col3 = 320, col4 = 460;
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("PROPERTY NO.", col1, tableTop);
  doc.text("BILL DATE", col2, tableTop);
  doc.text("BILLING CYCLE", col3, tableTop);
  doc.text("SANCT. LOAD", col4, tableTop);
  doc.font("Helvetica");
  const row2 = tableTop + 15;
  doc.text(data.flatNo, col1, row2);
  doc.text(formatDate(data.billDate), col2, row2);
  doc.text(`${formatDate(data.billingPeriodStart)} to`, col3, row2);
  doc.text(`${data.sanctionedLoad} KW`, col4, row2);
  doc.text(formatDate(data.billingPeriodEnd), col3, row2 + 12);
  doc.moveDown(1.5);

  const row3top = doc.y;
  doc.font("Helvetica-Bold");
  doc.text("NAME", col1, row3top);
  doc.text("DUE DATE", col2, row3top);
  doc.text("AREA", col3, row3top);
  doc.font("Helvetica");
  const row4 = row3top + 15;
  doc.text(data.residentName, col1, row4);
  doc.text(formatDate(data.dueDate), col2, row4);
  doc.text(`${data.unitArea} Sq.Ft.`, col3, row4);
  doc.moveDown(1.5);

  doc.font("Helvetica").text(`ADDRESS: Flat No ${data.flatNo}, Oasis Venetia Heights, Greater Noida - 201306`);
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  // Meter readings
  doc.font("Helvetica-Bold").text("METER READING DETAILS");
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(8);
  doc.text("Power Source", col1);
  doc.text("From", col2, doc.y - 10);
  doc.text("To", col3, doc.y - 10);
  doc.text("Initial", col4 - 20, doc.y - 10);
  const colFinal = col4 + 40;
  const colUnits = col4 + 90;

  doc.font("Helvetica").fontSize(9);
  doc.moveDown(0.3);
  const mrRow1 = doc.y;
  doc.text("NPCL Power", col1, mrRow1);
  doc.text(formatDate(data.billingPeriodStart), col2, mrRow1);
  doc.text(formatDate(data.billingPeriodEnd), col3, mrRow1);
  doc.text(String(data.ncplPrevious), col4 - 20, mrRow1);
  doc.text(String(data.ncplCurrent), colFinal, mrRow1);
  doc.text(String(data.ncplUnits), colUnits, mrRow1);

  doc.moveDown(0.3);
  const mrRow2 = doc.y;
  doc.text("DG Power", col1, mrRow2);
  doc.text(formatDate(data.billingPeriodStart), col2, mrRow2);
  doc.text(formatDate(data.billingPeriodEnd), col3, mrRow2);
  doc.text(String(data.dgPrevious), col4 - 20, mrRow2);
  doc.text(String(data.dgCurrent), colFinal, mrRow2);
  doc.text(String(data.dgUnits), colUnits, mrRow2);

  doc.moveDown(0.8);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  // Bill Summary
  doc.font("Helvetica-Bold").fontSize(10).text("BILL SUMMARY & BREAKDOWN");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9);

  const labelX = 40, amtX = 450;
  doc.text(`Current Energy Charges of NPCL Power (${data.ncplUnits} units × ₹${data.ratePerUnit}/unit)`, labelX);
  doc.text(`₹ ${formatCurrency(data.ncplCharge)}`, amtX, doc.y - 12, { width: 100, align: "right" });

  doc.text(`Current Energy Charges of DG Power (Fixed)`, labelX);
  doc.text(`₹ ${formatCurrency(data.dgCharge)}`, amtX, doc.y - 12, { width: 100, align: "right" });

  doc.text(`Fixed Energy Charges (@ ₹115 per kW/month)`, labelX);
  doc.text(`₹ ${formatCurrency(data.fixedCharge)}`, amtX, doc.y - 12, { width: 100, align: "right" });

  if (data.previousDues > 0) {
    doc.text(`Previous Outstanding Balance`, labelX);
    doc.text(`₹ ${formatCurrency(data.previousDues)}`, amtX, doc.y - 12, { width: 100, align: "right" });
  }

  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(11);
  doc.text("Net Payable Amount", labelX);
  doc.text(`₹ ${formatCurrency(data.totalAmount)}`, amtX, doc.y - 14, { width: 100, align: "right" });

  doc.moveDown(0.8);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  // Terms
  doc.font("Helvetica-Bold").fontSize(9).text("TERMS & NOTES");
  doc.font("Helvetica").fontSize(8);
  doc.text("1. NPCL Rate: ₹7.00/unit | DG Rate: ₹16.00/unit");
  doc.text("2. Electricity will be disconnected after due date without further notice.");
  doc.text("3. Reconnection fee: ₹500 + 24% p.a. interest on outstanding amount.");

  doc.end();

  return Buffer.concat(chunks);
}

export function generateReceiptPdf(data: ReceiptData): Buffer {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(14).font("Helvetica-Bold").text("OASIS BUILDMART INDIA PVT. LTD.", { align: "center" });
  doc.fontSize(10).font("Helvetica").text("Oasis Venetia Heights, Greater Noida - 201306", { align: "center" });
  doc.fontSize(12).font("Helvetica-Bold").text("PAYMENT RECEIPT", { align: "center" });
  doc.moveDown(1);

  const col1 = 40, col2 = 250;
  doc.font("Helvetica-Bold").fontSize(10).text("Receipt Number:", col1);
  doc.font("Helvetica").text(data.receiptNumber, col2, doc.y - 12);

  doc.font("Helvetica-Bold").text("Resident Name:", col1);
  doc.font("Helvetica").text(data.residentName, col2, doc.y - 12);

  doc.font("Helvetica-Bold").text("Flat Number:", col1);
  doc.font("Helvetica").text(data.flatNo, col2, doc.y - 12);

  doc.font("Helvetica-Bold").text("Bill Number:", col1);
  doc.font("Helvetica").text(data.billNumber, col2, doc.y - 12);

  doc.font("Helvetica-Bold").text("Amount Paid:", col1);
  doc.font("Helvetica").text(`₹ ${formatCurrency(data.amount)}`, col2, doc.y - 12);

  doc.font("Helvetica-Bold").text("Payment Date:", col1);
  doc.font("Helvetica").text(formatDate(data.paymentDate), col2, doc.y - 12);

  doc.font("Helvetica-Bold").text("Payment Method:", col1);
  doc.font("Helvetica").text(data.method, col2, doc.y - 12);

  if (data.razorpayPaymentId) {
    doc.font("Helvetica-Bold").text("Transaction ID:", col1);
    doc.font("Helvetica").text(data.razorpayPaymentId, col2, doc.y - 12);
  }

  doc.moveDown(2);
  doc.fontSize(12).font("Helvetica-Bold").text("PAYMENT CONFIRMED", { align: "center" });
  doc.fontSize(9).font("Helvetica").fillColor("gray").text("This is a computer-generated receipt.", { align: "center" });

  doc.end();

  return Buffer.concat(chunks);
}
