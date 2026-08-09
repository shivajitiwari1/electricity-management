# Maintenance Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sidebar submenu, per-bill PDF download, Excel export, maintenance bills in History dialog, maintenance payments page, and advance payment recording to the maintenance admin module.

**Architecture:** All changes are in the Next.js App Router project at `electricity-management/`. UI components are client components in `components/admin/`; API routes are server-side in `app/api/`. PDFKit generates PDFs server-side; ExcelJS generates Excel client-side (dynamic import). The advance payment API reuses `generateMaintenanceBillNumber` and `nextMaintenanceReceiptNumber` from `lib/maintenance-billing.ts`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Shadcn UI, PDFKit (server PDF), ExcelJS (client Excel), Prisma ORM, NextAuth v5.

## Global Constraints

- All file paths are relative to `electricity-management/`
- Bill number format: `OM-${flatNo}-${YYYYMM}` (from `generateMaintenanceBillNumber` in `lib/maintenance-billing.ts`)
- Receipt number format: `MRCPT-YYYYMMDD-XXXX` (from `nextMaintenanceReceiptNumber` in `lib/maintenance-billing.ts`)
- Navy brand colour: `#1e3a5f` / ARGB `FF1E3A5F`
- Permission gate: `guardPermission(session, "maintenance", "canRead"|"canWrite")` from `lib/permissions.ts`
- Auth check: `const session = await auth(); const isAdmin = (session?.user as any)?.role === "ADMIN"`
- Deploy after every task: `npx vercel --prod` from within `electricity-management/`
- Already done: current-month default + due amount column in `components/admin/maintenance-bills-table.tsx`

---

## File Map

| File | Action |
|---|---|
| `components/admin/sidebar-nav.tsx` | Modify — add expandable Maintenance group |
| `app/(admin)/admin/maintenance/page.tsx` | Modify — remove Manage Rates + Scheduler buttons |
| `app/(admin)/admin/maintenance/payments/page.tsx` | **Create** — maintenance payments list page |
| `components/admin/maintenance-payments-table.tsx` | **Create** — payments table client component |
| `lib/pdf.ts` | Modify — add `generateMaintenanceBillPdf()` |
| `app/api/maintenance/bills/[id]/pdf/route.ts` | **Create** — PDF GET handler |
| `components/admin/maintenance-bills-table.tsx` | Modify — add PDF button + Excel export + Advance Pay dialog |
| `app/api/maintenance/bills/advance/route.ts` | **Create** — advance payment POST handler |
| `components/admin/residents-table.tsx` | Modify — add maintenance bills fetch + dialog section + Excel sheet |

---

## Task 1: Sidebar Submenu + Maintenance Page Cleanup + Payments Page

**Files:**
- Modify: `components/admin/sidebar-nav.tsx`
- Modify: `app/(admin)/admin/maintenance/page.tsx`
- Create: `app/(admin)/admin/maintenance/payments/page.tsx`
- Create: `components/admin/maintenance-payments-table.tsx`

**Interfaces:**
- Produces: `MaintenancePaymentsTable` component used by the new payments page

- [ ] **Step 1: Add the Maintenance submenu to sidebar-nav.tsx**

Open `components/admin/sidebar-nav.tsx`. Replace the entire file with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Plug, Gauge, FileText,
  CreditCard, BarChart3, Settings, LogOut, Menu,
  Zap, Building2, ShieldCheck, UserCog, Wrench,
  ChevronDown, ChevronRight, Receipt, Calendar, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import type { PermissionsMap } from "@/lib/permissions";

const NAV_ITEMS = [
  { href: "/admin/dashboard",      label: "Dashboard",     icon: LayoutDashboard, pageId: "dashboard" },
  { href: "/admin/residents",      label: "Residents",     icon: Users,           pageId: "residents" },
  { href: "/admin/connections",    label: "Connections",   icon: Plug,            pageId: "connections" },
  { href: "/admin/meter-readings", label: "Meter Readings",icon: Gauge,           pageId: "meter-readings" },
  { href: "/admin/bills",          label: "Bills",         icon: FileText,        pageId: "bills" },
  { href: "/admin/payments",       label: "Payments",      icon: CreditCard,      pageId: "payments" },
  { href: "/admin/reports",        label: "Reports",       icon: BarChart3,       pageId: "reports" },
  { href: "/admin/rates",          label: "Rates",         icon: Settings,        pageId: "rates" },
  { href: "/admin/flats",          label: "Flat Info",     icon: Building2,       pageId: "flat-info" },
];

const MAINTENANCE_SUB_ITEMS = [
  { href: "/admin/maintenance",          label: "Bills",     icon: FileText  },
  { href: "/admin/maintenance/rates",    label: "Rates",     icon: Settings  },
  { href: "/admin/maintenance/generate", label: "Scheduler", icon: Calendar  },
  { href: "/admin/maintenance/payments", label: "Payments",  icon: DollarSign },
];

const ADMIN_ONLY_ITEMS = [
  { href: "/admin/users",          label: "Users",         icon: UserCog,         pageId: "users" },
  { href: "/admin/permissions",    label: "Permissions",   icon: ShieldCheck,     pageId: "permissions" },
];

interface Props {
  user: { name?: string | null; email?: string | null };
  role: string;
  permissions: PermissionsMap;
}

function NavLinks({ pathname, role, permissions, onNavigate }: {
  pathname: string;
  role: string;
  permissions: PermissionsMap;
  onNavigate?: () => void;
}) {
  const isAdmin = role === "ADMIN";
  const isMaintActive = pathname.startsWith("/admin/maintenance");
  const [maintOpen, setMaintOpen] = useState(isMaintActive);

  const showMaintenance = isAdmin || permissions["maintenance"]?.canRead === true;

  const visibleItems = NAV_ITEMS.filter(({ pageId }) => {
    if (isAdmin) return true;
    return permissions[pageId]?.canRead === true;
  });

  const allItems = isAdmin ? [...visibleItems, ...ADMIN_ONLY_ITEMS] : visibleItems;

  return (
    <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}

      {/* Maintenance expandable group */}
      {showMaintenance && (
        <div>
          <button
            onClick={() => setMaintOpen((o) => !o)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              isMaintActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Wrench className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Maintenance</span>
            {maintOpen
              ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          </button>
          {maintOpen && (
            <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-3">
              {MAINTENANCE_SUB_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Admin-only items */}
      {isAdmin && ADMIN_ONLY_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ user, role, permissions, onNavigate }: Props & { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <Zap className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight">Oasis Venetia Heights</p>
            <p className="text-xs text-muted-foreground">{role === "ADMIN" ? "Admin Panel" : "Manager Panel"}</p>
          </div>
        </div>
      </div>

      <NavLinks pathname={pathname} role={role} permissions={permissions} onNavigate={onNavigate} />

      <Separator />

      <div className="px-3 py-3 space-y-1">
        <div className="flex items-center justify-between px-1 py-1">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export default function SidebarNav({ user, role, permissions }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center justify-between px-4 bg-card border-b border-border shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground">Oasis Venetia Heights</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 border-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent user={user} role={role} permissions={permissions} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="hidden md:flex w-64 h-full shrink-0 flex-col">
        <SidebarContent user={user} role={role} permissions={permissions} />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Remove Manage Rates + Scheduler buttons from maintenance page header**

Open `app/(admin)/admin/maintenance/page.tsx`. Replace the `<div className="flex gap-2">` block:

```tsx
// REMOVE these lines:
<div className="flex gap-2">
  <Link href="/admin/maintenance/rates"><Button variant="outline">Manage Rates</Button></Link>
  <Link href="/admin/maintenance/generate"><Button>Scheduler</Button></Link>
</div>
```

The page header should now only show the title + description, no buttons. The full updated section:

```tsx
export default function MaintenanceBillsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Bills</h1>
        <p className="text-sm text-gray-500 mt-1">Monthly maintenance charges · 24% p.a. interest on overdue</p>
      </div>
      <Suspense fallback={<TableSkeleton rows={8} cols={7} />}>
        <BillsData />
      </Suspense>
    </div>
  );
}
```

Also remove the unused `Link` and `Button` imports if they're no longer used:
```tsx
// Remove these import lines if no longer used elsewhere in the file:
import Link from "next/link";
import { Button } from "@/components/ui/button";
```

- [ ] **Step 3: Create the MaintenancePaymentsTable component**

Create `components/admin/maintenance-payments-table.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface MaintenancePaymentRow {
  id: string;
  receiptNumber: string;
  flatNo: string;
  tower: string;
  residentName: string;
  billNumber: string;
  amount: string;
  method: string;
  referenceId: string | null;
  paymentDate: string;
  status: string;
}

const fmtINR = (v: string | number) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function MaintenancePaymentsTable({ initialData }: { initialData: MaintenancePaymentRow[] }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [payments, setPayments] = useState(initialData);
  const [tower, setTower] = useState("all");
  const [month, setMonth] = useState(currentMonth);
  const [method, setMethod] = useState("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchPayments(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (tower !== "all") p.set("tower", tower);
      if (month) p.set("month", month);
      if (method !== "all") p.set("method", method);
      const res = await fetch(`/api/maintenance/payments?${p}`);
      if (!res.ok) { toast.error("Failed to load payments"); return; }
      const data = await res.json();
      setPayments(data.map((p: any) => ({
        id: p.id,
        receiptNumber: p.receiptNumber,
        flatNo: p.bill?.connection?.flatNo ?? "—",
        tower: p.bill?.connection?.tower ?? "—",
        residentName: p.bill?.connection?.resident?.user?.name ?? "—",
        billNumber: p.bill?.billNumber ?? "—",
        amount: p.amount,
        method: p.method,
        referenceId: p.razorpayPaymentId && p.razorpayPaymentId !== "CASH" ? p.razorpayPaymentId : null,
        paymentDate: p.paymentDate,
        status: p.status,
      })));
    } finally { setLoading(false); }
  };

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Tower</Label>
          <Select value={tower} onValueChange={(v) => setTower(v ?? "all")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "A", "B", "C", "V"].map((t) => (
                <SelectItem key={t} value={t}>{t === "all" ? "All Towers" : `Tower ${t}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v ?? "all")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "CASH", "UPI", "NEFT", "RTGS", "CHEQUE"].map((m) => (
                <SelectItem key={m} value={m}>{m === "all" ? "All" : m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetchPayments} disabled={loading} variant="outline">
          {loading ? "Loading…" : "Apply Filter"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-6 text-sm bg-gray-50 rounded-lg p-3">
        <span><strong>{payments.length}</strong> payments</span>
        <span>Total Collected: <strong className="text-green-700">{fmtINR(total)}</strong></span>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Receipt No</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Flat / Resident</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Bill No</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Method</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Reference</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-blue-600">{p.receiptNumber}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{p.flatNo}</p>
                  <p className="text-xs text-gray-500">{p.residentName}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.billNumber}</td>
                <td className="px-4 py-3 font-medium text-green-700">{fmtINR(p.amount)}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs">{p.method}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{p.referenceId ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(p.paymentDate)}</td>
                <td className="px-4 py-3">
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">{p.status}</Badge>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">No payments found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Check the existing /api/maintenance/payments route supports tower + month + method filters**

Read `app/api/maintenance/payments/route.ts`. If it doesn't support those query params, update it to add them. The route should:
- Accept `?tower=A&month=2026-07&method=CASH`
- Join to `bill.connection.resident.user`
- Return payments with nested bill + connection + resident data

If the route already returns all payments without filters, add the following WHERE clause logic:

```ts
// In the GET handler, after parsing searchParams:
const tower = searchParams.get("tower");
const month = searchParams.get("month"); // YYYY-MM
const method = searchParams.get("method");

let dateFilter: { gte?: Date; lt?: Date } | undefined;
if (month) {
  const [year, mon] = month.split("-").map(Number);
  dateFilter = { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) };
}

const payments = await prisma.maintenancePayment.findMany({
  where: {
    ...(method ? { method: method as any } : {}),
    ...(dateFilter ? { paymentDate: dateFilter } : {}),
    ...(tower ? { bill: { connection: { tower } } } : {}),
  },
  include: {
    bill: {
      include: {
        connection: {
          include: {
            resident: { include: { user: { select: { name: true } } } },
          },
        },
      },
    },
  },
  orderBy: { paymentDate: "desc" },
  take: 500,
});
```

- [ ] **Step 5: Create the Maintenance Payments admin page**

Create `app/(admin)/admin/maintenance/payments/page.tsx`:

```tsx
import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import MaintenancePaymentsTable from "@/components/admin/maintenance-payments-table";
import { TableSkeleton } from "@/components/ui/page-skeleton";
import type { PermissionsMap } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function PaymentsData() {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canRead");
  if (guard) redirect("/admin/dashboard");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const payments = await prisma.maintenancePayment.findMany({
    where: { paymentDate: { gte: monthStart, lt: monthEnd } },
    include: {
      bill: {
        include: {
          connection: {
            include: {
              resident: { include: { user: { select: { name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { paymentDate: "desc" },
    take: 500,
  });

  const serialized = payments.map((p) => ({
    id: p.id,
    receiptNumber: p.receiptNumber,
    flatNo: p.bill?.connection?.flatNo ?? "—",
    tower: p.bill?.connection?.tower ?? "—",
    residentName: p.bill?.connection?.resident?.user?.name ?? "—",
    billNumber: p.bill?.billNumber ?? "—",
    amount: p.amount.toString(),
    method: p.method,
    referenceId: p.razorpayPaymentId && p.razorpayPaymentId !== "CASH" ? p.razorpayPaymentId : null,
    paymentDate: p.paymentDate.toISOString(),
    status: p.status,
  }));

  return <MaintenancePaymentsTable initialData={serialized} />;
}

export default function MaintenancePaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Payments</h1>
        <p className="text-sm text-gray-500 mt-1">Payment history for maintenance bills</p>
      </div>
      <Suspense fallback={<TableSkeleton rows={8} cols={8} />}>
        <PaymentsData />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 6: Build and verify**

```bash
cd electricity-management
npm run build 2>&1 | tail -20
```

Expected: Build completes with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
cd electricity-management
git add components/admin/sidebar-nav.tsx \
        app/(admin)/admin/maintenance/page.tsx \
        app/(admin)/admin/maintenance/payments/page.tsx \
        components/admin/maintenance-payments-table.tsx \
        app/api/maintenance/payments/route.ts
git commit -m "feat: maintenance sidebar submenu with Bills/Rates/Scheduler/Payments sub-items and new payments page"
```

- [ ] **Step 8: Deploy**

```bash
cd electricity-management
npx vercel --prod 2>&1 | tail -10
```

Expected: `▲ Aliased https://oasisvenetia.in`

- [ ] **Step 9: Verify live**

Visit https://oasisvenetia.in/admin/maintenance — confirm:
- Maintenance in sidebar shows a chevron and expands to 4 sub-items
- "Manage Rates" and "Scheduler" buttons gone from page header
- Visit `/admin/maintenance/payments` — payments table loads with current month

---

## Task 2: Maintenance Bill PDF

**Files:**
- Modify: `lib/pdf.ts`
- Create: `app/api/maintenance/bills/[id]/pdf/route.ts`

**Interfaces:**
- Consumes: `generateMaintenanceBillPdf(data: MaintenanceBillPdfData): Promise<Buffer>` from `lib/pdf.ts`
- Produces: `GET /api/maintenance/bills/[id]/pdf` → streams PDF bytes

- [ ] **Step 1: Add `MaintenanceBillPdfData` interface and `generateMaintenanceBillPdf` to lib/pdf.ts**

Open `lib/pdf.ts`. At the end of the file (after `generateReceiptPdf`), append:

```ts
export interface MaintenanceBillPdfData {
  billNumber: string;
  flatNo: string;
  residentName: string;
  billDate: Date;
  dueDate: Date;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  unitArea: number;
  ratePerSqFt: number;
  amount: number;
  interestCharge: number;
  paidAmount: number;
  status: string;
}

export function generateMaintenanceBillPdf(data: MaintenanceBillPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 0, size: "A4" });

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = 595;
    const L = 40;
    const CW = 515;

    // ── Navy header ──────────────────────────────────────────
    doc.rect(0, 0, PW, 108).fill("#1e3a5f");

    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(15)
      .text("OASIS BUILDMART INDIA PVT. LTD.", L, 22, { width: CW, align: "center" });
    doc.fillColor("#93b8d4").font("Helvetica").fontSize(8.5)
      .text("Oasis Venetia Heights, Plot No-HRA, 12, A, Site-C, Greater Noida - 201306 (UP)", L, 42, { width: CW, align: "center" });
    doc.fillColor("#93b8d4").fontSize(8.5)
      .text("Phone: 9355011978", L, 56, { width: CW, align: "center" });

    doc.rect(PW / 2 - 75, 74, 150, 22).fill("#2563eb");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10)
      .text("MAINTENANCE BILL", L, 79, { width: CW, align: "center" });

    // ── Bill No and Date ─────────────────────────────────────
    let y = 126;
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5)
      .text("BILL NUMBER", L, y, { width: 240 });
    doc.text("BILL DATE", 310, y, { width: 245 });

    y += 13;
    doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(12)
      .text(data.billNumber, L, y, { width: 240 });
    doc.fillColor("#374151").font("Helvetica").fontSize(10)
      .text(formatDate(data.billDate), 310, y, { width: 245 });

    // divider
    y += 28;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.8).stroke();

    // ── Flat / Resident ──────────────────────────────────────
    y += 14;
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5)
      .text("FLAT NO.", L, y, { width: 200 });
    doc.text("RESIDENT NAME", 280, y, { width: 275 });

    y += 13;
    doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(16)
      .text(data.flatNo, L, y - 2, { width: 200 });
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12)
      .text(data.residentName, 280, y, { width: 275 });

    // divider
    y += 34;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.8).stroke();

    // ── Billing period + due date ────────────────────────────
    y += 14;
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5)
      .text("BILLING PERIOD", L, y, { width: 240 });
    doc.text("DUE DATE", 310, y, { width: 245 });

    y += 13;
    doc.fillColor("#374151").font("Helvetica").fontSize(10)
      .text(`${formatDate(data.billingPeriodStart)} – ${formatDate(data.billingPeriodEnd)}`, L, y, { width: 240 });
    doc.fillColor("#374151").font("Helvetica").fontSize(10)
      .text(formatDate(data.dueDate), 310, y, { width: 245 });

    y += 28;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.8).stroke();

    // ── Charge breakdown ─────────────────────────────────────
    y += 14;
    doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8.5)
      .text("CHARGE BREAKDOWN", L, y, { width: CW });

    y += 16;
    const chargeRows: [string, number, boolean][] = [
      [`Maintenance Charge (${data.unitArea} sq ft × ₹${Number(data.ratePerSqFt).toFixed(2)}/sq ft)`, data.amount, false],
    ];
    if (data.interestCharge > 0) {
      chargeRows.push([`Interest Charge (24% p.a. overdue)`, data.interestCharge, true]);
    }
    if (data.paidAmount > 0) {
      chargeRows.push([`Amount Already Paid`, -data.paidAmount, false]);
    }

    for (let i = 0; i < chargeRows.length; i++) {
      const [label, amount, isRed] = chargeRows[i];
      if (i % 2 === 0) doc.rect(L, y - 4, CW, 22).fill("#f9fafb");
      doc.fillColor(isRed ? "#dc2626" : "#6b7280").font("Helvetica").fontSize(8.5)
        .text(label, L + 8, y, { width: 380, lineBreak: false });
      doc.fillColor(isRed ? "#dc2626" : "#111827").font("Helvetica-Bold").fontSize(8.5)
        .text(`Rs. ${formatCurrency(Math.abs(amount))}`, L + 390, y, { width: 125, align: "right", lineBreak: false });
      y += 22;
    }

    // ── Net payable box ──────────────────────────────────────
    const netPayable = data.amount + data.interestCharge - data.paidAmount;
    y += 8;
    doc.rect(L, y, CW, 80).fill("#eef2ff");
    doc.fillColor("#4b5563").font("Helvetica").fontSize(8)
      .text("NET PAYABLE AMOUNT", L, y + 14, { width: CW, align: "center" });
    doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(28)
      .text(`Rs. ${formatCurrency(netPayable > 0 ? netPayable : 0)}`, L, y + 28, { width: CW, align: "center" });

    if (data.status === "PAID") {
      y += 96;
      doc.rect(L, y, CW, 44).fill("#f0fdf4");
      doc.rect(L, y, CW, 44).strokeColor("#86efac").lineWidth(1).stroke();
      doc.fillColor("#166534").font("Helvetica-Bold").fontSize(13)
        .text("FULLY PAID", L, y + 14, { width: CW, align: "center" });
      y += 60;
    } else {
      y += 96;
    }

    // ── Terms ────────────────────────────────────────────────
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 10;
    doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8).text("TERMS & NOTES", L, y, { width: CW });
    y += 14;
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5)
      .text(`1. Rate: Rs.${Number(data.ratePerSqFt).toFixed(2)}/sq ft  ·  Area: ${data.unitArea} sq ft`, L, y, { width: CW });
    y += 12;
    doc.text(`2. Payment due by ${formatDate(data.dueDate)}. Late payment attracts 24% p.a. interest.`, L, y, { width: CW });
    y += 12;
    doc.text("3. This is a computer-generated bill and does not require a signature.", L, y, { width: CW });

    // ── Footer ────────────────────────────────────────────────
    y += 24;
    doc.moveTo(L, y).lineTo(L + CW, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 8;
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(7)
      .text(
        "Oasis Buildmart India Pvt. Ltd.  |  Oasis Venetia Heights, Greater Noida - 201306 (UP)  |  Phone: 9355011978",
        L, y, { width: CW, align: "center" }
      );

    doc.end();
  });
}
```

- [ ] **Step 2: Create the PDF API route**

Create `app/api/maintenance/bills/[id]/pdf/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { generateMaintenanceBillPdf } from "@/lib/pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canRead");
  if (guard) return guard;

  const { id } = await params;

  const bill = await prisma.maintenanceBill.findUnique({
    where: { id },
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { name: true } } } },
        },
      },
    },
  });

  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  const pdfBuffer = await generateMaintenanceBillPdf({
    billNumber: bill.billNumber,
    flatNo: bill.connection.flatNo,
    residentName: bill.connection.resident.user.name ?? "Resident",
    billDate: bill.billDate,
    dueDate: bill.dueDate,
    billingPeriodStart: bill.billingPeriodStart,
    billingPeriodEnd: bill.billingPeriodEnd,
    unitArea: Number(bill.unitArea),
    ratePerSqFt: Number(bill.ratePerSqFt),
    amount: Number(bill.amount),
    interestCharge: Number(bill.interestCharge),
    paidAmount: Number(bill.paidAmount),
    status: bill.status,
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="maintenance-bill-${bill.billNumber}.pdf"`,
    },
  });
}
```

- [ ] **Step 3: Build and verify**

```bash
cd electricity-management
npm run build 2>&1 | grep -E "error|Error|✓|Route" | head -30
```

Expected: No TypeScript errors. Route `/api/maintenance/bills/[id]/pdf` appears in build output.

- [ ] **Step 4: Commit**

```bash
cd electricity-management
git add lib/pdf.ts app/api/maintenance/bills/[id]/pdf/route.ts
git commit -m "feat: add maintenance bill PDF generation and download route"
```

- [ ] **Step 5: Deploy**

```bash
cd electricity-management
npx vercel --prod 2>&1 | tail -5
```

---

## Task 3: PDF Button + Excel Export in Maintenance Bills Table

**Files:**
- Modify: `components/admin/maintenance-bills-table.tsx`

**Interfaces:**
- Consumes: `GET /api/maintenance/bills/[id]/pdf` (Task 2)
- Consumes: ExcelJS (dynamic import, already in package.json)

- [ ] **Step 1: Add PDF button and Excel export to maintenance-bills-table.tsx**

Open `components/admin/maintenance-bills-table.tsx`. Make the following changes:

**A) Add imports** at the top:
```tsx
import { FileDown, FileSpreadsheet } from "lucide-react";
```

**B) Add Excel download function** inside the component (before the `return` statement):
```tsx
const downloadExcel = async () => {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  wb.creator = "Oasis Venetia Heights";
  wb.created = new Date();

  const ws = wb.addWorksheet("Maintenance Bills");
  ws.columns = [
    { key: "billNumber",  width: 18 },
    { key: "flatNo",      width: 8  },
    { key: "tower",       width: 8  },
    { key: "resident",    width: 22 },
    { key: "area",        width: 10 },
    { key: "rate",        width: 12 },
    { key: "amount",      width: 14 },
    { key: "interest",    width: 12 },
    { key: "paid",        width: 12 },
    { key: "outstanding", width: 14 },
    { key: "dueDate",     width: 14 },
    { key: "status",      width: 10 },
  ];

  // Header row
  const COLS = 12;
  ws.mergeCells(1, 1, 1, COLS);
  const t1 = ws.getCell("A1");
  t1.value = "Oasis Venetia Heights — Maintenance Bills";
  t1.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  t1.alignment = { horizontal: "center", vertical: "middle" };
  t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, COLS);
  const t2 = ws.getCell("A2");
  t2.value = `Month: ${month || "All"}   |   Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`;
  t2.font = { size: 9, italic: true, color: { argb: "FF374151" } };
  t2.alignment = { horizontal: "center", vertical: "middle" };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF5" } };
  ws.getRow(2).height = 14;

  // Column headers
  const headers = ["Bill No", "Flat", "Tower", "Resident", "Area (sq ft)", "Rate/sq ft", "Maintenance ₹", "Interest ₹", "Paid ₹", "Outstanding ₹", "Due Date", "Status"];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.getRow(3).height = 16;

  // Data rows
  bills.forEach((b, idx) => {
    const outstanding = Number(b.amount) + Number(b.interestCharge) - Number(b.paidAmount);
    const bg = idx % 2 === 0 ? "FFF0F4FA" : "FFFFFFFF";
    const row = ws.getRow(idx + 4);
    const vals = [
      b.billNumber,
      b.flatNo,
      b.tower,
      b.residentName,
      b.unitArea,
      Number(b.ratePerSqFt),
      Number(b.amount),
      Number(b.interestCharge),
      Number(b.paidAmount),
      outstanding > 0 ? outstanding : 0,
      new Date(b.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      b.status,
    ];
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v as any;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { size: 9 };
      if ([6, 7, 8, 9].includes(i)) {
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      }
    });
    row.getCell(1).font = { size: 9, name: "Courier New" };
    row.height = 15;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `maintenance-bills-${month || "all"}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**C) Add Excel + PDF buttons to the filter bar** — replace the existing `<Button onClick={fetchBills}...>Apply Filter</Button>` line with:
```tsx
<Button onClick={fetchBills} disabled={loading} variant="outline">
  {loading ? "Loading…" : "Apply Filter"}
</Button>
<Button onClick={downloadExcel} variant="outline" size="sm" className="gap-1">
  <FileSpreadsheet className="h-4 w-4" />
  Download Excel
</Button>
```

**D) Add PDF button in the Actions column** — in the `{canWrite && <td>` block, add the PDF button alongside Record Payment:
```tsx
{canWrite && (
  <td className="px-4 py-3">
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        title="Download PDF"
        onClick={() => window.open(`/api/maintenance/bills/${bill.id}/pdf`, "_blank")}
      >
        <FileDown className="h-3.5 w-3.5" />
      </Button>
      {bill.status !== "PAID" && (
        <Button size="sm" variant="outline" onClick={() => {
          setPayBill(bill);
          const remaining = Number(bill.amount) + Number(bill.interestCharge) - Number(bill.paidAmount);
          setPayAmount(remaining.toFixed(2));
        }}>
          Record Payment
        </Button>
      )}
    </div>
  </td>
)}
```

- [ ] **Step 2: Build**

```bash
cd electricity-management
npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd electricity-management
git add components/admin/maintenance-bills-table.tsx
git commit -m "feat: add PDF download button and Excel export to maintenance bills table"
```

- [ ] **Step 4: Deploy and verify**

```bash
cd electricity-management
npx vercel --prod 2>&1 | tail -5
```

Visit https://oasisvenetia.in/admin/maintenance. Confirm:
- Each row in Actions column has a small `↓` icon button
- Clicking it opens a PDF in a new tab (A4, navy header, "MAINTENANCE BILL" badge)
- "Download Excel" button in filter bar downloads a styled .xlsx with the current filtered bills

---

## Task 4: History Dialog — Maintenance Bills Section

**Files:**
- Modify: `components/admin/residents-table.tsx`

**Interfaces:**
- Consumes: `GET /api/maintenance/bills?flatNo=` (existing route, already returns bills for a flat)

- [ ] **Step 1: Update openHistory() to fetch maintenance bills**

In `components/admin/residents-table.tsx`, find the `openHistory` function (around line 315). Update the parallel fetch block to add a third call:

```ts
async function openHistory(resident: Resident) {
  const flatNo = resident.connections?.[0]?.flatNo ?? "";
  setHistoryResident({ flatNo, name: resident.user.name });
  setHistoryData(null);
  setHistoryLoading(true);
  try {
    const [billsRes, paymentsRes, maintRes] = await Promise.all([
      fetch(`/api/bills?flatNo=${encodeURIComponent(flatNo)}`),
      fetch(`/api/payments?flatNo=${encodeURIComponent(flatNo)}`),
      fetch(`/api/maintenance/bills?flatNo=${encodeURIComponent(flatNo)}`),
    ]);
    const bills = billsRes.ok ? await billsRes.json() : [];
    const payments = paymentsRes.ok ? await paymentsRes.json() : [];
    const maintenanceBills = maintRes.ok ? await maintRes.json() : [];
    setHistoryData({ bills, payments, maintenanceBills });
  } catch {
    toast.error("Failed to load history");
  } finally {
    setHistoryLoading(false);
  }
}
```

- [ ] **Step 2: Update historyData state type**

Find the `useState` for `historyData` (around line 104) and update it:

```ts
const [historyData, setHistoryData] = useState<{ bills: any[]; payments: any[]; maintenanceBills: any[] } | null>(null);
```

- [ ] **Step 3: Update the Excel download button condition and add maintenance sheet**

Find the condition on the Download Excel button (around line 851):
```ts
// CHANGE from:
{historyData && (historyData.bills.length > 0 || historyData.payments.length > 0) && (
// CHANGE to:
{historyData && (historyData.bills.length > 0 || historyData.payments.length > 0 || historyData.maintenanceBills.length > 0) && (
```

Then inside the Excel onClick handler, after the existing `// ---- PAYMENTS ----` block (around line 963), add:

```ts
// ---- MAINTENANCE BILLS ----
if (historyData.maintenanceBills.length > 0) {
  r++; // blank row
  mkSection("MAINTENANCE BILLS", "FF7C3AED");
  mkColHeaders(["Bill No", "Billing Period", "Amount (₹)", "Interest (₹)", "Paid (₹)", "Status"], "FF5B21B6");
  historyData.maintenanceBills.forEach((b: any, idx: number) => {
    const period = `${new Date(b.billingPeriodStart).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${new Date(b.billingPeriodEnd).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
    const bg = idx % 2 === 0 ? "FFF5F3FF" : "FFFFFFFF";
    const row = ws.getRow(r);
    [b.billNumber, period, Number(b.amount), Number(b.interestCharge), Number(b.paidAmount), b.status].forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v as any;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { size: 9 };
      cell.alignment = { vertical: "middle" };
      if ([2, 3, 4].includes(i)) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = "#,##0.00";
      }
    });
    row.getCell(1).font = { size: 9, name: "Courier New" };
    row.height = 15;
    r++;
  });
}
```

- [ ] **Step 4: Add Maintenance Bills section to the dialog UI**

In the dialog's `{historyData && (` block (around line 981), after the closing `</div>` of the Payments section, add:

```tsx
{/* Maintenance Bills */}
<div>
  <h3 className="text-sm font-semibold mb-2">Maintenance Bills ({historyData.maintenanceBills.length})</h3>
  {historyData.maintenanceBills.length === 0 ? (
    <p className="text-sm text-muted-foreground">No maintenance bills found.</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-3 py-2 font-medium">Bill No</th>
            <th className="text-left px-3 py-2 font-medium">Billing Period</th>
            <th className="text-right px-3 py-2 font-medium">Amount (₹)</th>
            <th className="text-right px-3 py-2 font-medium">Interest (₹)</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {historyData.maintenanceBills.map((b: any) => (
            <tr key={b.id} className="border-b last:border-0">
              <td className="px-3 py-2 font-mono">{b.billNumber}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {new Date(b.billingPeriodStart).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                {" – "}
                {new Date(b.billingPeriodEnd).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </td>
              <td className="px-3 py-2 text-right font-medium">
                {Number(b.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-2 text-right text-red-600">
                {Number(b.interestCharge) > 0
                  ? Number(b.interestCharge).toLocaleString("en-IN", { minimumFractionDigits: 2 })
                  : "—"}
              </td>
              <td className="px-3 py-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  b.status === "PAID" ? "bg-green-100 text-green-700" :
                  b.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>{b.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
```

- [ ] **Step 5: Build**

```bash
cd electricity-management
npm run build 2>&1 | grep -E "error|Error" | head -10
```

- [ ] **Step 6: Commit and deploy**

```bash
cd electricity-management
git add components/admin/residents-table.tsx
git commit -m "feat: add maintenance bills section to resident history dialog and Excel export"
npx vercel --prod 2>&1 | tail -5
```

- [ ] **Step 7: Verify live**

Visit https://oasisvenetia.in/admin/residents → click History on any resident who has maintenance bills. Confirm:
- "Maintenance Bills (N)" section appears below Payments
- Download Excel includes maintenance bills in a purple-themed section
- A resident with no maintenance bills shows "No maintenance bills found."

---

## Task 5: Advance Payment API + Dialog

**Files:**
- Create: `app/api/maintenance/bills/advance/route.ts`
- Modify: `components/admin/maintenance-bills-table.tsx`

**Interfaces:**
- Consumes: `generateMaintenanceBillNumber` from `lib/maintenance-billing.ts`
- Consumes: `nextMaintenanceReceiptNumber` from `lib/maintenance-billing.ts`
- Produces: `POST /api/maintenance/bills/advance` → `{ generated, skipped, receiptNumbers }`

- [ ] **Step 1: Create the advance payment API route**

Create `app/api/maintenance/bills/advance/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateMaintenanceBillNumber, nextMaintenanceReceiptNumber } from "@/lib/maintenance-billing";

const ALLOWED_METHODS = ["CASH", "UPI", "NEFT", "RTGS", "CHEQUE"] as const;

export async function POST(req: NextRequest) {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const canWrite = isAdmin || (session?.user as any)?.permissions?.["maintenance"]?.canWrite === true;
  if (!session || !canWrite) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    connectionId,
    months: monthsParam,
    startMonth,
    amountPerMonth: amountParam,
    method: methodParam = "CASH",
    paymentDate: paymentDateParam,
    referenceId = null,
  } = body as {
    connectionId?: string;
    months?: number;
    startMonth?: string;
    amountPerMonth?: number;
    method?: string;
    paymentDate?: string;
    referenceId?: string | null;
  };

  if (!connectionId || !startMonth || !amountParam || !monthsParam) {
    return NextResponse.json({ error: "connectionId, months, startMonth, amountPerMonth are required" }, { status: 400 });
  }
  if (![6, 12].includes(monthsParam)) {
    return NextResponse.json({ error: "months must be 6 or 12" }, { status: 400 });
  }

  const method = (ALLOWED_METHODS as readonly string[]).includes(methodParam ?? "")
    ? (methodParam as typeof ALLOWED_METHODS[number])
    : "CASH";

  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: { resident: { include: { user: { select: { name: true } } } } },
  });
  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  const rate = await prisma.maintenanceRate.findFirst({
    orderBy: { effectiveFrom: "desc" },
  });
  if (!rate) return NextResponse.json({ error: "No maintenance rate configured" }, { status: 422 });

  const [startYear, startMon] = startMonth.split("-").map(Number);
  if (!startYear || !startMon || startMon < 1 || startMon > 12) {
    return NextResponse.json({ error: "Invalid startMonth. Use YYYY-MM" }, { status: 400 });
  }

  const pDate = paymentDateParam ? new Date(paymentDateParam) : new Date();
  const amountPerMonth = Number(amountParam);
  const receiptNumbers: string[] = [];
  let generated = 0;
  let skipped = 0;

  for (let n = 0; n < monthsParam; n++) {
    const month = ((startMon - 1 + n) % 12) + 1;
    const year = startYear + Math.floor((startMon - 1 + n) / 12);

    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const dueDate = new Date(Date.UTC(year, month - 1, 10));

    const billNumber = generateMaintenanceBillNumber(connection.flatNo, periodStart);

    const existing = await prisma.maintenanceBill.findFirst({
      where: { connectionId, billingPeriodStart: periodStart },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const receiptNumber = await nextMaintenanceReceiptNumber();

    await prisma.$transaction(async (tx) => {
      const bill = await tx.maintenanceBill.create({
        data: {
          connectionId,
          maintenanceRateId: rate.id,
          billNumber,
          billDate: pDate,
          dueDate,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          unitArea: Number(connection.unitArea),
          ratePerSqFt: Number(rate.ratePerSqFt),
          amount: amountPerMonth,
          paidAmount: amountPerMonth,
          interestCharge: 0,
          status: "PAID",
        },
      });
      await tx.maintenancePayment.create({
        data: {
          maintenanceBillId: bill.id,
          amount: amountPerMonth,
          paymentDate: pDate,
          method,
          status: "SUCCESS",
          receiptNumber,
          razorpayPaymentId: referenceId ?? (method === "CASH" ? "CASH" : null),
        },
      });
    });

    receiptNumbers.push(receiptNumber);
    generated++;
  }

  return NextResponse.json({ generated, skipped, receiptNumbers });
}
```

- [ ] **Step 2: Add Advance Pay button and dialog to maintenance-bills-table.tsx**

Open `components/admin/maintenance-bills-table.tsx`. 

**A) Add state variables** inside the component (after existing state declarations):
```tsx
const [advanceOpen, setAdvanceOpen] = useState(false);
const [advConnections, setAdvConnections] = useState<{ id: string; flatNo: string; tower: string; unitArea: number; ratePerSqFt: number }[]>([]);
const [advConnId, setAdvConnId] = useState("");
const [advMonths, setAdvMonths] = useState<6 | 12>(6);
const [advStart, setAdvStart] = useState(() => {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 7);
});
const [advAmount, setAdvAmount] = useState("");
const [advMethod, setAdvMethod] = useState("CASH");
const [advDate, setAdvDate] = useState(new Date().toISOString().slice(0, 10));
const [advRef, setAdvRef] = useState("");
const [advSubmitting, setAdvSubmitting] = useState(false);
```

**B) Add function to load connections** (inside the component, before return):
```tsx
const openAdvanceDialog = async () => {
  setAdvanceOpen(true);
  if (advConnections.length > 0) return;
  try {
    const [connRes, rateRes] = await Promise.all([
      fetch("/api/connections?status=ACTIVE"),
      fetch("/api/maintenance/rates"),
    ]);
    const conns = connRes.ok ? await connRes.json() : [];
    const rates = rateRes.ok ? await rateRes.json() : [];
    const currentRate = rates[0]?.ratePerSqFt ?? 0;
    setAdvConnections(conns.map((c: any) => ({
      id: c.id,
      flatNo: c.flatNo,
      tower: c.tower,
      unitArea: Number(c.unitArea),
      ratePerSqFt: Number(currentRate),
    })));
  } catch {
    toast.error("Failed to load connections");
  }
};
```

**C) Add total computed value** (inside component before return):
```tsx
const advTotal = advAmount && advMonths ? (parseFloat(advAmount) * advMonths).toFixed(2) : "0.00";
```

**D) Auto-fill amount when connection changes** — add this effect inside the component:
```tsx
useEffect(() => {
  if (!advConnId) return;
  const conn = advConnections.find((c) => c.id === advConnId);
  if (conn) setAdvAmount((conn.unitArea * conn.ratePerSqFt).toFixed(2));
}, [advConnId, advConnections]);
```

**E) Add submit handler**:
```tsx
const handleAdvancePayment = async () => {
  if (!advConnId || !advAmount) { toast.error("Select a flat and enter amount"); return; }
  setAdvSubmitting(true);
  try {
    const res = await fetch("/api/maintenance/bills/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId: advConnId,
        months: advMonths,
        startMonth: advStart,
        amountPerMonth: parseFloat(advAmount),
        method: advMethod,
        paymentDate: advDate,
        referenceId: advRef || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
    toast.success(`${data.generated} bill(s) generated and marked paid.${data.skipped > 0 ? ` ${data.skipped} month(s) skipped (already existed).` : ""}`);
    setAdvanceOpen(false);
    await fetchBills();
  } finally { setAdvSubmitting(false); }
};
```

**F) Add "Advance Pay" button** to the page header area. In the component's return, find the filter bar `<div className="flex flex-wrap gap-3 items-end">` and add this button after the Download Excel button:
```tsx
{canWrite && (
  <Button onClick={openAdvanceDialog} variant="outline" size="sm" className="gap-1 ml-auto">
    <Receipt className="h-4 w-4" />
    Advance Pay
  </Button>
)}
```

Add `Receipt` to the lucide-react import.

**G) Add the Advance Pay Dialog** — at the end of the component's return (after the Detail Dialog closing tag, before the outer `</div>`):

```tsx
{/* Advance Payment Dialog */}
<Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
  <DialogContent className="max-w-md">
    <DialogHeader><DialogTitle>Record Advance Payment</DialogTitle></DialogHeader>
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Flat</Label>
        <Select value={advConnId} onValueChange={setAdvConnId}>
          <SelectTrigger><SelectValue placeholder="Select flat…" /></SelectTrigger>
          <SelectContent>
            {advConnections.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.flatNo} (Tower {c.tower}) — {c.unitArea} sq ft
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Months</Label>
        <div className="flex gap-3">
          {([6, 12] as const).map((m) => (
            <button
              key={m}
              onClick={() => setAdvMonths(m)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                advMonths === m
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {m} Months
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <Label>Start From</Label>
        <Input type="month" value={advStart} onChange={(e) => setAdvStart(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Amount / Month (₹)</Label>
        <Input type="number" step="0.01" value={advAmount} onChange={(e) => setAdvAmount(e.target.value)} />
      </div>
      <div className="bg-gray-50 rounded-md px-3 py-2 text-sm flex justify-between">
        <span className="text-gray-500">Total ({advMonths} months)</span>
        <strong>₹{Number(advTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
      </div>
      <div className="space-y-1">
        <Label>Method</Label>
        <Select value={advMethod} onValueChange={setAdvMethod}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["CASH", "UPI", "NEFT", "RTGS", "CHEQUE"].map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Payment Date</Label>
        <Input type="date" value={advDate} onChange={(e) => setAdvDate(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Reference / UTR (optional)</Label>
        <Input value={advRef} onChange={(e) => setAdvRef(e.target.value)} placeholder="UTR / cheque no." />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
        <Button onClick={handleAdvancePayment} disabled={advSubmitting || !advConnId || !advAmount}>
          {advSubmitting ? "Processing…" : `Pay ${advMonths} Months`}
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Build**

```bash
cd electricity-management
npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd electricity-management
git add app/api/maintenance/bills/advance/route.ts \
        components/admin/maintenance-bills-table.tsx
git commit -m "feat: advance payment — generate 6 or 12 months of maintenance bills pre-paid"
```

- [ ] **Step 5: Deploy and verify**

```bash
cd electricity-management
npx vercel --prod 2>&1 | tail -5
```

Visit https://oasisvenetia.in/admin/maintenance. Confirm:
- "Advance Pay" button appears in filter bar
- Dialog opens with flat selector, 6/12 month toggle, start month, amount auto-fills based on area × rate
- Submitting creates bills and shows toast: "6 bill(s) generated and marked paid."
- Bills appear in table when month filter matches a generated month
