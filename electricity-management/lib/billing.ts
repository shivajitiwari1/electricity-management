import { Decimal } from "@prisma/client/runtime/client";
import { prisma } from "@/lib/prisma";

export async function nextReceiptNumber(): Promise<string> {
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const prefix = `RCPT-${datePart}-`;
  const last = await prisma.payment.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });
  const seq = last ? parseInt(last.receiptNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export interface BillCalculation {
  ncplCharge: Decimal;
  dgCharge: Decimal;
  fixedCharge: Decimal;
  totalAmount: Decimal;
  dueDate: Date;
}

export function calculateBill(params: {
  ncplUnits: Decimal;
  ratePerUnit: Decimal;    // snapshot of Rate.ncplPerUnit
  dgCharge: Decimal;       // snapshot of Rate.dgFixed
  fixedPerKw: Decimal;     // snapshot of Rate.fixedPerKw
  sanctionedLoad: Decimal; // Connection.sanctionedLoad in kW
  previousDues: Decimal;
  billDate: Date;
}): BillCalculation {
  const { ncplUnits, ratePerUnit, dgCharge, fixedPerKw, sanctionedLoad, previousDues, billDate } = params;

  const ncplCharge = ncplUnits.mul(ratePerUnit);
  const fixedCharge = sanctionedLoad.mul(fixedPerKw);
  const totalAmount = ncplCharge.add(dgCharge).add(fixedCharge).add(previousDues);

  // Due date = bill date + 9 days
  const dueDate = new Date(billDate);
  dueDate.setDate(dueDate.getDate() + 9);

  return { ncplCharge, dgCharge, fixedCharge, totalAmount, dueDate };
}

export function generateBillNumber(flatNo: string, billDate: Date): string {
  const year = billDate.getFullYear();
  const month = String(billDate.getMonth() + 1).padStart(2, "0");
  return `OV-${flatNo}-${year}${month}`;
}

export function generateReceiptNumber(date: Date, seq: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `RCPT-${year}${month}${day}-${String(seq).padStart(4, "0")}`;
}
