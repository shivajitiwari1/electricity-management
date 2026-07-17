"use client";

import Script from "next/script";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

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
  token: string;
  razorpayKeyId: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function BillRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${highlight ? "font-semibold text-foreground" : "text-foreground"}`}>
      <span className={highlight ? "text-base" : "text-sm"}>{label}</span>
      <span className={highlight ? "text-base" : "text-sm"}>{value}</span>
    </div>
  );
}

const isTestMode = (key: string) => !key || key.includes("REPLACE") || key.trim() === "";

export default function PublicPaymentForm({ bill, token, razorpayKeyId }: Props) {
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const testMode = isTestMode(razorpayKeyId);
  const isOverdue = bill.status === "OVERDUE";

  async function handleTestPay() {
    setLoading(true);
    try {
      const res = await fetch("/api/public-pay/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) {
        setReceiptNumber(data.receiptNumber);
        setPaymentId(data.paymentId);
        setPaid(true);
      } else {
        toast.error(data.error ?? "Payment failed");
        setLoading(false);
      }
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  async function handlePayNow() {
    setLoading(true);
    try {
      const orderRes = await fetch("/api/public-pay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!orderRes.ok) {
        const err = await orderRes.json();
        toast.error(err.error ?? "Failed to create order");
        setLoading(false);
        return;
      }
      const orderData = await orderRes.json();

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
          try {
            const verifyRes = await fetch("/api/public-pay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const data = await verifyRes.json();
            if (verifyRes.ok) {
              setReceiptNumber(data.receiptNumber);
              setPaymentId(data.paymentId);
              setPaid(true);
            } else {
              toast.error(data.error ?? "Verification failed");
              setLoading(false);
            }
          } catch {
            toast.error("Verification failed. Please contact support.");
            setLoading(false);
          }
        },
        prefill: { name: bill.residentName },
        theme: { color: "#1e40af" },
        modal: { ondismiss: () => setLoading(false) },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (paid) {
    return (
      <div className="max-w-lg w-full text-center space-y-4 mt-4">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Payment Successful!</h1>
        <p className="text-gray-600">
          Thank you, <strong>{bill.residentName}</strong>. Your payment for Flat{" "}
          <strong>{bill.flatNo}</strong> has been received.
        </p>
        {receiptNumber && (
          <p className="text-sm text-gray-500">Receipt No: <strong>{receiptNumber}</strong></p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          {paymentId && (
            <a
              href={`/api/pdf/receipt/${paymentId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-green-700"
            >
              Download Receipt PDF
            </a>
          )}
        </div>
        <p className="text-xs text-gray-400 pt-2">A confirmation email has been sent to your registered email address.</p>
      </div>
    );
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="max-w-lg w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pay Electricity Bill</h1>
          <p className="text-gray-500 text-sm mt-1">
            Bill #{bill.billNumber} · Flat {bill.flatNo} · {bill.residentName}
          </p>
        </div>

        {isOverdue && (
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>This bill is overdue. Please pay immediately to avoid service disruption.</span>
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Bill Breakdown — Oasis Venetia Heights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between py-2 text-sm text-muted-foreground">
              <span>Billing Period</span>
              <span>{formatDate(bill.billingPeriodStart)} – {formatDate(bill.billingPeriodEnd)}</span>
            </div>
            <div className="flex items-center justify-between py-2 text-sm text-muted-foreground">
              <span>NPCL Units Consumed</span>
              <span>{bill.ncplUnits} kWh @ ₹{bill.ratePerUnit.toFixed(2)}/unit</span>
            </div>
            <Separator className="my-1" />
            <BillRow label="NPCL Energy Charge" value={formatINR(bill.ncplCharge)} />
            <BillRow label="DG Charge" value={formatINR(bill.dgCharge)} />
            <BillRow label="Fixed Charge" value={formatINR(bill.fixedCharge)} />
            {bill.previousDues > 0 && (
              <BillRow label="Previous Dues" value={formatINR(bill.previousDues)} />
            )}
            <Separator className="my-1" />
            <BillRow label="Total Amount Due" value={formatINR(bill.totalAmount)} highlight />
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">Due by: {formatDate(bill.dueDate)}</span>
              <Badge className={isOverdue ? "bg-red-100 text-red-800 hover:bg-red-100" : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"}>
                {bill.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {testMode ? (
          <>
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <span className="font-semibold">🧪 Test Mode</span>
              <span>— Clicking below simulates a successful payment.</span>
            </div>
            <Button size="lg" className="w-full bg-amber-500 hover:bg-amber-600 text-white text-base py-6" disabled={loading} onClick={handleTestPay}>
              <CreditCard className="h-5 w-5 mr-2" />
              {loading ? "Processing..." : `Simulate Payment — ${formatINR(bill.totalAmount)}`}
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6" disabled={loading} onClick={handlePayNow}>
              <CreditCard className="h-5 w-5 mr-2" />
              {loading ? "Processing..." : `Pay ${formatINR(bill.totalAmount)} via Razorpay`}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Secured by Razorpay · Supports UPI, Net Banking, Cards &amp; Wallets
            </p>
          </>
        )}
      </div>
    </>
  );
}
