import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPaymentToken, generatePaymentToken } from "@/lib/payment-token";
import PublicPaymentForm from "./public-payment-form";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { generateUpiQrDataUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PublicPayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const billId = verifyPaymentToken(token);
  if (!billId) notFound();

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      carriedForwardTo: { select: { id: true, billNumber: true, status: true } },
      connection: {
        include: { resident: { include: { user: { select: { name: true } } } } },
      },
    },
  });

  if (!bill) notFound();

  const serialized = {
    id: bill.id,
    billNumber: bill.billNumber,
    flatNo: bill.connection.flatNo,
    residentName: bill.connection.resident.user.name ?? "Resident",
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

  const isPaid = bill.status === "PAID";
  // These dues now sit inside a later bill — paying this one would double-charge.
  const carriedForward = bill.status === "CARRIED_FORWARD" ? bill.carriedForwardTo : null;
  const qrCodeDataUrl = isPaid || carriedForward ? "" : await generateUpiQrDataUrl(serialized.totalAmount);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white px-4 py-4">
        <div className="max-w-lg mx-auto">
          <p className="font-bold text-lg">Oasis Venetia Heights</p>
          <p className="text-blue-300 text-xs">Electricity Payment Portal</p>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-8">
        {carriedForward ? (
          <div className="max-w-lg w-full text-center space-y-4 mt-8">
            <div className="flex justify-center">
              <ArrowRight className="h-16 w-16 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Included in a Newer Bill</h1>
            <p className="text-gray-600">
              The amount of bill <strong>{bill.billNumber}</strong> for Flat{" "}
              <strong>{bill.connection.flatNo}</strong> has been carried forward into bill{" "}
              <strong>{carriedForward.billNumber}</strong>. Please pay that bill instead — it
              already includes these dues.
            </p>
            {carriedForward.status !== "PAID" && (
              <a
                href={`/pay/${generatePaymentToken(carriedForward.id)}`}
                className="inline-block rounded-md bg-[#1e3a5f] px-5 py-2.5 text-sm font-medium text-white"
              >
                Pay bill {carriedForward.billNumber}
              </a>
            )}
          </div>
        ) : isPaid ? (
          <div className="max-w-lg w-full text-center space-y-4 mt-8">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Already Paid</h1>
            <p className="text-gray-600">
              Bill <strong>{bill.billNumber}</strong> for Flat{" "}
              <strong>{bill.connection.flatNo}</strong> has already been paid.
            </p>
            <p className="text-sm text-gray-400">
              Due date was {formatDate(bill.dueDate)}
            </p>
          </div>
        ) : (
          <PublicPaymentForm
            bill={serialized}
            qrCodeDataUrl={qrCodeDataUrl}
            token={token}
          />
        )}
      </main>

      <footer className="text-center py-4 text-xs text-gray-400 border-t bg-white">
        Oasis Buildmart India Pvt. Ltd., Plot No-HRA, 12, A, Site-C, Greater Noida – 201306
      </footer>
    </div>
  );
}
