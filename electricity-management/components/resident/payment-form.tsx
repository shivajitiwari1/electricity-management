"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, AlertCircle, Building2, Smartphone, MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

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
  qrCodeDataUrl: string;
}

const BANK = {
  name: "OASIS BUILDMART INDIA PVT LTD",
  bank: "Bank of Baroda",
  account: "88340200001343",
  ifsc: "BARB0DBGREA",
  branch: "Greater Noida",
};

const WHATSAPP = "918826700991";

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

function BillRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${highlight ? "font-semibold text-foreground" : "text-foreground"}`}>
      <span className={highlight ? "text-base" : "text-sm"}>{label}</span>
      <span className={highlight ? "text-base" : "text-sm"}>{value}</span>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied!"); }}
      className="ml-2 text-blue-500 hover:text-blue-700"
      title="Copy"
    >
      <Copy className="h-3.5 w-3.5 inline" />
    </button>
  );
}

export default function PaymentForm({ bill, qrCodeDataUrl }: Props) {
  const isOverdue = bill.status === "OVERDUE";

  const whatsappMsg = encodeURIComponent(
    `Hi, I have paid Electricity Bill ${bill.billNumber} for Flat ${bill.flatNo}. Amount: ${formatINR(bill.totalAmount)}. Please confirm and update my payment status.`
  );
  const whatsappUrl = `https://wa.me/${WHATSAPP}?text=${whatsappMsg}`;

  return (
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
          <span>This bill is overdue. Please pay immediately to avoid service disruption.</span>
        </div>
      )}

      {/* Bill Summary */}
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

      {/* UPI QR Code */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-green-600" />
            Pay via UPI
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Image src={qrCodeDataUrl} alt="UPI QR Code" width={200} height={200} className="rounded-lg border" unoptimized />
          <p className="text-sm text-center text-muted-foreground">
            Scan with <span className="font-medium">PhonePe, Google Pay, BHIM, Paytm</span> or any UPI app
          </p>
          <div className="bg-gray-50 border rounded-md px-4 py-2 text-sm font-mono text-center">
            oasis88268343@barodampay
            <CopyButton value="oasis88268343@barodampay" />
          </div>
        </CardContent>
      </Card>

      {/* Bank Transfer */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            Pay via Net Banking / NEFT / IMPS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            { label: "Account Name", value: BANK.name },
            { label: "Bank", value: BANK.bank },
            { label: "Account No", value: BANK.account },
            { label: "IFSC Code", value: BANK.ifsc },
            { label: "Branch", value: BANK.branch },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between">
              <span className="text-muted-foreground w-32 shrink-0">{label}</span>
              <span className="font-medium text-right">
                {value}
                <CopyButton value={value} />
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* After Payment Instructions */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-blue-900">After making the payment:</p>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Note your transaction ID / UTR number</li>
          <li>Send payment details to the number below on WhatsApp</li>
          <li>Our team will update your payment status within 24 hours</li>
        </ol>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors text-sm"
        >
          <MessageCircle className="h-4 w-4" />
          Share Payment Details on WhatsApp
        </a>
        <p className="text-xs text-center text-blue-700">
          WhatsApp: <strong>+91 88267 00991</strong>
        </p>
      </div>

      {/* Credit card note */}
      <p className="text-center text-sm text-muted-foreground pb-2">
        To pay by <strong>credit card</strong>, visit the maintenance office in person.
      </p>
    </div>
  );
}
