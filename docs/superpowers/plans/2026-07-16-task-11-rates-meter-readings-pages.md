# Task 11: Admin Pages for Rates and Meter Readings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create server-rendered admin pages and client-side interactive components for managing electricity rates and meter readings in the Oasis Venetia Heights system.

**Architecture:** Two server components fetch Prisma data, serialize Decimal fields to strings, then pass serialized props to two client components. The client components own all modals, forms, and API calls. The meter readings component also embeds a Generate Bill modal that calls POST /api/bills.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, Shadcn UI (Button, Card, Dialog, Input, Label, Select, Badge), lucide-react, sonner toast, Prisma (server-side only)

## Global Constraints

- No react-hook-form — use plain `useState`
- All Prisma Decimal fields must be serialized with `.toString()` before passing to client components
- Toast: `import { toast } from "sonner"`
- After mutations: call `router.refresh()` from `next/navigation`
- Icons: lucide-react only
- Auth: `import { auth } from "@/auth"` — server components only, not needed in client components (API routes already guard auth)
- `export const dynamic = "force-dynamic"` on both server page components

---

### Task 1: Rates Server Page (`app/(admin)/rates/page.tsx`)

**Files:**
- Create: `electricity-management/app/(admin)/rates/page.tsx`

**Interfaces:**
- Produces: props to `RatesTable` — `rates: SerializedRate[]`

```typescript
type SerializedRate = {
  id: string;
  ncplPerUnit: string;
  dgFixed: string;
  fixedPerKw: string;
  effectiveFrom: string; // ISO string
};
```

- [ ] **Step 1: Create the server page**

```typescript
// electricity-management/app/(admin)/rates/page.tsx
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import RatesTable from "@/components/admin/rates-table";

export default async function RatesPage() {
  const rates = await prisma.rate.findMany({
    orderBy: { effectiveFrom: "desc" },
  });

  const serializedRates = rates.map((r) => ({
    id: r.id,
    ncplPerUnit: r.ncplPerUnit.toString(),
    dgFixed: r.dgFixed.toString(),
    fixedPerKw: r.fixedPerKw.toString(),
    effectiveFrom: r.effectiveFrom.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Electricity Rates</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage NPCL and DG electricity rates
        </p>
      </div>
      <RatesTable rates={serializedRates} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript sees no errors in this file**

Run: `cd electricity-management && npx tsc --noEmit 2>&1 | head -30`
Expected: Either 0 errors or only errors in files not yet created (RatesTable missing).

---

### Task 2: Rates Client Component (`components/admin/rates-table.tsx`)

**Files:**
- Create: `electricity-management/components/admin/rates-table.tsx`

**Interfaces:**
- Consumes: `rates: SerializedRate[]` from Task 1
- Produces: Nothing (leaf UI component)

- [ ] **Step 1: Create the RatesTable client component**

```typescript
// electricity-management/components/admin/rates-table.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus } from "lucide-react";

type SerializedRate = {
  id: string;
  ncplPerUnit: string;
  dgFixed: string;
  fixedPerKw: string;
  effectiveFrom: string;
};

interface Props {
  rates: SerializedRate[];
}

export default function RatesTable({ rates }: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    ncplPerUnit: "",
    dgFixed: "",
    fixedPerKw: "",
  });

  const current = rates[0];

  function closeModal() {
    setShowModal(false);
    setForm({ ncplPerUnit: "", dgFixed: "", fixedPerKw: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ncplPerUnit: Number(form.ncplPerUnit),
          dgFixed: Number(form.dgFixed),
          fixedPerKw: Number(form.fixedPerKw),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update rates");
        return;
      }
      toast.success("Rates updated successfully");
      closeModal();
      router.refresh();
    } catch {
      toast.error("Failed to update rates");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* Current Rate Card */}
      {current ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Current Rate</CardTitle>
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Update Rates
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">NPCL / Unit</p>
                <p className="text-2xl font-bold text-gray-900">₹{current.ncplPerUnit}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">DG Fixed Charge</p>
                <p className="text-2xl font-bold text-gray-900">₹{current.dgFixed}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Fixed / kW</p>
                <p className="text-2xl font-bold text-gray-900">₹{current.fixedPerKw}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Effective From</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {new Date(current.effectiveFrom).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500 mb-4">No rates configured yet.</p>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Set Initial Rates
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rate History Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">Rate History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Effective From</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">NPCL / Unit (₹)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">DG Fixed (₹)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fixed / kW (₹)</th>
                </tr>
              </thead>
              <tbody>
                {rates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-gray-400">
                      No rate history
                    </td>
                  </tr>
                ) : (
                  rates.map((rate, idx) => (
                    <tr key={rate.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {new Date(rate.effectiveFrom).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                        {idx === 0 && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">₹{rate.ncplPerUnit}</td>
                      <td className="px-4 py-3">₹{rate.dgFixed}</td>
                      <td className="px-4 py-3">₹{rate.fixedPerKw}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Update Rates Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Electricity Rates</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="ncplPerUnit">NPCL Per Unit (₹) *</Label>
              <Input
                id="ncplPerUnit"
                type="number"
                required
                min={0}
                step={0.01}
                value={form.ncplPerUnit}
                onChange={(e) => setForm((p) => ({ ...p, ncplPerUnit: e.target.value }))}
                placeholder="e.g. 8.50"
              />
            </div>
            <div>
              <Label htmlFor="dgFixed">DG Fixed Charge (₹) *</Label>
              <Input
                id="dgFixed"
                type="number"
                required
                min={0}
                step={0.01}
                value={form.dgFixed}
                onChange={(e) => setForm((p) => ({ ...p, dgFixed: e.target.value }))}
                placeholder="e.g. 1500"
              />
            </div>
            <div>
              <Label htmlFor="fixedPerKw">Fixed Charge Per kW (₹) *</Label>
              <Input
                id="fixedPerKw"
                type="number"
                required
                min={0}
                step={0.01}
                value={form.fixedPerKw}
                onChange={(e) => setForm((p) => ({ ...p, fixedPerKw: e.target.value }))}
                placeholder="e.g. 250"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Rates"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd electricity-management && npx tsc --noEmit 2>&1 | head -30`
Expected: Errors only in meter-readings files (not yet created), zero errors in rates files.

- [ ] **Step 3: Commit**

```bash
git add electricity-management/app/(admin)/rates/page.tsx electricity-management/components/admin/rates-table.tsx
git commit -m "feat: admin rates page with current rate card and history table"
```

---

### Task 3: Meter Readings Server Page (`app/(admin)/meter-readings/page.tsx`)

**Files:**
- Create: `electricity-management/app/(admin)/meter-readings/page.tsx`

**Interfaces:**
- Produces props to `MeterReadingsTable`:
  - `connections: SerializedConnection[]`
  - `readings: SerializedReading[]`

```typescript
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
```

- [ ] **Step 1: Create the server page**

```typescript
// electricity-management/app/(admin)/meter-readings/page.tsx
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import MeterReadingsTable from "@/components/admin/meter-readings-table";

export default async function MeterReadingsPage() {
  const connections = await prisma.connection.findMany({
    where: { status: "ACTIVE" },
    include: {
      resident: { include: { user: { select: { name: true } } } },
      meterReadings: {
        orderBy: { readingDate: "desc" },
        take: 1,
      },
    },
    orderBy: { flatNo: "asc" },
  });

  const serializedConnections = connections.map((c) => ({
    id: c.id,
    flatNo: c.flatNo,
    residentName: c.resident.user.name,
    lastNcplReading: c.meterReadings[0]?.ncplCurrent?.toString() ?? "0",
    lastDgReading: c.meterReadings[0]?.dgCurrent?.toString() ?? "0",
  }));

  const readings = await prisma.meterReading.findMany({
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { readingDate: "desc" },
    take: 50,
  });

  const serializedReadings = readings.map((r) => ({
    id: r.id,
    flatNo: r.connection.flatNo,
    residentName: r.connection.resident.user.name,
    readingDate: r.readingDate.toISOString(),
    ncplPrevious: r.ncplPrevious.toString(),
    ncplCurrent: r.ncplCurrent.toString(),
    ncplUnits: r.ncplUnits.toString(),
    dgUnits: r.dgUnits.toString(),
    connectionId: r.connectionId,
    hasBill: !!r.bill,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meter Readings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Record and manage electricity meter readings
        </p>
      </div>
      <MeterReadingsTable
        connections={serializedConnections}
        readings={serializedReadings}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd electricity-management && npx tsc --noEmit 2>&1 | head -30`
Expected: Errors only in MeterReadingsTable (not yet created), none in this file.

---

### Task 4: Meter Readings Client Component (`components/admin/meter-readings-table.tsx`)

**Files:**
- Create: `electricity-management/components/admin/meter-readings-table.tsx`

**Interfaces:**
- Consumes: `connections: SerializedConnection[]`, `readings: SerializedReading[]` from Task 3
- Produces: Nothing (leaf UI)

- [ ] **Step 1: Create the MeterReadingsTable client component**

```typescript
// electricity-management/components/admin/meter-readings-table.tsx
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
}

const today = new Date().toISOString().split("T")[0];

export default function MeterReadingsTable({ connections, readings }: Props) {
  const router = useRouter();

  // Add Reading modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    connectionId: "",
    readingDate: today,
    ncplPrevious: "",
    ncplCurrent: "",
    dgPrevious: "",
    dgCurrent: "",
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

  function handleConnectionChange(connectionId: string) {
    const conn = connections.find((c) => c.id === connectionId);
    setAddForm((p) => ({
      ...p,
      connectionId,
      ncplPrevious: conn?.lastNcplReading ?? "0",
      dgPrevious: conn?.lastDgReading ?? "0",
    }));
  }

  function closeAddModal() {
    setShowAddModal(false);
    setAddForm({
      connectionId: "",
      readingDate: today,
      ncplPrevious: "",
      ncplCurrent: "",
      dgPrevious: "",
      dgCurrent: "",
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
          dgPrevious: addForm.dgPrevious ? Number(addForm.dgPrevious) : 0,
          dgCurrent: addForm.dgCurrent ? Number(addForm.dgCurrent) : 0,
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
    // Default billing period: first of reading month to reading date
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
        <p className="text-sm text-gray-500">{readings.length} recent readings</p>
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
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Flat No</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Resident</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Reading Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">NPCL Previous</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">NPCL Current</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Units</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">DG Units</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Bill</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {readings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-gray-400">
                      No meter readings yet
                    </td>
                  </tr>
                ) : (
                  readings.map((reading) => (
                    <tr key={reading.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-medium">
                        {reading.flatNo}
                      </td>
                      <td className="px-4 py-3">{reading.residentName}</td>
                      <td className="px-4 py-3 text-gray-600">
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
            <div>
              <Label htmlFor="mr-flat">Flat *</Label>
              <Select
                value={addForm.connectionId}
                onValueChange={handleConnectionChange}
              >
                <SelectTrigger id="mr-flat">
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
            <div>
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
              <div>
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
              <div>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mr-dg-prev">DG Previous (optional)</Label>
                <Input
                  id="mr-dg-prev"
                  type="number"
                  min={0}
                  step={0.01}
                  value={addForm.dgPrevious}
                  onChange={(e) => setAddForm((p) => ({ ...p, dgPrevious: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="mr-dg-curr">DG Current (optional)</Label>
                <Input
                  id="mr-dg-curr"
                  type="number"
                  min={0}
                  step={0.01}
                  value={addForm.dgCurrent}
                  onChange={(e) => setAddForm((p) => ({ ...p, dgCurrent: e.target.value }))}
                  placeholder="0"
                />
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
            <div>
              <Label htmlFor="bill-date">Bill Date *</Label>
              <Input
                id="bill-date"
                type="date"
                required
                value={billForm.billDate}
                onChange={(e) => setBillForm((p) => ({ ...p, billDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="bill-period-start">Billing Period Start *</Label>
              <Input
                id="bill-period-start"
                type="date"
                required
                value={billForm.billingPeriodStart}
                onChange={(e) => setBillForm((p) => ({ ...p, billingPeriodStart: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="bill-period-end">Billing Period End *</Label>
              <Input
                id="bill-period-end"
                type="date"
                required
                value={billForm.billingPeriodEnd}
                onChange={(e) => setBillForm((p) => ({ ...p, billingPeriodEnd: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="bill-prev-dues">Previous Dues (₹)</Label>
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
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd electricity-management && npx tsc --noEmit 2>&1`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add electricity-management/app/(admin)/meter-readings/page.tsx electricity-management/components/admin/meter-readings-table.tsx
git commit -m "feat: admin meter readings page with add reading and generate bill modals"
```

---

### Task 5: Verification

- [ ] **Step 1: Full TypeScript check**

Run: `cd electricity-management && npx tsc --noEmit 2>&1`
Expected: 0 errors

- [ ] **Step 2: Write task report**

Write to `E:\Demo Website\Electricity Bill\.superpowers\sdd\task-11-report.md`:

```markdown
## Task 11 Report

Status: DONE
Summary: Created admin rates page (server + client) and admin meter readings page (server + client) with add-reading modal (flat selector with auto-fill previous readings) and generate-bill modal.
Concerns: None
```
