export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import PaymentForm from "@/components/resident/payment-form";

export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const resident = await prisma.resident.findUnique({
    where: { userId: session.user.id },
    include: { connections: { select: { id: true } } },
  });
  if (!resident) redirect("/login");

  const connectionIds = resident.connections.map((c) => c.id);

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { name: true } } } },
        },
      },
      meterReading: true,
    },
  });

  // Security: verify this bill belongs to this resident
  if (!bill || !connectionIds.includes(bill.connectionId))
    redirect("/resident/bills");
  if (bill.status === "PAID") redirect("/resident/payments");

  const serializedBill = {
    id: bill.id,
    billNumber: bill.billNumber,
    flatNo: bill.connection.flatNo,
    residentName: bill.connection.resident.user.name ?? "",
    billingPeriodStart: bill.billingPeriodStart.toISOString(),
    billingPeriodEnd: bill.billingPeriodEnd.toISOString(),
    ncplUnits: Number(bill.ncplUnits),
    ratePerUnit: Number(bill.ratePerUnit),
    ncplCharge: Number(bill.ncplCharge),
    dgCharge: Number(bill.dgCharge),
    fixedCharge: Number(bill.fixedCharge),
    previousDues: Number(bill.previousDues),
    totalAmount: Number(bill.totalAmount),
    dueDate: bill.dueDate.toISOString(),
    status: bill.status,
  };

  return (
    <PaymentForm
      bill={serializedBill}
      razorpayKeyId={process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!}
    />
  );
}
