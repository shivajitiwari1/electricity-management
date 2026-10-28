import { writeFileSync } from "node:fs";
import { generateMaintenanceBillPdf } from "../../lib/pdf.ts";

const buf = await generateMaintenanceBillPdf({
  billNumber: "OM-B-303-202608",
  flatNo: "B-303",
  residentName: "Mrs. Gomathy Subbaraman",
  billDate: new Date(Date.UTC(2026, 8, 7)),
  dueDate: new Date(Date.UTC(2026, 8, 15)),
  billingPeriodStart: new Date(Date.UTC(2026, 7, 1)),
  billingPeriodEnd: new Date(Date.UTC(2026, 7, 31)),
  unitArea: 1290,
  ratePerSqFt: 2.25,
  amount: 3425,
  interestCharge: 0,
  previousDue: 0,
  paidAmount: 0,
  status: "PENDING",
  cgstRate: 9,
  sgstRate: 9,
});
writeFileSync("scripts/tmp/bill.pdf", buf);
const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
console.log("bytes:", buf.length, "pages:", pages);
