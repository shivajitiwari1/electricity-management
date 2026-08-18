"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileDown, CheckCircle2, AlertCircle, Clock } from "lucide-react";

type MaintenanceBill = {
  id: string;
  billNumber: string;
  flatNo: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  unitArea: number;
  ratePerSqFt: number;
  amount: number;
  previousDue: number;
  interestCharge: number;
  paidAmount: number;
  dueDate: string;
  billDate: string;
  status: string;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "PAID")
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 flex items-center gap-1 w-fit"><CheckCircle2 className="h-3 w-3" />PAID</Badge>;
  if (status === "OVERDUE")
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1 w-fit"><AlertCircle className="h-3 w-3" />OVERDUE</Badge>;
  if (status === "PARTIAL")
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 flex items-center gap-1 w-fit"><Clock className="h-3 w-3" />PARTIAL</Badge>;
  return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 flex items-center gap-1 w-fit"><Clock className="h-3 w-3" />PENDING</Badge>;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtINR(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function period(start: string, end: string) {
  return `${new Date(start).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;
}

interface Props { bills: MaintenanceBill[]; }

export default function ResidentMaintenanceBillsList({ bills }: Props) {
  if (bills.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No maintenance bills found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {bills.map((bill) => {
        const remaining = bill.amount + bill.previousDue + bill.interestCharge - bill.paidAmount;
        return (
          <Card key={bill.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-blue-600">{bill.billNumber}</span>
                    <StatusBadge status={bill.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {period(bill.billingPeriodStart, bill.billingPeriodEnd)} &nbsp;·&nbsp; {bill.unitArea} sq.ft @ ₹{bill.ratePerSqFt}/sq.ft
                  </p>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>Due: {fmt(bill.dueDate)}</span>
                    {bill.previousDue > 0 && <span className="text-red-500">Prev. Due: {fmtINR(bill.previousDue)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold">{fmtINR(bill.amount)}</p>
                  {bill.status !== "PAID" && remaining > 0 && (
                    <p className="text-xs text-red-500">Balance: {fmtINR(remaining)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`/api/maintenance/bills/${bill.id}/pdf`, "_blank")}
                >
                  <FileDown className="h-3.5 w-3.5 mr-1" />
                  Download PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
