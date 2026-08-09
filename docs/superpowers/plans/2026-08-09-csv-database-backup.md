# CSV Database Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click "Download Backup" button to the admin dashboard that exports all 5 database tables as CSVs inside a ZIP file.

**Architecture:** A new GET API route `/api/backup/csv` queries all Prisma tables in parallel, converts each to CSV, zips them with `jszip`, and streams the ZIP back. The dashboard gets a plain `<a href>` download link styled as a button, visible only to ADMIN role.

**Tech Stack:** Next.js 16, Prisma 7, jszip, TypeScript, next-auth v5

## Global Constraints

- Next.js version: 16.2.10 — use `app/` router conventions
- Auth: `import { auth } from "@/auth"` — same pattern as all other API routes
- Prisma client: `import { prisma } from "@/lib/prisma"`
- ADMIN-only: route returns 401/403 for non-admin; button hidden for non-admin users
- Monetary values: exported as plain numbers (no ₹ symbol)
- Dates: formatted as `DD Mon YYYY` (e.g. `09 Aug 2026`)
- ZIP filename: `oasis-backup-YYYY-MM-DD.zip` using server date at request time

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `electricity-management/app/api/backup/csv/route.ts` | Create | Backup API route — auth, query, CSV build, ZIP, response |
| `electricity-management/app/(admin)/admin/dashboard/page.tsx` | Modify (line 104–129) | Add Download Backup button, pass `isAdmin` flag |
| `electricity-management/package.json` | Modify | Add `jszip` dependency |

---

### Task 1: Install jszip

**Files:**
- Modify: `electricity-management/package.json`

- [ ] **Step 1: Install jszip**

```bash
cd electricity-management
npm install jszip
npm install --save-dev @types/jszip
```

- [ ] **Step 2: Verify install**

```bash
node -e "const JSZip = require('jszip'); console.log('jszip ok', typeof JSZip)"
```

Expected output: `jszip ok function`

- [ ] **Step 3: Commit**

```bash
git add electricity-management/package.json electricity-management/package-lock.json
git commit -m "chore: add jszip for CSV backup"
```

---

### Task 2: Create the backup API route

**Files:**
- Create: `electricity-management/app/api/backup/csv/route.ts`

**Interfaces:**
- Produces: `GET /api/backup/csv` → `application/zip` binary response

- [ ] **Step 1: Create the route file**

Create `electricity-management/app/api/backup/csv/route.ts` with this content:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined): string => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const [residents, connections, bills, payments, meterReadings] = await Promise.all([
      prisma.resident.findMany({
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.connection.findMany({
        include: { resident: { include: { user: { select: { name: true, email: true } } } } },
        orderBy: { flatNo: "asc" },
      }),
      prisma.bill.findMany({
        include: { connection: { include: { resident: { include: { user: { select: { name: true } } } } } } },
        orderBy: { billDate: "asc" },
      }),
      prisma.payment.findMany({
        include: { bill: { include: { connection: { include: { resident: { include: { user: { select: { name: true } } } } } } } } },
        orderBy: { paymentDate: "asc" },
      }),
      prisma.meterReading.findMany({
        include: { connection: { select: { flatNo: true, tower: true } } },
        orderBy: { readingDate: "asc" },
      }),
    ]);

    const residentsCSV = toCSV(
      ["ID", "Resident No", "Name", "Email", "Phone", "Created At"],
      residents.map((r) => [r.id, r.residentNumber, r.user.name, r.user.email, r.phone ?? "", fmtDate(r.createdAt)])
    );

    const connectionsCSV = toCSV(
      ["ID", "Flat No", "Tower", "Floor", "Unit Type", "Unit Area (sqft)", "Meter No", "Sanctioned Load (kW)", "Status", "Connected At", "Resident Name", "Resident Email"],
      connections.map((c) => [
        c.id, c.flatNo, c.tower, c.floor, c.unitType, c.unitArea,
        c.meterNo ?? "", Number(c.sanctionedLoad), c.status, fmtDate(c.connectedAt),
        c.resident.user.name, c.resident.user.email,
      ])
    );

    const billsCSV = toCSV(
      ["Bill #", "Flat No", "Tower", "Resident Name", "Bill Date", "Due Date", "Period Start", "Period End", "NCPL Units", "Rate/Unit", "NCPL Charge", "DG Charge", "Fixed Charge", "Previous Dues", "Total Amount", "Paid Amount", "Balance", "Status"],
      bills.map((b) => [
        b.billNumber, b.connection.flatNo, b.connection.tower, b.connection.resident.user.name,
        fmtDate(b.billDate), fmtDate(b.dueDate), fmtDate(b.billingPeriodStart), fmtDate(b.billingPeriodEnd),
        Number(b.ncplUnits), Number(b.ratePerUnit), Number(b.ncplCharge), Number(b.dgCharge),
        Number(b.fixedCharge), Number(b.previousDues), Number(b.totalAmount), Number(b.paidAmount),
        Number(b.totalAmount) - Number(b.paidAmount), b.status,
      ])
    );

    const paymentsCSV = toCSV(
      ["Receipt #", "Flat No", "Resident Name", "Bill #", "Amount", "Payment Date", "Method", "Status", "Razorpay / Ref ID"],
      payments.map((p) => [
        p.receiptNumber, p.bill.connection.flatNo, p.bill.connection.resident.user.name,
        p.bill.billNumber, Number(p.amount), fmtDate(p.paymentDate),
        p.method, p.status, p.razorpayPaymentId ?? "",
      ])
    );

    const meterReadingsCSV = toCSV(
      ["ID", "Flat No", "Tower", "Reading Date", "NCPL Previous", "NCPL Current", "NCPL Units", "DG Previous", "DG Current", "DG Units", "Recorded At"],
      meterReadings.map((m) => [
        m.id, m.connection.flatNo, m.connection.tower, fmtDate(m.readingDate),
        Number(m.ncplPrevious), Number(m.ncplCurrent), Number(m.ncplUnits),
        Number(m.dgPrevious), Number(m.dgCurrent), Number(m.dgUnits), fmtDate(m.createdAt),
      ])
    );

    const zip = new JSZip();
    zip.file("residents.csv", residentsCSV);
    zip.file("connections.csv", connectionsCSV);
    zip.file("bills.csv", billsCSV);
    zip.file("payments.csv", paymentsCSV);
    zip.file("meter_readings.csv", meterReadingsCSV);

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    const today = new Date().toISOString().split("T")[0];
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="oasis-backup-${today}.zip"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("Backup failed", err);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd electricity-management
npx tsc --noEmit
```

Expected: no errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add electricity-management/app/api/backup/csv/route.ts
git commit -m "feat: add GET /api/backup/csv route — ZIP of all 5 table CSVs"
```

---

### Task 3: Add Download Backup button to dashboard

**Files:**
- Modify: `electricity-management/app/(admin)/admin/dashboard/page.tsx` (lines 104–129)

**Interfaces:**
- Consumes: session from `auth()` to read `role`
- Consumes: `GET /api/backup/csv` via `<a href>`

- [ ] **Step 1: Update the dashboard page**

The `DashboardPage` function (line 104) is currently a plain server component with no auth check. Add an auth check and conditionally render the Download Backup button.

Replace the `DashboardPage` export (lines 104–129) with:

```typescript
export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of Oasis Venetia Heights electricity management
        </p>
      </div>

      <Suspense fallback={<StatCardsSkeleton count={5} />}>
        <DashboardStats />
      </Suspense>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/residents"><Button>Add Resident</Button></Link>
        <Link href="/admin/meter-readings"><Button variant="outline">Enter Reading</Button></Link>
        <Link href="/admin/reports"><Button variant="outline">View Reports</Button></Link>
        {isAdmin && (
          <a href="/api/backup/csv" download>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Backup
            </Button>
          </a>
        )}
      </div>

      <Suspense fallback={<TableSkeleton rows={6} cols={6} showSearch={false} />}>
        <RecentBillsSection />
      </Suspense>
    </div>
  );
}
```

Also add `Download` to the lucide-react import at line 7:

```typescript
import { Users, Plug, FileText, IndianRupee, AlertCircle, Download } from "lucide-react";
```

And add the auth import at line 8 (it's already imported via `getCachedDashboardStats` file but auth is not imported yet):

```typescript
import { auth } from "@/auth";
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd electricity-management
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add electricity-management/app/(admin)/admin/dashboard/page.tsx
git commit -m "feat: add Download Backup button to admin dashboard (admin-only)"
```

---

### Task 4: Deploy and test

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

Wait ~2 minutes for Vercel to build and deploy.

- [ ] **Step 2: Test the backup download**

1. Go to `https://oasisvenetia.in/admin/dashboard`
2. Confirm "Download Backup" button is visible for admin user
3. Click it — browser should download `oasis-backup-YYYY-MM-DD.zip`
4. Unzip and verify 5 CSV files are present: `residents.csv`, `connections.csv`, `bills.csv`, `payments.csv`, `meter_readings.csv`
5. Open each CSV and spot-check: correct headers, data rows present, no ₹ symbols in amount columns, dates formatted as `DD Mon YYYY`

- [ ] **Step 3: Test auth guard**

Hit `https://oasisvenetia.in/api/backup/csv` in an incognito window (not logged in) — should get a 401 JSON response, not a download.
