"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, AlertCircle, Building2, Smartphone, MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

type Bill = {
  id: string;
  billNumber: string;
  flatNo: string;
  residentName: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  unitArea: number;
  ratePerSqFt: number;
  amount: number;
  cgstRate: number;
  sgstRate: number;
  cgst: number;
  sgst: number;
  currentMonthTotal: number;
  previousDue: number;
  interestCharge: number;
  paidAmount: number;
  netPayable: number;
  dueDate: string;
  status: string;
};

interface Props { bill: Bill; qrCodeDataUrl: string; }

const BANK = {
  name: "OASIS BUILDMART INDIA PVT LTD",
  bank: "Bank of Baroda",
  account: "88340200001343",
  ifsc: "BARB0DBGREA",
  branch: "Greater Noida",
};

const WHATSAPP = "918588805052";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtINR(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Row({ label, value, highlight, red }: { label: string; value: string; highlight?: boolean; red?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${highlight ? "font-semibold" : ""}`}>
      <span className={`text-sm ${red ? "text-red-600" : highlight ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-sm ${red ? "text-red-600" : highlight ? "text-foreground" : ""}`}>{value}</span>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied!"); }} className="ml-2 text-blue-500 hover:text-blue-700" title="Copy">
      <Copy className="h-3.5 w-3.5 inline" />
    </button>
  );
}

export default function MaintenancePaymentInfo({ bill, qrCodeDataUrl }: Props) {
  const isOverdue = bill.status === "OVERDUE";
  const whatsappMsg = encodeURIComponent(
    `Hi, I have paid Maintenance Bill ${bill.billNumber} for Flat ${bill.flatNo}. Amount: ${fmtINR(bill.netPayable)}. Please confirm and update my payment status.`
  );
  const whatsappUrl = `https://wa.me/${WHATSAPP}?text=${whatsappMsg}`;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pay Maintenance Bill</h1>
        <p className="text-muted-foreground text-sm mt-1">Bill #{bill.billNumber} · Flat {bill.flatNo}</p>
      </div>

      {isOverdue && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>This bill is overdue. Please pay immediately to avoid further interest charges.</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            Bill Breakdown — Maintenance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Row label="Billing Period" value={`${fmt(bill.billingPeriodStart)} – ${fmt(bill.billingPeriodEnd)}`} />
          <Row label="Flat Area" value={`${bill.unitArea} sq.ft @ ₹${bill.ratePerSqFt}/sq.ft`} />
          <Separator className="my-1" />
          <Row label="Maintenance Charge" value={fmtINR(bill.amount)} />
          <Row label={`CGST @ ${bill.cgstRate}%`} value={fmtINR(bill.cgst)} />
          <Row label={`SGST @ ${bill.sgstRate}%`} value={fmtINR(bill.sgst)} />
          <Row label="Total Current Month Bill" value={fmtINR(bill.currentMonthTotal)} highlight />
          {bill.previousDue > 0 && <Row label="Previous Due" value={fmtINR(bill.previousDue)} red />}
          {bill.interestCharge > 0 && <Row label="Interest Charge" value={fmtINR(bill.interestCharge)} red />}
          {bill.paidAmount > 0 && <Row label="Paid Amount" value={`− ${fmtINR(bill.paidAmount)}`} />}
          <Separator className="my-1" />
          <Row label="Net Payable" value={fmtINR(bill.netPayable)} highlight />
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">Due by: {fmt(bill.dueDate)}</span>
            <Badge className={isOverdue ? "bg-red-100 text-red-800 hover:bg-red-100" : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"}>
              {bill.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
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
              <span className="font-medium text-right">{value}<CopyButton value={value} /></span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-blue-900">After making the payment:</p>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Note your transaction ID / UTR number</li>
          <li>Send payment details to our team on WhatsApp</li>
          <li>Our team will update your payment status within 24 hours</li>
        </ol>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 w-fit bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp Payment Confirmation
        </a>
      </div>
    </div>
  );
}
