"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface MaintenanceBillDetail {
  id: string;
  billNumber: string;
  flatNo: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  unitArea: number;
  ratePerSqFt: string;
  amount: string;
  paidAmount: string;
  interestCharge: string;
  dueDate: string;
  status: string;
  connection: {
    flatNo: string;
    resident: { user: { name: string; email: string } };
  };
}

declare global {
  interface Window { Razorpay: any; }
}

const fmtINR = (v: number | string) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function MaintenancePayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [bill, setBill] = useState<MaintenanceBillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/maintenance/bills/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); } else { setBill(data); }
      })
      .catch(() => setError("Failed to load bill"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const handlePay = async () => {
    if (!bill) return;
    setPaying(true);
    try {
      const orderRes = await fetch("/api/razorpay/maintenance/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceBillId: bill.id }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) { setError(orderData.error ?? "Failed to create order"); setPaying(false); return; }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: "INR",
        name: "Oasis Venetia Heights",
        description: `Maintenance — ${bill.billNumber}`,
        order_id: orderData.orderId,
        prefill: {
          name: bill.connection.resident.user.name,
          email: bill.connection.resident.user.email,
        },
        theme: { color: "#1e3a5f" },
        handler: async (response: any) => {
          const verifyRes = await fetch("/api/razorpay/maintenance/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              maintenanceBillId: bill.id,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            setPaid(true);
          } else {
            setError("Payment verification failed. Contact support.");
          }
          setPaying(false);
        },
        modal: { ondismiss: () => setPaying(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch { setError("Network error"); setPaying(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );

  if (error) return (
    <div className="max-w-md mx-auto mt-8">
      <Card className="border-red-200">
        <CardContent className="p-6 text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <p className="text-red-700 font-medium">{error}</p>
          <Button variant="outline" onClick={() => router.push("/resident/maintenance")}>Back to Bills</Button>
        </CardContent>
      </Card>
    </div>
  );

  if (paid) return (
    <div className="max-w-md mx-auto mt-8">
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
          <div>
            <p className="text-xl font-bold text-green-800">Payment Successful!</p>
            <p className="text-sm text-green-700 mt-1">Your maintenance bill has been paid.</p>
          </div>
          <Button onClick={() => router.push("/resident/maintenance")} className="bg-green-600 hover:bg-green-700">
            View All Bills
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  if (!bill) return null;

  const totalDue = Number(bill.amount) + Number(bill.interestCharge) - Number(bill.paidAmount);
  const hasInterest = Number(bill.interestCharge) > 0;

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pay Maintenance Bill</h1>
        <p className="text-sm text-gray-500 mt-1">Secure payment via Razorpay</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>{bill.billNumber}</span>
            <Badge className={bill.status === "OVERDUE" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}>
              {bill.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-500">Flat</span>
            <span className="font-medium">{bill.connection.flatNo}</span>
            <span className="text-gray-500">Billing Period</span>
            <span>{fmtDate(bill.billingPeriodStart)} – {fmtDate(bill.billingPeriodEnd)}</span>
            <span className="text-gray-500">Unit Area</span>
            <span>{bill.unitArea} sq ft</span>
            <span className="text-gray-500">Rate</span>
            <span>₹{Number(bill.ratePerSqFt).toFixed(2)} per sq ft</span>
            <span className="text-gray-500">Maintenance</span>
            <span className="font-medium">{fmtINR(bill.amount)}</span>
            {hasInterest && (
              <>
                <span className="text-gray-500">Interest (24% p.a.)</span>
                <span className="text-red-600 font-medium">{fmtINR(bill.interestCharge)}</span>
              </>
            )}
            {Number(bill.paidAmount) > 0 && (
              <>
                <span className="text-gray-500">Already Paid</span>
                <span className="text-green-600">– {fmtINR(bill.paidAmount)}</span>
              </>
            )}
            <span className="text-gray-500">Due Date</span>
            <span className={bill.status === "OVERDUE" ? "text-red-600 font-medium" : ""}>{fmtDate(bill.dueDate)}</span>
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-gray-700">Total Payable</span>
              <span className="text-2xl font-bold text-gray-900">{fmtINR(totalDue)}</span>
            </div>
          </div>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-5"
            onClick={handlePay}
            disabled={paying}
          >
            {paying ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing…</>
            ) : (
              <><CreditCard className="h-4 w-4 mr-2" />Pay {fmtINR(totalDue)}</>
            )}
          </Button>
          <p className="text-xs text-center text-gray-400">UPI · Cards · Net Banking · Wallets</p>
        </CardContent>
      </Card>
    </div>
  );
}
