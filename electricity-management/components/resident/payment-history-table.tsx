"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";

type ResidentPayment = {
  id: string;
  receiptNumber: string;
  billNumber: string;
  flatNo: string;
  amount: number;
  paymentDate: string;
  method: string;
  razorpayPaymentId: string | null;
  status: string;
};

interface Props {
  payments: ResidentPayment[];
}

function MethodBadge({ method }: { method: string }) {
  if (method === "ONLINE") {
    return (
      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
        ONLINE
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">CASH</Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS") {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        SUCCESS
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">FAILED</Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
      INITIATED
    </Badge>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PaymentHistoryTable({ payments }: Props) {
  const [filterMethod, setFilterMethod] = useState("all");

  const filtered = useMemo(() => {
    if (filterMethod === "all") return payments;
    return payments.filter((p) => p.method === filterMethod);
  }, [payments, filterMethod]);

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Method</span>
          <Select
            value={filterMethod}
            onValueChange={(val) => setFilterMethod(val ?? "all")}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ONLINE">ONLINE</SelectItem>
              <SelectItem value="CASH">CASH</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filterMethod !== "all" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterMethod("all")}
          >
            Clear Filter
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">
            {filtered.length} Payment{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Receipt #
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Bill #
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Amount (₹)
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Method
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Transaction ID
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-10 text-gray-400"
                    >
                      No payments found
                    </td>
                  </tr>
                ) : (
                  filtered.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {payment.receiptNumber}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {payment.billNumber}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {payment.amount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {formatDate(payment.paymentDate)}
                      </td>
                      <td className="px-4 py-3">
                        <MethodBadge method={payment.method} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {payment.razorpayPaymentId ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(`/api/pdf/receipt/${payment.id}`)
                          }
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Receipt
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
