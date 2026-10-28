import { writeFileSync } from "node:fs";
import { generateMaintenanceBillPdf } from "../../lib/pdf.ts";
const base = {
  billNumber: "OM-B-506-202608", flatNo: "B-506", residentName: "Mr. Amit Jyot Singh",
  billDate: new Date(Date.UTC(2026, 8, 7)), dueDate: new Date(Date.UTC(2026, 8, 15)),
  billingPeriodStart: new Date(Date.UTC(2026, 7, 1)), billingPeriodEnd: new Date(Date.UTC(2026, 7, 31)),
  unitArea: 995, ratePerSqFt: 2.25, amount: 2643, cgstRate: 9, sgstRate: 9,
};
const cases = [
  ["prior dues + interest + part payment", { ...base, previousDue: 7436, interestCharge: 120, paidAmount: 1000, status: "PARTIAL" }],
  ["fully paid", { ...base, previousDue: 7436, interestCharge: 0, paidAmount: 10079, status: "PAID" }],
];
for (const [label, data] of cases) {
  const buf = await generateMaintenanceBillPdf(data);
  const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  console.log(`${label}: pages=${pages}`);
  writeFileSync(`scripts/tmp/bill-${label.startsWith("prior") ? "prior" : "paid"}.pdf`, buf);
}
