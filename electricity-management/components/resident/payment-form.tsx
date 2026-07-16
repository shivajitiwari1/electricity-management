"use client";

import Script from "next/script";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, FileText, AlertCircle } from "lucide-react";

type SerializedBill = {
  id: string;
  billNumber: string;
  flatNo: string;
  residentName: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  ncplUnits: number;
  ratePerUnit: number;
  ncplCharge: number;
  dgCharge: number;
  fixedCharge: number;
  previousDues: number;
  totalAmount: number;
  dueDate: string;
  status: string;
};

interface Props {
  bill: SerializedBill;
  razorpayKeyId: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function BillRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${highlight ? "font-semibold text-foreground" : "text-foreground"}`}
    >
      <span className={highlight ? "text-base" : "text-sm"}>{label}</span>
      <span className={highlight ? "text-base" : "text-sm"}>{value}</span>
    </div>
  );
}

export default function PaymentForm({ bill, razorpayKeyId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handlePayNow() {
    setLoading(true);
    try {
      // Step 1: Create Razorpay order
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId: bill.id }),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json();
        toast.error(errData.error ?? "Failed to create payment order");
        return;
      }

      const orderData = await orderRes.json();

      // Step 2: Open Razorpay modal
      const options = {
        key: razorpayKeyId,
        amount: orderData.amount,
        currency: "INR",
        name: "Oasis Venetia Heights",
        description: `Electricity Bill ${bill.billNumber}`,
        order_id: orderData.orderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // Step 3: Verify payment
          try {
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                billId: bill.id,
              }),
            });
            if (verifyRes.ok) {
              toast.success("Payment successful!");
              router.push("/resident/payments");
            } else {
              const err = await verifyRes.json();
              toast.error(err.error ?? "Payment verification failed");
              setLoading(false);
            }
          } catch {
            toast.error("Verification failed. Please contact support.");
            setLoading(false);
          }
        },
        prefill: { name: bill.residentName },
        theme: { color: "#1e40af" },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const isOverdue = bill.status === "OVERDUE";

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pay Bill</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bill #{bill.billNumber} · Flat {bill.flatNo}
          </p>
        </div>

        {/* Overdue Warning */}
        {isOverdue && (
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              This bill is overdue. Please pay immediately to avoid service
              disruption.
            </span>
          </div>
        )}

        {/* Bill Summary Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Bill Breakdown — Oasis Venetia Heights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {/* Billing Period */}
            <div className="flex items-center justify-between py-2 text-sm text-muted-foreground">
              <span>Billing Period</span>
              <span>
                {formatDate(bill.billingPeriodStart)} –{" "}
                {formatDate(bill.billingPeriodEnd)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 text-sm text-muted-foreground">
              <span>NPCL Units Consumed</span>
              <span>{bill.ncplUnits} kWh @ ₹{bill.ratePerUnit.toFixed(2)}/unit</span>
            </div>

            <Separator className="my-1" />

            {/* Charges */}
            <BillRow
              label="NPCL Energy Charge"
              value={formatINR(bill.ncplCharge)}
            />
            <BillRow label="DG Charge" value={formatINR(bill.dgCharge)} />
            <BillRow
              label="Fixed Charge"
              value={formatINR(bill.fixedCharge)}
            />
            {bill.previousDues > 0 && (
              <BillRow
                label="Previous Dues"
                value={formatINR(bill.previousDues)}
              />
            )}

            <Separator className="my-1" />

            {/* Total */}
            <BillRow
              label="Total Amount Due"
              value={formatINR(bill.totalAmount)}
              highlight
            />

            {/* Due Date & Status */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Due by: {formatDate(bill.dueDate)}
              </span>
              <Badge
                className={
                  isOverdue
                    ? "bg-red-100 text-red-800 hover:bg-red-100"
                    : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                }
              >
                {bill.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Pay Button */}
        <Button
          size="lg"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6"
          disabled={loading}
          onClick={handlePayNow}
        >
          <CreditCard className="h-5 w-5 mr-2" />
          {loading
            ? "Processing..."
            : `Pay ${formatINR(bill.totalAmount)} via Razorpay`}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Secured by Razorpay · Supports UPI, Net Banking, Cards & Wallets
        </p>
      </div>
    </>
  );
}
