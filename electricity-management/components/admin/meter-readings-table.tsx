"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, FileText } from "lucide-react";

type SerializedConnection = {
  id: string;
  flatNo: string;
  residentName: string;
  lastNcplReading: string;
  lastDgReading: string;
};

type SerializedReading = {
  id: string;
  flatNo: string;
  residentName: string;
  readingDate: string;
  ncplPrevious: string;
  ncplCurrent: string;
  ncplUnits: string;
  dgUnits: string;
  connectionId: string;
  hasBill: boolean;
};

interface Props {
  connections: SerializedConnection[];
  readings: SerializedReading[];
  dgFixed: number;
}

const today = new Date().toISOString().split("T")[0];

export default function MeterReadingsTable({ connections, readings, dgFixed }: Props) {
  const router = useRouter();

  // Add Reading modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    connectionId: "",
    readingDate: today,
    ncplPrevious: "",
    ncplCurrent: "",
  });

  // Generate Bill modal state
  const [billReading, setBillReading] = useState<SerializedReading | null>(null);
  const [isBillSubmitting, setIsBillSubmitting] = useState(false);
  const [billForm, setBillForm] = useState({
    billDate: today,
    billingPeriodStart: "",
    billingPeriodEnd: "",
    previousDues: "0",
  });

  function handleConnectionChange(connectionId: string | null) {
    if (!connectionId) return;
    const conn = connections.find((c) => c.id === connectionId);
    setAddForm((p) => ({
      ...p,
      connectionId,
      ncplPrevious: conn?.lastNcplReading ?? "0",
    }));
  }

  function closeAddModal() {
    setShowAddModal(false);
    setAddForm({
      connectionId: "",
      readingDate: today,
      ncplPrevious: "",
      ncplCurrent: "",
    });
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.connectionId) {
      toast.error("Please select a flat");
      return;
    }
    const ncplCurrent = Number(addForm.ncplCurrent);
    const ncplPrevious = Number(addForm.ncplPrevious);
    if (ncplCurrent < ncplPrevious) {
      toast.error("Current NPCL reading cannot be less than previous reading");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/meter-readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: addForm.connectionId,
          readingDate: addForm.readingDate,
          ncplPrevious: ncplPrevious,
          ncplCurrent: ncplCurrent,
          dgPrevious: 0,
          dgCurrent: 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to add meter reading");
        return;
      }
      toast.success("Meter reading added successfully");
      closeAddModal();
      router.refresh();
    } catch {
      toast.error("Failed to add meter reading");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string, flatNo: string) {
    const confirmed = window.confirm(
      `Delete meter reading for Flat ${flatNo}? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/meter-readings/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete reading");
        return;
      }
      toast.success("Meter reading deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete reading");
    }
  }

  function openBillModal(reading: SerializedReading) {
    setBillReading(reading);
    const readingDate = new Date(reading.readingDate);
    const periodStart = new Date(readingDate.getFullYear(), readingDate.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const periodEnd = readingDate.toISOString().split("T")[0];
    setBillForm({
      billDate: today,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      previousDues: "0",
    });
  }

  function closeBillModal() {
    setBillReading(null);
    setBillForm({
      billDate: today,
      billingPeriodStart: "",
      billingPeriodEnd: "",
      previousDues: "0",
    });
  }

  async function handleBillSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!billReading) return;
    setIsBillSubmitting(true);
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meterReadingId: billReading.id,
          billDate: billForm.billDate,
          billingPeriodStart: billForm.billingPeriodStart,
          billingPeriodEnd: billForm.billingPeriodEnd,
          previousDues: Number(billForm.previousDues),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to generate bill");
        return;
      }
      toast.success(`Bill generated for Flat ${billReading.flatNo}`);
      closeBillModal();
      router.refresh();
    } catch {
      toast.error("Failed to generate bill");
    } finally {
      setIsBillSubmitting(false);
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{readings.length} recent readings</p>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Meter Reading
        </Button>
      </div>

      {/* Readings Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">Recent Meter Readings</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flat No</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resident</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reading Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">NPCL Previous</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">NPCL Current</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Units</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">DG Units</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bill</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {readings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-muted-foreground">
                      No meter readings yet
                    </td>
                  </tr>
                ) : (
                  readings.map((reading) => (
                    <tr key={reading.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 font-mono text-xs font-medium">
                        {reading.flatNo}
                      </td>
                      <td className="px-4 py-3">{reading.residentName}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(reading.readingDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{reading.ncplPrevious}</td>
                      <td className="px-4 py-3 tabular-nums">{reading.ncplCurrent}</td>
                      <td className="px-4 py-3 tabular-nums font-medium">{reading.ncplUnits}</td>
                      <td className="px-4 py-3 tabular-nums">{reading.dgUnits}</td>
                      <td className="px-4 py-3">
                        {reading.hasBill ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            Generated
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!reading.hasBill && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openBillModal(reading)}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Generate Bill
                            </Button>
                          )}
                          {!reading.hasBill && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              onClick={() => handleDelete(reading.id, reading.flatNo)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Meter Reading Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => { if (!open) closeAddModal(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Meter Reading</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mr-flat">Flat *</Label>
              <Select
                value={addForm.connectionId}
                onValueChange={handleConnectionChange}
              >
                <SelectTrigger id="mr-flat" className="w-full">
                  <SelectValue placeholder="Select flat" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.flatNo} — {c.residentName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mr-date">Reading Date *</Label>
              <Input
                id="mr-date"
                type="date"
                required
                value={addForm.readingDate}
                onChange={(e) => setAddForm((p) => ({ ...p, readingDate: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="mr-ncpl-prev">NPCL Previous Reading *</Label>
                <Input
                  id="mr-ncpl-prev"
                  type="number"
                  required
                  min={0}
                  step={0.01}
                  value={addForm.ncplPrevious}
                  onChange={(e) => setAddForm((p) => ({ ...p, ncplPrevious: e.target.value }))}
                  placeholder="Auto-filled from last reading"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mr-ncpl-curr">NPCL Current Reading *</Label>
                <Input
                  id="mr-ncpl-curr"
                  type="number"
                  required
                  min={0}
                  step={0.01}
                  value={addForm.ncplCurrent}
                  onChange={(e) => setAddForm((p) => ({ ...p, ncplCurrent: e.target.value }))}
                  placeholder="Enter current reading"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>DG Charge (Fixed)</Label>
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground select-none">
                ₹{dgFixed.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — fixed per billing cycle
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAddModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Reading"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generate Bill Modal */}
      <Dialog open={!!billReading} onOpenChange={(open) => { if (!open) closeBillModal(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Generate Bill — Flat {billReading?.flatNo}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBillSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bill-date">Bill Date *</Label>
              <Input
                id="bill-date"
                type="date"
                required
                value={billForm.billDate}
                onChange={(e) => setBillForm((p) => ({ ...p, billDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bill-period-start">Billing Period Start *</Label>
              <Input
                id="bill-period-start"
                type="date"
                required
                value={billForm.billingPeriodStart}
                onChange={(e) => setBillForm((p) => ({ ...p, billingPeriodStart: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bill-period-end">Billing Period End *</Label>
              <Input
                id="bill-period-end"
                type="date"
                required
                value={billForm.billingPeriodEnd}
                onChange={(e) => setBillForm((p) => ({ ...p, billingPeriodEnd: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bill-prev-dues">Previous Dues (Rs.)</Label>
              <Input
                id="bill-prev-dues"
                type="number"
                min={0}
                step={0.01}
                value={billForm.previousDues}
                onChange={(e) => setBillForm((p) => ({ ...p, previousDues: e.target.value }))}
                placeholder="0"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeBillModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={isBillSubmitting}>
                {isBillSubmitting ? "Generating..." : "Generate Bill"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
