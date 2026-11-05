import PDFDocument from "pdfkit";

const NAVY = "#1e3a5f";
const ACCENT = "#2563eb";

function formatDate(date: Date) {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type TenantVerificationPdfData = {
  applicationNumber: string;
  status: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail?: string | null;
  flatNo?: string | null;
  tower?: string | null;
  ownerName?: string | null;
  applicationDate: Date;
  approvedAt?: Date | null;
  remarks?: string | null;
};

export function generateTenantVerificationCertificatePdf(
  data: TenantVerificationPdfData
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 0, size: "A4" });
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = 595;
    const pageHeight = 842;
    const L = 40;
    const CW = pageWidth - 80;

    // Header
    doc.rect(0, 0, pageWidth, 70).fill(NAVY);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(17)
      .text("OASIS VENETIA HEIGHTS", L, 16, { width: CW, align: "center" });
    doc.fillColor("#93b8d4").font("Helvetica").fontSize(9)
      .text("Oasis Buildmart India Pvt. Ltd., Greater Noida - 201306 (UP)", L, 38, {
        width: CW,
        align: "center",
      });

    // Title badge
    doc.rect(pageWidth / 2 - 130, 82, 260, 22).fill(ACCENT);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10)
      .text("TENANT VERIFICATION CERTIFICATE", L, 88, { width: CW, align: "center" });

    let y = 122;

    // Application number and date
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5)
      .text("APPLICATION NUMBER", L, y, { width: 240 });
    doc.text("DATE", 310, y, { width: 245 });

    y += 13;
    doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(12)
      .text(data.applicationNumber, L, y, { width: 240 });
    doc.fillColor("#374151").font("Helvetica").fontSize(10)
      .text(formatDate(data.applicationDate), 310, y, { width: 245 });

    y += 34;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.8).stroke();

    // Tenant details
    y += 14;
    doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8.5)
      .text("TENANT DETAILS", L, y, { width: CW });

    y += 16;
    const rows: [string, string][] = [
      ["Tenant Name", data.tenantName],
      ["Phone", data.tenantPhone],
      ["Email", data.tenantEmail ?? "—"],
      ["Flat No.", data.flatNo ?? "—"],
      ["Tower", data.tower ?? "—"],
      ["Owner Name", data.ownerName ?? "—"],
      ["Status", data.status],
    ];

    for (let i = 0; i < rows.length; i++) {
      const [label, value] = rows[i];
      if (i % 2 === 0) {
        doc.rect(L, y - 4, CW, 18).fill("#f9fafb");
      }
      doc.fillColor("#6b7280").font("Helvetica").fontSize(8)
        .text(label, L + 8, y, { width: 200, lineBreak: false });
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8)
        .text(value, 260, y, { width: CW - 222, lineBreak: false });
      y += 18;
    }

    if (data.approvedAt) {
      y += 8;
      doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8.5)
        .text("APPROVAL", L, y, { width: CW });
      y += 14;
      doc.fillColor("#6b7280").font("Helvetica").fontSize(8)
        .text("Approved At", L, y, { width: 200, lineBreak: false });
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8)
        .text(formatDate(data.approvedAt), 260, y, { width: CW - 222, lineBreak: false });
      y += 24;
    }

    // Footer
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 10;
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(6.5)
      .text(
        "Oasis Buildmart India Pvt. Ltd.  |  Oasis Venetia Heights, Greater Noida - 201306 (UP)  |  Phone: 8588805052",
        L,
        y,
        { width: CW, align: "center" }
      );

    doc.end();
  });
}
