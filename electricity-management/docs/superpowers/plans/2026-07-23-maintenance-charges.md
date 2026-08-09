# Maintenance Charges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone maintenance billing module — fixed rate × flat area generates month-end bills with 15-day due dates, 24% p.a. interest on overdue, online (Razorpay) and offline payment, admin management pages, resident view, and a scheduler UI.

**Architecture:** Three new Prisma models (MaintenanceRate, MaintenanceBill, MaintenancePayment) mirror the existing electricity billing pattern. Separate API routes, admin pages, resident pages, and two cron jobs. Zero changes to existing electricity code except adding a Prisma back-relation on Connection and one nav link in the sidebar.

**Tech Stack:** Next.js 15 App Router, Prisma ORM (MySQL), Razorpay, Nodemailer, Vercel Cron, shadcn/ui, TypeScript, Zod

## Global Constraints

- GST is always 0 — never calculate or display it
- Do NOT modify any existing model's data fields, API routes, or UI components
- The only exceptions: add `maintenanceBills MaintenanceBill[]` back-relation to `Connection`; add one entry to `NAV_ITEMS` in `components/admin/sidebar-nav.tsx`; add two cron entries to `vercel.json`; append one function to `lib/email-templates.ts`; add seed rows in `prisma/seed.ts`
- Bill number format: `OM-{flatNo}-{YYYYMM}` (e.g. `OM-V405-202608`)
- Receipt number format: `MRCPT-{YYYYMMDD}-{seq}` (e.g. `MRCPT-20260801-0001`)
- Due date: billDate + 15 days
- Billing period: 1st of month to last day of month
- Amount formula: `unitArea × ratePerSqFt` — no other charges
- Interest: `amount × 0.24 × (daysOverdue / 365)`, stored in `interestCharge` field, updated daily
- Cron bill-generation route accepts `x-cron-secret` header OR valid ADMIN session
- All admin API routes guard with `guardPermission(session, "maintenance", action)`
- Resident routes restrict data to authenticated resident's own connections
- Reuse existing `PaymentMethod` and `PaymentStatus` enums

---

## File Structure

**Create:**
- `lib/maintenance-billing.ts`
- `app/api/maintenance/rates/route.ts`
- `app/api/maintenance/bills/route.ts`
- `app/api/maintenance/bills/[id]/route.ts`
- `app/api/maintenance/payments/route.ts`
- `app/api/maintenance/payments/cash/route.ts`
- `app/api/razorpay/maintenance/create-order/route.ts`
- `app/api/razorpay/maintenance/verify/route.ts`
- `app/api/cron/generate-maintenance-bills/route.ts`
- `app/api/cron/update-maintenance-interest/route.ts`
- `components/admin/maintenance-rates-manager.tsx`
- `components/admin/maintenance-bills-table.tsx`
- `components/admin/maintenance-generator.tsx`
- `app/(admin)/admin/maintenance/page.tsx`
- `app/(admin)/admin/maintenance/rates/page.tsx`
- `app/(admin)/admin/maintenance/generate/page.tsx`
- `app/(resident)/resident/maintenance/page.tsx`
- `app/(resident)/resident/maintenance/[id]/pay/page.tsx`

**Modify:**
- `prisma/schema.prisma` — add 3 models, 1 enum, 1 back-relation
- `lib/email-templates.ts` — append `maintenanceBillGeneratedEmail()`
- `components/admin/sidebar-nav.tsx` — add Maintenance nav item
- `app/(resident)/resident/dashboard/page.tsx` — add maintenance card below electricity card
- `vercel.json` — add 2 cron entries
- `prisma/seed.ts` — seed "maintenance" permission rows

---

### Task 1: Prisma Schema — New Models and Migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: existing `Connection`, `PaymentMethod`, `PaymentStatus`
- Produces: `MaintenanceRate`, `MaintenanceBill`, `MaintenancePayment`, `MaintenanceBillStatus`; `Connection.maintenanceBills` back-relation

- [ ] **Step 1: Add enum and models to schema**

Open `prisma/schema.prisma`. After the closing `}` of the `Payment` model, append:

```prisma
enum MaintenanceBillStatus {
  PENDING
  PAID
  OVERDUE
  PARTIAL
}

model MaintenanceRate {
  id            String            @id @default(cuid())
  ratePerSqFt   Decimal           @db.Decimal(10, 2)
  effectiveFrom DateTime
  createdAt     DateTime          @default(now())

  bills         MaintenanceBill[]
}

model MaintenanceBill {
  id                 String                @id @default(cuid())
  connectionId       String
  maintenanceRateId  String
  billNumber         String                @unique
  billDate           DateTime
  dueDate            DateTime
  billingPeriodStart DateTime
  billingPeriodEnd   DateTime
  unitArea           Int
  ratePerSqFt        Decimal               @db.Decimal(10, 2)
  amount             Decimal               @db.Decimal(10, 2)
  paidAmount         Decimal               @default(0) @db.Decimal(10, 2)
  interestCharge     Decimal               @default(0) @db.Decimal(10, 2)
  status             MaintenanceBillStatus @default(PENDING)
  createdAt          DateTime              @default(now())

  connection Connection          @relation(fields: [connectionId], references: [id])
  rate       MaintenanceRate     @relation(fields: [maintenanceRateId], references: [id])
  payments   MaintenancePayment[]
}

model MaintenancePayment {
  id                String        @id @default(cuid())
  maintenanceBillId String
  amount            Decimal       @db.Decimal(10, 2)
  paymentDate       DateTime
  method            PaymentMethod
  razorpayOrderId   String?
  razorpayPaymentId String?
  razorpaySignature String?
  status            PaymentStatus
  receiptNumber     String        @unique
  createdAt         DateTime      @default(now())

  bill MaintenanceBill @relation(fields: [maintenanceBillId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Add back-relation to Connection model**

In the `Connection` model block, after `bills Bill[]`, add:

```prisma
  maintenanceBills MaintenanceBill[]
```

- [ ] **Step 3: Run migration**

```bash
cd "e:/Demo Website/Electricity Bill/electricity-management"
npx prisma migrate dev --name add_maintenance_billing
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add MaintenanceRate, MaintenanceBill, MaintenancePayment schema"
```

---

### Task 2: Lib Helpers

**Files:**
- Create: `lib/maintenance-billing.ts`
- Modify: `lib/email-templates.ts`

**Interfaces:**
- Produces: `generateMaintenanceBillNumber(flatNo, date)`, `nextMaintenanceReceiptNumber()`, `maintenanceBillGeneratedEmail(params)`

- [ ] **Step 1: Create `lib/maintenance-billing.ts`**

```typescript
import { prisma } from "@/lib/prisma";

export function generateMaintenanceBillNumber(flatNo: string, billingMonth: Date): string {
  const year = billingMonth.getFullYear();
  const month = String(billingMonth.getMonth() + 1).padStart(2, "0");
  return `OM-${flatNo}-${year}${month}`;
}

export async function nextMaintenanceReceiptNumber(): Promise<string> {
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const prefix = `MRCPT-${datePart}-`;
  const last = await prisma.maintenancePayment.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });
  const seq = last ? parseInt(last.receiptNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export function isLastDayOfMonth(date: Date): boolean {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getMonth() !== date.getMonth();
}

export function calculateInterestCharge(amount: number, dueDate: Date, today: Date): number {
  if (today <= dueDate) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / msPerDay);
  return Math.round(amount * 0.24 * (daysOverdue / 365) * 100) / 100;
}
```

- [ ] **Step 2: Append email template to `lib/email-templates.ts`**

At the end of `lib/email-templates.ts`, append this function (the file already exports `shell` and `row` as module-level functions — use them):

```typescript
export function maintenanceBillGeneratedEmail(params: {
  residentName: string;
  flatNo: string;
  billNumber: string;
  billingPeriod: string;
  unitArea: number;
  ratePerSqFt: string;
  amount: string;
  dueDate: string;
}): string {
  const { residentName, flatNo, billNumber, billingPeriod, unitArea, ratePerSqFt, amount, dueDate } = params;

  const body = `
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.6;">
        Your maintenance bill for <strong>Flat ${flatNo}</strong> has been generated.
      </p>
    </td></tr>

    <tr><td style="padding:24px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:20px;">
        <tr><td align="center">
          <p style="margin:0;font-size:12px;font-weight:600;color:#1e40af;text-transform:uppercase;letter-spacing:1px;">Maintenance Amount Due</p>
          <p style="margin:6px 0 0;font-size:36px;font-weight:bold;color:#1e3a5f;">Rs. ${amount}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Due by: <strong style="color:#dc2626;">${dueDate}</strong></p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:24px 32px 32px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Bill Details</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Bill Number", billNumber)}
        ${row("Flat No", flatNo)}
        ${row("Billing Period", billingPeriod)}
        ${row("Unit Area", `${unitArea} sq ft`)}
        ${row("Rate", `Rs. ${ratePerSqFt} per sq ft`)}
        ${row("Total Amount Due", "Rs. " + amount, true)}
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Log in to the resident portal to pay online. Interest @ 24% p.a. applies after the due date.</p>
    </td></tr>
  `;

  return shell(body);
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add lib/maintenance-billing.ts lib/email-templates.ts
git commit -m "feat: add maintenance billing helpers and email template"
```

---

### Task 3: API — Maintenance Rates

**Files:**
- Create: `app/api/maintenance/rates/route.ts`

**Interfaces:**
- Consumes: `guardPermission`, `prisma`, `auth`
- Produces: `GET /api/maintenance/rates` (list), `POST /api/maintenance/rates` (create)

- [ ] **Step 1: Create `app/api/maintenance/rates/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { z } from "zod";

const rateSchema = z.object({
  ratePerSqFt: z.number().positive("Rate must be positive"),
  effectiveFrom: z.string().min(1, "effectiveFrom is required"),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canRead");
  if (guard) return guard;

  const rates = await prisma.maintenanceRate.findMany({
    orderBy: { effectiveFrom: "desc" },
  });
  return NextResponse.json(rates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canWrite");
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = rateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const rate = await prisma.maintenanceRate.create({
    data: {
      ratePerSqFt: parsed.data.ratePerSqFt,
      effectiveFrom: new Date(parsed.data.effectiveFrom),
    },
  });
  return NextResponse.json(rate, { status: 201 });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Verify manually**

Start dev server (`npm run dev`). With admin credentials, call:
```bash
curl -X POST http://localhost:3000/api/maintenance/rates \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=<your-session-cookie>" \
  -d '{"ratePerSqFt": 2.50, "effectiveFrom": "2026-08-01"}'
```
Expected: `201` with created rate object containing `id`, `ratePerSqFt`, `effectiveFrom`.

- [ ] **Step 4: Commit**

```bash
git add app/api/maintenance/rates
git commit -m "feat: add GET/POST /api/maintenance/rates"
```

---

### Task 4: API — Maintenance Bills

**Files:**
- Create: `app/api/maintenance/bills/route.ts`
- Create: `app/api/maintenance/bills/[id]/route.ts`

**Interfaces:**
- Consumes: `guardPermission`, `prisma`, `auth`
- Produces: `GET /api/maintenance/bills` (filtered list), `GET /api/maintenance/bills/[id]`, `PUT /api/maintenance/bills/[id]` (status update)

- [ ] **Step 1: Create `app/api/maintenance/bills/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canRead");
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const tower = searchParams.get("tower");
  const flatNo = searchParams.get("flatNo");
  const month = searchParams.get("month"); // YYYY-MM
  const status = searchParams.get("status");

  const validStatuses = ["PENDING", "PAID", "OVERDUE", "PARTIAL"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  let dateFilter: { gte?: Date; lt?: Date } | undefined;
  if (month) {
    const [year, mon] = month.split("-").map(Number);
    if (!year || !mon || mon < 1 || mon > 12) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
    }
    dateFilter = { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) };
  }

  const bills = await prisma.maintenanceBill.findMany({
    where: {
      ...(status ? { status: status as "PENDING" | "PAID" | "OVERDUE" | "PARTIAL" } : {}),
      ...(dateFilter ? { billDate: dateFilter } : {}),
      ...(flatNo || tower ? {
        connection: {
          ...(flatNo ? { flatNo } : {}),
          ...(tower ? { tower } : {}),
        },
      } : {}),
    },
    include: {
      connection: {
        include: {
          resident: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      },
      payments: true,
    },
    orderBy: { billDate: "desc" },
    take: 200,
  });

  return NextResponse.json(bills);
}
```

- [ ] **Step 2: Create `app/api/maintenance/bills/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as any).role as string;

  const bill = await prisma.maintenanceBill.findUnique({
    where: { id },
    include: {
      connection: {
        include: {
          resident: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      },
      payments: true,
      rate: true,
    },
  });

  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  if (role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({ where: { userId: session.user.id } });
    if (!resident || bill.connection.residentId !== resident.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(bill);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canWrite");
  if (guard) return guard;

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status } = body as { status?: string };
  const validStatuses = ["PENDING", "PAID", "OVERDUE", "PARTIAL"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const bill = await prisma.maintenanceBill.update({
    where: { id },
    data: { status: status as "PENDING" | "PAID" | "OVERDUE" | "PARTIAL" },
  });
  return NextResponse.json(bill);
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/maintenance/bills
git commit -m "feat: add maintenance bills API routes (list, single, status update)"
```

---

### Task 5: API — Offline Payments

**Files:**
- Create: `app/api/maintenance/payments/cash/route.ts`
- Create: `app/api/maintenance/payments/route.ts`

**Interfaces:**
- Consumes: `nextMaintenanceReceiptNumber()` from `lib/maintenance-billing`, `guardPermission`, `prisma`, `sendEmail`, `paymentSuccessEmail`
- Produces: `POST /api/maintenance/payments/cash`, `GET /api/maintenance/payments`

- [ ] **Step 1: Create `app/api/maintenance/payments/cash/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { nextMaintenanceReceiptNumber } from "@/lib/maintenance-billing";
import { sendEmail } from "@/lib/email";
import { paymentSuccessEmail } from "@/lib/email-templates";

const ALLOWED_METHODS = ["CASH", "UPI", "NEFT", "RTGS", "CHEQUE"] as const;
type ManualMethod = (typeof ALLOWED_METHODS)[number];

export async function POST(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canWrite");
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    maintenanceBillId,
    amount: amountParam,
    method: methodParam = "CASH",
    referenceId = null,
    paymentDate: paymentDateParam = null,
  } = body as {
    maintenanceBillId?: string;
    amount?: number;
    method?: string;
    referenceId?: string | null;
    paymentDate?: string | null;
  };

  if (!maintenanceBillId) {
    return NextResponse.json({ error: "maintenanceBillId is required" }, { status: 400 });
  }

  const method = (ALLOWED_METHODS as readonly string[]).includes(methodParam)
    ? (methodParam as ManualMethod)
    : "CASH";

  const bill = await prisma.maintenanceBill.findUnique({
    where: { id: maintenanceBillId },
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { name: true, email: true } } } },
        },
      },
    },
  });

  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  if (bill.status === "PAID") return NextResponse.json({ error: "Bill already paid" }, { status: 409 });

  const totalDue = Number(bill.amount) + Number(bill.interestCharge);
  const alreadyPaid = Number(bill.paidAmount);
  const remaining = totalDue - alreadyPaid;

  if (remaining <= 0) return NextResponse.json({ error: "Bill already fully paid" }, { status: 409 });

  let payAmount = amountParam != null ? Number(amountParam) : remaining;
  if (isNaN(payAmount) || payAmount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }
  if (payAmount > remaining + 0.01) {
    return NextResponse.json({ error: `Amount cannot exceed remaining balance of ₹${remaining.toFixed(2)}` }, { status: 400 });
  }

  const newPaidAmount = alreadyPaid + payAmount;
  const isFullyPaid = newPaidAmount >= totalDue - 0.01;
  const newStatus = isFullyPaid ? "PAID" : "PARTIAL";
  const receiptNumber = await nextMaintenanceReceiptNumber();
  const pDate = paymentDateParam ? new Date(paymentDateParam) : new Date();

  const payment = await prisma.$transaction(async (tx) => {
    const newPayment = await tx.maintenancePayment.create({
      data: {
        maintenanceBillId,
        amount: payAmount,
        paymentDate: pDate,
        method,
        status: "SUCCESS",
        receiptNumber,
        razorpayPaymentId: referenceId ?? (method === "CASH" ? "CASH" : null),
      },
    });
    await tx.maintenanceBill.update({
      where: { id: maintenanceBillId },
      data: { status: newStatus, paidAmount: newPaidAmount },
    });
    return newPayment;
  });

  try {
    const resident = bill.connection.resident;
    const html = paymentSuccessEmail({
      residentName: resident.user.name ?? "Resident",
      flatNo: bill.connection.flatNo,
      receiptNumber,
      amount: payAmount.toFixed(2),
      paymentDate: pDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      razorpayPaymentId: referenceId ?? method,
      receiptUrl: "",
    });
    await sendEmail(resident.user.email, `Maintenance Payment Received — ${bill.billNumber}`, html);
  } catch (err) {
    console.error("Maintenance payment email failed:", err);
  }

  return NextResponse.json({ success: true, receiptNumber, paymentId: payment.id, isFullyPaid, newStatus });
}
```

- [ ] **Step 2: Create `app/api/maintenance/payments/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canRead");
  if (guard) return guard;

  const payments = await prisma.maintenancePayment.findMany({
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
    take: 200,
  });
  return NextResponse.json(payments);
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/maintenance/payments
git commit -m "feat: add maintenance offline payment and list API routes"
```

---

### Task 6: API — Razorpay (Maintenance)

**Files:**
- Create: `app/api/razorpay/maintenance/create-order/route.ts`
- Create: `app/api/razorpay/maintenance/verify/route.ts`

**Interfaces:**
- Consumes: `razorpay` from `lib/razorpay`, `nextMaintenanceReceiptNumber()`, `prisma`, `auth`
- Produces: `POST /api/razorpay/maintenance/create-order`, `POST /api/razorpay/maintenance/verify`

- [ ] **Step 1: Create `app/api/razorpay/maintenance/create-order/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "RESIDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { maintenanceBillId } = body as { maintenanceBillId?: string };
  if (!maintenanceBillId) {
    return NextResponse.json({ error: "maintenanceBillId is required" }, { status: 400 });
  }

  const bill = await prisma.maintenanceBill.findUnique({
    where: { id: maintenanceBillId },
    include: { connection: { include: { resident: true } } },
  });

  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  if (bill.status !== "PENDING" && bill.status !== "OVERDUE") {
    return NextResponse.json({ error: "Bill is already paid or invalid state" }, { status: 422 });
  }

  const resident = await prisma.resident.findUnique({ where: { userId: session.user.id } });
  if (!resident || bill.connection.residentId !== resident.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const totalDue = Number(bill.amount) + Number(bill.interestCharge) - Number(bill.paidAmount);

  const order = await razorpay.orders.create({
    amount: Math.round(totalDue * 100),
    currency: "INR",
    receipt: maintenanceBillId,
  });

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: "INR",
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}
```

- [ ] **Step 2: Create `app/api/razorpay/maintenance/verify/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { paymentSuccessEmail } from "@/lib/email-templates";
import { nextMaintenanceReceiptNumber } from "@/lib/maintenance-billing";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "RESIDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, maintenanceBillId } =
    body as { razorpayOrderId?: string; razorpayPaymentId?: string; razorpaySignature?: string; maintenanceBillId?: string };

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !maintenanceBillId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const bill = await prisma.maintenanceBill.findUnique({
    where: { id: maintenanceBillId },
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
    },
  });

  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  const totalDue = Number(bill.amount) + Number(bill.interestCharge);
  const receiptNumber = await nextMaintenanceReceiptNumber();

  const payment = await prisma.$transaction(async (tx) => {
    const newPayment = await tx.maintenancePayment.create({
      data: {
        maintenanceBillId,
        amount: totalDue - Number(bill.paidAmount),
        paymentDate: new Date(),
        method: "ONLINE",
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        status: "SUCCESS",
        receiptNumber,
      },
    });
    await tx.maintenanceBill.update({
      where: { id: maintenanceBillId },
      data: { status: "PAID", paidAmount: totalDue },
    });
    return newPayment;
  });

  try {
    const resident = bill.connection.resident;
    const html = paymentSuccessEmail({
      residentName: resident.user.name ?? "Resident",
      flatNo: bill.connection.flatNo,
      receiptNumber,
      amount: (totalDue - Number(bill.paidAmount)).toFixed(2),
      paymentDate: payment.paymentDate.toDateString(),
      razorpayPaymentId,
      receiptUrl: "",
    });
    await sendEmail(resident.user.email, `Maintenance Payment Successful — ${bill.billNumber}`, html);
  } catch (emailErr) {
    console.error("Maintenance payment email failed:", emailErr);
  }

  return NextResponse.json({ success: true, receiptNumber, paymentId: payment.id });
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/razorpay/maintenance
git commit -m "feat: add Razorpay create-order and verify for maintenance bills"
```

---

### Task 7: Cron Routes + Vercel Config

**Files:**
- Create: `app/api/cron/generate-maintenance-bills/route.ts`
- Create: `app/api/cron/update-maintenance-interest/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `generateMaintenanceBillNumber()`, `isLastDayOfMonth()`, `maintenanceBillGeneratedEmail()`, `prisma`, `auth`
- Produces: `GET /api/cron/generate-maintenance-bills`, `GET /api/cron/update-maintenance-interest`

- [ ] **Step 1: Create `app/api/cron/generate-maintenance-bills/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateMaintenanceBillNumber, isLastDayOfMonth } from "@/lib/maintenance-billing";
import { sendEmail } from "@/lib/email";
import { maintenanceBillGeneratedEmail } from "@/lib/email-templates";

export async function GET(req: NextRequest) {
  // Accept cron secret OR admin session
  const cronSecret = req.headers.get("x-cron-secret");
  const isValidCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  if (!isValidCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // When triggered by cron (not admin), only run on last day of month
  if (isValidCron && !isAdmin && !isLastDayOfMonth(now)) {
    return NextResponse.json({ skipped: "not last day of month" });
  }

  // Parse optional ?month=YYYY-MM override (admin only)
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");

  let periodStart: Date;
  let periodEnd: Date;

  if (monthParam) {
    const [year, mon] = monthParam.split("-").map(Number);
    if (!year || !mon || mon < 1 || mon > 12) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
    }
    periodStart = new Date(year, mon - 1, 1);
    periodEnd = new Date(year, mon, 0, 23, 59, 59, 999);
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const rate = await prisma.maintenanceRate.findFirst({
    where: { effectiveFrom: { lte: now } },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!rate) {
    return NextResponse.json({ success: false, error: "No maintenance rate configured" }, { status: 422 });
  }

  const connections = await prisma.connection.findMany({
    where: { status: "ACTIVE" },
    include: {
      resident: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const connection of connections) {
    try {
      if (!connection.unitArea || connection.unitArea === 0) {
        console.warn(`[cron:maintenance] Skipping ${connection.flatNo}: unitArea is 0`);
        skipped++;
        continue;
      }

      const billNumber = generateMaintenanceBillNumber(connection.flatNo, periodStart);

      const existing = await prisma.maintenanceBill.findUnique({ where: { billNumber } });
      if (existing) { skipped++; continue; }

      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 15);

      const amount = Number(connection.unitArea) * Number(rate.ratePerSqFt);

      const bill = await prisma.maintenanceBill.create({
        data: {
          connectionId: connection.id,
          maintenanceRateId: rate.id,
          billNumber,
          billDate: now,
          dueDate,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          unitArea: connection.unitArea,
          ratePerSqFt: rate.ratePerSqFt,
          amount,
          paidAmount: 0,
          interestCharge: 0,
          status: "PENDING",
        },
      });

      try {
        const billingPeriodStr = `${periodStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${periodEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
        const html = maintenanceBillGeneratedEmail({
          residentName: connection.resident.user.name ?? "Resident",
          flatNo: connection.flatNo,
          billNumber: bill.billNumber,
          billingPeriod: billingPeriodStr,
          unitArea: connection.unitArea,
          ratePerSqFt: Number(rate.ratePerSqFt).toFixed(2),
          amount: amount.toFixed(2),
          dueDate: dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        });
        await sendEmail(
          connection.resident.user.email,
          `Maintenance Bill — ${periodStart.toLocaleString("en-IN", { month: "long", year: "numeric" })} — ${connection.flatNo}`,
          html
        );
      } catch (emailErr) {
        console.error(`[cron:maintenance] Email failed for ${connection.flatNo}:`, emailErr);
      }

      created++;
    } catch (err) {
      console.error(`[cron:maintenance] Error for connection ${connection.id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ success: true, created, skipped, errors });
}
```

- [ ] **Step 2: Create `app/api/cron/update-maintenance-interest/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateInterestCharge } from "@/lib/maintenance-billing";

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();

  const overdueBills = await prisma.maintenanceBill.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lt: today },
    },
    select: { id: true, amount: true, dueDate: true },
  });

  let updated = 0;

  for (const bill of overdueBills) {
    const interest = calculateInterestCharge(Number(bill.amount), bill.dueDate, today);
    await prisma.maintenanceBill.update({
      where: { id: bill.id },
      data: { status: "OVERDUE", interestCharge: interest },
    });
    updated++;
  }

  return NextResponse.json({ success: true, updated });
}
```

- [ ] **Step 3: Update `vercel.json`**

Read current `vercel.json` (contains `regions` and `functions` keys). Add a `"crons"` array:

```json
{
  "regions": ["sin1"],
  "functions": {
    "app/**": {
      "regions": ["sin1"]
    }
  },
  "crons": [
    { "path": "/api/cron/generate-maintenance-bills", "schedule": "0 23 28,29,30,31 * *" },
    { "path": "/api/cron/update-maintenance-interest", "schedule": "0 3 * * *" }
  ]
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/generate-maintenance-bills app/api/cron/update-maintenance-interest vercel.json
git commit -m "feat: add maintenance bill generation and interest update cron routes"
```

---

### Task 8: Admin — Rates Page

**Files:**
- Create: `components/admin/maintenance-rates-manager.tsx`
- Create: `app/(admin)/admin/maintenance/rates/page.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/maintenance/rates`
- Produces: `/admin/maintenance/rates` page showing current rate, history, and add-rate form

- [ ] **Step 1: Create `components/admin/maintenance-rates-manager.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface MaintenanceRate {
  id: string;
  ratePerSqFt: string;
  effectiveFrom: string;
  createdAt: string;
}

export default function MaintenanceRatesManager({ rates: initialRates }: { rates: MaintenanceRate[] }) {
  const router = useRouter();
  const [ratePerSqFt, setRatePerSqFt] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const rates = initialRates;

  const currentRate = rates[0] ?? null;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratePerSqFt || !effectiveFrom) { toast.error("Both fields are required"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/maintenance/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratePerSqFt: parseFloat(ratePerSqFt), effectiveFrom }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed"); return; }
      toast.success("Rate added");
      setRatePerSqFt(""); setEffectiveFrom("");
      router.refresh();
    } catch { toast.error("Network error"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      {currentRate && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-blue-700 mb-1">Current Rate</p>
            <p className="text-3xl font-bold text-blue-900">
              ₹{Number(currentRate.ratePerSqFt).toFixed(2)}{" "}
              <span className="text-base font-normal text-blue-700">per sq ft / month</span>
            </p>
            <p className="text-sm text-blue-600 mt-1">Effective from {fmt(currentRate.effectiveFrom)}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Add New Rate</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label htmlFor="rate">Rate (₹ per sq ft)</Label>
              <Input id="rate" type="number" step="0.01" min="0.01" placeholder="2.50"
                value={ratePerSqFt} onChange={(e) => setRatePerSqFt(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="from">Effective From</Label>
              <Input id="from" type="date" value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)} className="w-44" />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add Rate"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rate History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Rate (₹/sq ft)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Effective From</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Added On</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r, i) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">₹{Number(r.ratePerSqFt).toFixed(2)}</td>
                  <td className="px-4 py-3">{fmt(r.effectiveFrom)}</td>
                  <td className="px-4 py-3 text-gray-500">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    {i === 0
                      ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Current</Badge>
                      : <Badge variant="secondary">Historical</Badge>}
                  </td>
                </tr>
              ))}
              {rates.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No rates yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(admin)/admin/maintenance/rates/page.tsx`**

```typescript
import { auth } from "@/auth";
import type { PermissionsMap } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import MaintenanceRatesManager from "@/components/admin/maintenance-rates-manager";

export const dynamic = "force-dynamic";

export default async function MaintenanceRatesPage() {
  const session = await auth();
  const role = (session?.user as any)?.role as string;
  const permissions = (session?.user as any)?.permissions as PermissionsMap ?? {};
  const canWrite = role === "ADMIN" || permissions["maintenance"]?.canWrite === true;

  if (!canWrite) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Maintenance Rates</h1>
        <p className="text-gray-500">You do not have permission to manage rates.</p>
      </div>
    );
  }

  const rates = await prisma.maintenanceRate.findMany({ orderBy: { effectiveFrom: "desc" } });

  const serialized = rates.map((r) => ({
    id: r.id,
    ratePerSqFt: r.ratePerSqFt.toString(),
    effectiveFrom: r.effectiveFrom.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Rates</h1>
        <p className="text-sm text-gray-500 mt-1">Configure the monthly maintenance charge rate per sq ft</p>
      </div>
      <MaintenanceRatesManager rates={serialized} />
    </div>
  );
}
```

- [ ] **Step 3: Type-check and verify**

```bash
npx tsc --noEmit
```

Navigate to `/admin/maintenance/rates` in the browser. Verify the page loads, current rate is shown, and the add-rate form works.

- [ ] **Step 4: Commit**

```bash
git add components/admin/maintenance-rates-manager.tsx app/\(admin\)/admin/maintenance/rates
git commit -m "feat: admin maintenance rates management page"
```

---

### Task 9: Admin — Bills List Page

**Files:**
- Create: `components/admin/maintenance-bills-table.tsx`
- Create: `app/(admin)/admin/maintenance/page.tsx`

**Interfaces:**
- Consumes: `GET /api/maintenance/bills`, `POST /api/maintenance/payments/cash`
- Produces: `/admin/maintenance/` page with filterable table and offline payment recording

- [ ] **Step 1: Create `components/admin/maintenance-bills-table.tsx`**

```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type BillStatus = "PENDING" | "PAID" | "OVERDUE" | "PARTIAL";

export interface MaintenanceBillRow {
  id: string;
  billNumber: string;
  flatNo: string;
  tower: string;
  residentName: string;
  unitArea: number;
  amount: string;
  paidAmount: string;
  interestCharge: string;
  dueDate: string;
  billDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  ratePerSqFt: string;
  status: BillStatus;
}

function StatusBadge({ status }: { status: BillStatus }) {
  const cls: Record<BillStatus, string> = {
    PAID: "bg-green-100 text-green-800",
    OVERDUE: "bg-red-100 text-red-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    PARTIAL: "bg-blue-100 text-blue-800",
  };
  return <Badge className={`${cls[status]} hover:${cls[status]}`}>{status}</Badge>;
}

const fmtINR = (v: string | number) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function MaintenanceBillsTable({ initialData, canWrite }: { initialData: MaintenanceBillRow[]; canWrite: boolean }) {
  const [bills, setBills] = useState(initialData);
  const [tower, setTower] = useState("all");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(false);
  const [payBill, setPayBill] = useState<MaintenanceBillRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payDate, setPayDate] = useState("");
  const [payRef, setPayRef] = useState("");
  const [paying, setPaying] = useState(false);
  const [detailBill, setDetailBill] = useState<MaintenanceBillRow | null>(null);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (tower !== "all") p.set("tower", tower);
      if (status !== "all") p.set("status", status);
      if (month) p.set("month", month);
      const res = await fetch(`/api/maintenance/bills?${p}`);
      if (!res.ok) { toast.error("Failed to load bills"); return; }
      const data = await res.json();
      setBills(data.map((b: any) => ({
        id: b.id, billNumber: b.billNumber,
        flatNo: b.connection.flatNo, tower: b.connection.tower,
        residentName: b.connection.resident.user.name ?? "—",
        unitArea: b.connection.unitArea,
        amount: b.amount, paidAmount: b.paidAmount, interestCharge: b.interestCharge,
        dueDate: b.dueDate, billDate: b.billDate,
        billingPeriodStart: b.billingPeriodStart, billingPeriodEnd: b.billingPeriodEnd,
        ratePerSqFt: b.ratePerSqFt, status: b.status,
      })));
    } finally { setLoading(false); }
  };

  const handleRecordPayment = async () => {
    if (!payBill) return;
    setPaying(true);
    try {
      const res = await fetch("/api/maintenance/payments/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceBillId: payBill.id,
          amount: payAmount ? parseFloat(payAmount) : undefined,
          method: payMethod,
          referenceId: payRef || null,
          paymentDate: payDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Payment failed"); return; }
      toast.success(`Recorded. Receipt: ${data.receiptNumber}`);
      setPayBill(null); setPayAmount(""); setPayMethod("CASH"); setPayDate(""); setPayRef("");
      await fetchBills();
    } finally { setPaying(false); }
  };

  const totalAmt = bills.reduce((s, b) => s + Number(b.amount) + Number(b.interestCharge), 0);
  const totalCollected = bills.reduce((s, b) => s + Number(b.paidAmount), 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Tower</Label>
          <Select value={tower} onValueChange={setTower}>
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
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "PENDING", "PAID", "OVERDUE", "PARTIAL"].map((s) => (
                <SelectItem key={s} value={s}>{s === "all" ? "All" : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetchBills} disabled={loading} variant="outline">
          {loading ? "Loading…" : "Apply Filter"}
        </Button>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-6 text-sm bg-gray-50 rounded-lg p-3">
        <span><strong>{bills.length}</strong> bills</span>
        <span>Total Due: <strong>{fmtINR(totalAmt)}</strong></span>
        <span>Collected: <strong className="text-green-700">{fmtINR(totalCollected)}</strong></span>
        <span>Outstanding: <strong className="text-red-600">{fmtINR(totalAmt - totalCollected)}</strong></span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Bill No</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Flat / Resident</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Area</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Interest</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Due Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              {canWrite && <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button className="font-mono text-xs text-blue-600 hover:underline"
                    onClick={() => setDetailBill(bill)}>
                    {bill.billNumber}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{bill.flatNo}</p>
                  <p className="text-xs text-gray-500">{bill.residentName}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{bill.unitArea} sq ft</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{fmtINR(bill.amount)}</p>
                  {Number(bill.paidAmount) > 0 && (
                    <p className="text-xs text-green-600">Paid: {fmtINR(bill.paidAmount)}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {Number(bill.interestCharge) > 0
                    ? <span className="text-red-600 text-xs">{fmtINR(bill.interestCharge)}</span>
                    : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(bill.dueDate)}</td>
                <td className="px-4 py-3"><StatusBadge status={bill.status} /></td>
                {canWrite && (
                  <td className="px-4 py-3">
                    {bill.status !== "PAID" && (
                      <Button size="sm" variant="outline" onClick={() => {
                        setPayBill(bill);
                        const remaining = Number(bill.amount) + Number(bill.interestCharge) - Number(bill.paidAmount);
                        setPayAmount(remaining.toFixed(2));
                      }}>
                        Record Payment
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {bills.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 8 : 7} className="px-4 py-12 text-center text-gray-400">
                  No maintenance bills found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={!!payBill} onOpenChange={(open) => !open && setPayBill(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Maintenance Payment</DialogTitle></DialogHeader>
          {payBill && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-md p-3 text-sm space-y-1">
                <p><span className="text-gray-500">Bill:</span> <strong>{payBill.billNumber}</strong></p>
                <p><span className="text-gray-500">Flat:</span> {payBill.flatNo} — {payBill.residentName}</p>
                <p><span className="text-gray-500">Maintenance:</span> {fmtINR(payBill.amount)}</p>
                {Number(payBill.interestCharge) > 0 && (
                  <p><span className="text-gray-500">Interest (24% p.a.):</span> <span className="text-red-600">{fmtINR(payBill.interestCharge)}</span></p>
                )}
                <p><span className="text-gray-500">Outstanding:</span> <strong>
                  {fmtINR(Number(payBill.amount) + Number(payBill.interestCharge) - Number(payBill.paidAmount))}
                </strong></p>
              </div>
              <div className="space-y-1">
                <Label>Amount (₹)</Label>
                <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
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
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Reference / Transaction ID (optional)</Label>
                <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UTR / cheque no." />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPayBill(null)}>Cancel</Button>
                <Button onClick={handleRecordPayment} disabled={paying}>
                  {paying ? "Recording…" : "Record Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailBill} onOpenChange={(open) => !open && setDetailBill(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Bill Details</DialogTitle></DialogHeader>
          {detailBill && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-500">Bill No</span><span className="font-mono font-medium">{detailBill.billNumber}</span>
              <span className="text-gray-500">Flat</span><span>{detailBill.flatNo} ({detailBill.residentName})</span>
              <span className="text-gray-500">Period</span><span>{fmtDate(detailBill.billingPeriodStart)} – {fmtDate(detailBill.billingPeriodEnd)}</span>
              <span className="text-gray-500">Area</span><span>{detailBill.unitArea} sq ft</span>
              <span className="text-gray-500">Rate</span><span>₹{Number(detailBill.ratePerSqFt).toFixed(2)}/sq ft</span>
              <span className="text-gray-500">Maintenance</span><span className="font-bold">{fmtINR(detailBill.amount)}</span>
              <span className="text-gray-500">Interest</span><span className={Number(detailBill.interestCharge) > 0 ? "text-red-600" : ""}>{fmtINR(detailBill.interestCharge)}</span>
              <span className="text-gray-500">Paid</span><span className="text-green-700">{fmtINR(detailBill.paidAmount)}</span>
              <span className="text-gray-500">Due Date</span><span>{fmtDate(detailBill.dueDate)}</span>
              <span className="text-gray-500">Status</span><span><StatusBadge status={detailBill.status} /></span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(admin)/admin/maintenance/page.tsx`**

```typescript
import { Suspense } from "react";
import { auth } from "@/auth";
import type { PermissionsMap } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import MaintenanceBillsTable from "@/components/admin/maintenance-bills-table";
import { TableSkeleton } from "@/components/ui/page-skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function BillsData() {
  const session = await auth();
  const role = (session?.user as any)?.role as string;
  const permissions = (session?.user as any)?.permissions as PermissionsMap ?? {};
  const canWrite = role === "ADMIN" || permissions["maintenance"]?.canWrite === true;

  const bills = await prisma.maintenanceBill.findMany({
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { billDate: "desc" },
    take: 200,
  });

  const serialized = bills.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    flatNo: b.connection.flatNo,
    tower: b.connection.tower,
    residentName: b.connection.resident.user.name ?? "—",
    unitArea: b.connection.unitArea,
    amount: b.amount.toString(),
    paidAmount: b.paidAmount.toString(),
    interestCharge: b.interestCharge.toString(),
    dueDate: b.dueDate.toISOString(),
    billDate: b.billDate.toISOString(),
    billingPeriodStart: b.billingPeriodStart.toISOString(),
    billingPeriodEnd: b.billingPeriodEnd.toISOString(),
    ratePerSqFt: b.ratePerSqFt.toString(),
    status: b.status,
  }));

  return <MaintenanceBillsTable initialData={serialized} canWrite={canWrite} />;
}

export default function MaintenanceBillsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Bills</h1>
          <p className="text-sm text-gray-500 mt-1">Monthly maintenance charges · 24% p.a. interest on overdue</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/maintenance/rates"><Button variant="outline">Manage Rates</Button></Link>
          <Link href="/admin/maintenance/generate"><Button>Scheduler</Button></Link>
        </div>
      </div>
      <Suspense fallback={<TableSkeleton rows={8} cols={7} />}>
        <BillsData />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Navigate to `/admin/maintenance/` — verify table renders, filters work (click Apply Filter), and Record Payment modal opens.

- [ ] **Step 4: Commit**

```bash
git add components/admin/maintenance-bills-table.tsx app/\(admin\)/admin/maintenance/page.tsx
git commit -m "feat: admin maintenance bills list page with offline payment recording"
```

---

### Task 10: Admin — Scheduler Page + Sidebar Nav + Permissions Seed

**Files:**
- Create: `components/admin/maintenance-generator.tsx`
- Create: `app/(admin)/admin/maintenance/generate/page.tsx`
- Modify: `components/admin/sidebar-nav.tsx`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: `GET /api/cron/generate-maintenance-bills`, `GET /api/maintenance/rates`, `GET /api/connections`
- Produces: `/admin/maintenance/generate` page; Maintenance link in sidebar; "maintenance" permission rows seeded

- [ ] **Step 1: Create `components/admin/maintenance-generator.tsx`**

```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface ConnectionPreview {
  flatNo: string;
  residentName: string;
  unitArea: number;
  projectedAmount: string;
}

interface Props {
  currentRatePerSqFt: string | null;
  connections: ConnectionPreview[];
}

export default function MaintenanceGenerator({ currentRatePerSqFt, connections }: Props) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: number } | null>(null);

  const handleGenerate = async () => {
    if (!month) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cron/generate-maintenance-bills?month=${month}`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Generation failed"); return; }
      setResult(data);
      if (data.created > 0) toast.success(`${data.created} bills raised`);
      else toast.info(`No new bills (${data.skipped} already exist)`);
    } catch { toast.error("Network error"); }
    finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader><CardTitle className="text-base">Raise Maintenance Bills</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {currentRatePerSqFt ? (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
              <span className="font-medium text-blue-800">Current rate: ₹{Number(currentRatePerSqFt).toFixed(2)} per sq ft</span>
              {" · "}
              <span className="text-blue-700">{connections.length} active connections</span>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
              No maintenance rate configured. Add a rate first before generating bills.
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>Billing Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            </div>
            <Button onClick={handleGenerate} disabled={generating || !currentRatePerSqFt || !month}>
              {generating ? "Generating…" : "Raise Bills for All Customers"}
            </Button>
          </div>

          {result && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1 border">
              <p><Badge className="bg-green-100 text-green-800 mr-2">{result.created} created</Badge>New bills raised</p>
              <p><Badge variant="secondary" className="mr-2">{result.skipped} skipped</Badge>Already exist or no unit area</p>
              {result.errors > 0 && <p><Badge className="bg-red-100 text-red-800 mr-2">{result.errors} errors</Badge>Check server logs</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Active Connections Preview
              <span className="text-sm font-normal text-gray-500 ml-2">— amounts for selected month</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Flat</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Resident</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Area (sq ft)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Projected Amount</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => (
                  <tr key={c.flatNo} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{c.flatNo}</td>
                    <td className="px-4 py-2 text-gray-600">{c.residentName}</td>
                    <td className="px-4 py-2">{c.unitArea}</td>
                    <td className="px-4 py-2 font-medium">
                      {currentRatePerSqFt
                        ? `₹${(c.unitArea * Number(currentRatePerSqFt)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(admin)/admin/maintenance/generate/page.tsx`**

```typescript
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MaintenanceGenerator from "@/components/admin/maintenance-generator";

export const dynamic = "force-dynamic";

export default async function MaintenanceGeneratePage() {
  const session = await auth();
  const role = (session?.user as any)?.role as string;
  if (role !== "ADMIN") redirect("/admin/maintenance");

  const [currentRate, connections] = await Promise.all([
    prisma.maintenanceRate.findFirst({
      where: { effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.connection.findMany({
      where: { status: "ACTIVE" },
      include: {
        resident: { include: { user: { select: { name: true } } } },
      },
      orderBy: { flatNo: "asc" },
    }),
  ]);

  const connectionPreviews = connections.map((c) => ({
    flatNo: c.flatNo,
    residentName: c.resident.user.name ?? "—",
    unitArea: c.unitArea,
    projectedAmount: currentRate
      ? (c.unitArea * Number(currentRate.ratePerSqFt)).toFixed(2)
      : "0",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Bill Scheduler</h1>
        <p className="text-sm text-gray-500 mt-1">
          Raise monthly maintenance bills for all active connections. Bills are also auto-generated on the last day of each month.
        </p>
      </div>
      <MaintenanceGenerator
        currentRatePerSqFt={currentRate ? currentRate.ratePerSqFt.toString() : null}
        connections={connectionPreviews}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add Maintenance link to sidebar nav**

Open `components/admin/sidebar-nav.tsx`. In the `NAV_ITEMS` array, add the Maintenance entry after the Bills entry. First add the import: in the imports block at the top, add `Wrench` to the lucide-react import line.

Change:
```typescript
import {
  LayoutDashboard, Users, Plug, Gauge, FileText,
  CreditCard, BarChart3, Settings, LogOut, Menu,
  Zap, Building2, ShieldCheck, UserCog,
} from "lucide-react";
```

To:
```typescript
import {
  LayoutDashboard, Users, Plug, Gauge, FileText,
  CreditCard, BarChart3, Settings, LogOut, Menu,
  Zap, Building2, ShieldCheck, UserCog, Wrench,
} from "lucide-react";
```

Then in `NAV_ITEMS`, after the Bills entry, add:
```typescript
  { href: "/admin/maintenance",     label: "Maintenance",   icon: Wrench,          pageId: "maintenance" },
```

The full updated `NAV_ITEMS` array:
```typescript
const NAV_ITEMS = [
  { href: "/admin/dashboard",      label: "Dashboard",     icon: LayoutDashboard, pageId: "dashboard" },
  { href: "/admin/residents",      label: "Residents",     icon: Users,           pageId: "residents" },
  { href: "/admin/connections",    label: "Connections",   icon: Plug,            pageId: "connections" },
  { href: "/admin/meter-readings", label: "Meter Readings",icon: Gauge,           pageId: "meter-readings" },
  { href: "/admin/bills",          label: "Bills",         icon: FileText,        pageId: "bills" },
  { href: "/admin/maintenance",    label: "Maintenance",   icon: Wrench,          pageId: "maintenance" },
  { href: "/admin/payments",       label: "Payments",      icon: CreditCard,      pageId: "payments" },
  { href: "/admin/reports",        label: "Reports",       icon: BarChart3,       pageId: "reports" },
  { href: "/admin/rates",          label: "Rates",         icon: Settings,        pageId: "rates" },
  { href: "/admin/flats",          label: "Flat Info",     icon: Building2,       pageId: "flat-info" },
];
```

- [ ] **Step 4: Seed "maintenance" permissions in `prisma/seed.ts`**

Open `prisma/seed.ts`. Find the `seedPermissions()` function. Inside its permissions array (the one with entries like `{ role: "ADMIN", page: "dashboard", ... }`), add these two entries:

```typescript
// Inside the upsert or createMany call for permissions — add alongside existing entries:
{ role: "ADMIN",    page: "maintenance", canRead: true,  canWrite: true,  canDelete: true  },
{ role: "MANAGER",  page: "maintenance", canRead: true,  canWrite: true,  canDelete: false },
```

The exact insertion depends on how the seed file structures the array — look for where `{ role: "ADMIN", page: "bills", ... }` appears and add the maintenance entry in the same format immediately after it.

- [ ] **Step 5: Run seed to apply permission rows**

```bash
npx prisma db seed
```

Expected output: seed completes without error. Verify in the database (or via `/admin/permissions` page) that "maintenance" now appears in the permission matrix.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Verify in browser**

- Navigate to `/admin/maintenance/generate` — scheduler page with preview table
- Confirm "Maintenance" appears in the admin sidebar nav
- Navigate to `/admin/permissions` — confirm "maintenance" row appears for ADMIN and MANAGER

- [ ] **Step 8: Commit**

```bash
git add components/admin/maintenance-generator.tsx \
        app/\(admin\)/admin/maintenance/generate \
        components/admin/sidebar-nav.tsx \
        prisma/seed.ts
git commit -m "feat: maintenance scheduler page, sidebar nav link, permission seed"
```

---

### Task 11: Resident — Maintenance Bills Page

**Files:**
- Create: `app/(resident)/resident/maintenance/page.tsx`

**Interfaces:**
- Consumes: `prisma.maintenanceBill`, resident session
- Produces: `/resident/maintenance` — lists all maintenance bills for the authenticated resident with Pay Now links

- [ ] **Step 1: Create `app/(resident)/resident/maintenance/page.tsx`**

```typescript
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, CreditCard, AlertCircle, CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

type BillStatus = "PENDING" | "PAID" | "OVERDUE" | "PARTIAL";

function StatusBadge({ status }: { status: BillStatus }) {
  if (status === "PAID") return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 flex items-center gap-1 w-fit"><CheckCircle2 className="h-3 w-3" />PAID</Badge>;
  if (status === "OVERDUE") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1 w-fit"><AlertCircle className="h-3 w-3" />OVERDUE</Badge>;
  if (status === "PARTIAL") return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 flex items-center gap-1 w-fit"><Clock className="h-3 w-3" />PARTIAL</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 flex items-center gap-1 w-fit"><Clock className="h-3 w-3" />PENDING</Badge>;
}

const fmtINR = (v: number | string) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default async function ResidentMaintenancePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const resident = await prisma.resident.findUnique({
    where: { userId: session.user.id },
    include: {
      connections: {
        where: { status: "ACTIVE" },
        include: {
          maintenanceBills: {
            orderBy: { billDate: "desc" },
            take: 24,
          },
        },
      },
    },
  });

  if (!resident) redirect("/login");

  const bills = resident.connections.flatMap((c) => c.maintenanceBills);
  bills.sort((a, b) => b.billDate.getTime() - a.billDate.getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50">
          <Wrench className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Bills</h1>
          <p className="text-sm text-gray-500">Monthly maintenance charges for your flat</p>
        </div>
      </div>

      {bills.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No maintenance bills yet</p>
            <p className="text-sm text-gray-400 mt-1">Bills are generated at the end of each month</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => {
            const totalDue = Number(bill.amount) + Number(bill.interestCharge) - Number(bill.paidAmount);
            const canPay = bill.status === "PENDING" || bill.status === "OVERDUE" || bill.status === "PARTIAL";
            return (
              <Card key={bill.id} className={bill.status === "OVERDUE" ? "border-red-200" : ""}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-xs text-gray-500">{bill.billNumber}</p>
                        <StatusBadge status={bill.status} />
                      </div>
                      <p className="text-sm text-gray-600">
                        {fmtDate(bill.billingPeriodStart)} – {fmtDate(bill.billingPeriodEnd)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {bill.unitArea} sq ft × ₹{Number(bill.ratePerSqFt).toFixed(2)}/sq ft
                      </p>
                      {Number(bill.interestCharge) > 0 && (
                        <p className="text-xs text-red-600">
                          Interest (24% p.a.): {fmtINR(bill.interestCharge)}
                        </p>
                      )}
                    </div>
                    <div className="text-right space-y-2">
                      <p className="text-2xl font-bold text-gray-900">{fmtINR(bill.amount)}</p>
                      {Number(bill.interestCharge) > 0 && (
                        <p className="text-sm font-medium text-red-600">
                          Total due: {fmtINR(Number(bill.amount) + Number(bill.interestCharge) - Number(bill.paidAmount))}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">Due: {fmtDate(bill.dueDate)}</p>
                      {canPay && (
                        <Link href={`/resident/maintenance/${bill.id}/pay`}>
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                            <CreditCard className="h-3.5 w-3.5 mr-1" />Pay Now
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Verify**

Log in as a resident. Navigate to `/resident/maintenance/`. Verify bills are listed with correct amounts and Pay Now links. If no bills exist, generate one via the admin scheduler first.

- [ ] **Step 4: Commit**

```bash
git add app/\(resident\)/resident/maintenance/page.tsx
git commit -m "feat: resident maintenance bills list page"
```

---

### Task 12: Resident — Payment Page + Dashboard Card

**Files:**
- Create: `app/(resident)/resident/maintenance/[id]/pay/page.tsx`
- Modify: `app/(resident)/resident/dashboard/page.tsx`

**Interfaces:**
- Consumes: `GET /api/maintenance/bills/[id]`, `POST /api/razorpay/maintenance/create-order`, `POST /api/razorpay/maintenance/verify`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- Produces: `/resident/maintenance/[id]/pay` payment page; maintenance card on resident dashboard

- [ ] **Step 1: Create `app/(resident)/resident/maintenance/[id]/pay/page.tsx`**

This is a client component that loads Razorpay inline (matching the existing `PaymentForm` pattern — loads `window.Razorpay` from CDN script).

```typescript
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
```

- [ ] **Step 2: Add maintenance card to resident dashboard**

Open `app/(resident)/resident/dashboard/page.tsx`. The existing `ResidentDashboardContent` function queries `resident.connections` with electricity bills. Add a second query for the latest maintenance bill.

Find this line (inside `ResidentDashboardContent`):
```typescript
  const primaryConnection = resident.connections[0] ?? null;
  const latestBill = primaryConnection?.bills[0] ?? null;
  const pendingBill = latestBill && (latestBill.status === "PENDING" || latestBill.status === "OVERDUE") ? latestBill : null;
```

After these three lines, add:
```typescript
  const latestMaintenanceBill = await prisma.maintenanceBill.findFirst({
    where: {
      connectionId: { in: resident.connections.map((c) => c.id) },
      status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
    },
    orderBy: { billDate: "desc" },
  });
```

Then find the closing section of the JSX — after the `</Card>` that wraps the electricity "Current Bill" card, before the `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">` quick links section — insert this new maintenance card:

```typescript
      {/* Maintenance Bill Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" />Maintenance Bill
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latestMaintenanceBill ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-gray-900">{formatINR(latestMaintenanceBill.amount)}</p>
                  <p className="text-sm text-gray-500">Bill #{latestMaintenanceBill.billNumber}</p>
                  {Number(latestMaintenanceBill.interestCharge) > 0 && (
                    <p className="text-xs text-red-600">Interest: {formatINR(latestMaintenanceBill.interestCharge)}</p>
                  )}
                </div>
                <StatusBadge status={latestMaintenanceBill.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className={`rounded-md p-3 ${latestMaintenanceBill.status === "OVERDUE" ? "bg-red-50" : "bg-gray-50"}`}>
                  <p className={`text-xs mb-0.5 ${latestMaintenanceBill.status === "OVERDUE" ? "text-red-500" : "text-gray-500"}`}>Due Date</p>
                  <p className={`font-medium ${latestMaintenanceBill.status === "OVERDUE" ? "text-red-700" : ""}`}>
                    {new Date(latestMaintenanceBill.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-gray-500 text-xs mb-0.5">Area</p>
                  <p className="font-medium">{latestMaintenanceBill.unitArea} sq ft</p>
                </div>
              </div>
              <Link href={`/resident/maintenance/${latestMaintenanceBill.id}/pay`}>
                <Button size="lg" className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white text-base py-3 px-8">
                  <CreditCard className="h-5 w-5 mr-2" />Pay Maintenance — {formatINR(Number(latestMaintenanceBill.amount) + Number(latestMaintenanceBill.interestCharge) - Number(latestMaintenanceBill.paidAmount))}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div className="p-4 rounded-full bg-green-50"><CheckCircle2 className="h-8 w-8 text-green-600" /></div>
              <div>
                <p className="font-semibold text-gray-700">No outstanding maintenance bills</p>
                <p className="text-sm text-gray-500 mt-1">All maintenance charges are up to date.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
```

Also add `Wrench` to the lucide-react import in the dashboard file:
```typescript
import { Home, FileText, CreditCard, AlertCircle, CheckCircle2, Clock, Wrench } from "lucide-react";
```

- [ ] **Step 3: Add resident nav link for Maintenance**

Check `app/(resident)/resident/layout.tsx` (or the resident sidebar/nav component). Add a link to `/resident/maintenance` with a Wrench icon, using the same pattern as the existing "Bills" and "Payments" links.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Verify end-to-end**

1. Generate a maintenance bill via `/admin/maintenance/generate`
2. Log in as the resident — confirm maintenance card appears on dashboard
3. Navigate to `/resident/maintenance/` — bill is listed
4. Click Pay Now — Razorpay checkout opens with correct amount
5. Complete payment (use test mode) — bill shows as PAID

- [ ] **Step 6: Commit**

```bash
git add app/\(resident\)/resident/maintenance \
        app/\(resident\)/resident/dashboard/page.tsx
git commit -m "feat: resident maintenance payment page and dashboard card"
```

---

## Self-Review Checklist

Run after all tasks complete before deploying:

```bash
npx tsc --noEmit
npm run build
```

**Spec coverage check:**
- [ ] `MaintenanceRate`, `MaintenanceBill`, `MaintenancePayment` models exist → Task 1
- [ ] `interestCharge` field on `MaintenanceBill` → Task 1
- [ ] Bill number `OM-{flatNo}-{YYYYMM}` → Task 2 (`generateMaintenanceBillNumber`)
- [ ] Receipt number `MRCPT-{YYYYMMDD}-{seq}` → Task 2 (`nextMaintenanceReceiptNumber`)
- [ ] Due date = billDate + 15 days → Task 7 (cron route)
- [ ] Interest 24% p.a. → Task 7 (`update-maintenance-interest`) and Task 5/6 (payment routes use `interestCharge`)
- [ ] Billing period 1st–last day of month → Task 7 (cron route sets `periodStart`/`periodEnd`)
- [ ] Month-end cron schedule → Task 7 (`vercel.json`: `0 23 28,29,30,31 * *` + `isLastDayOfMonth` check)
- [ ] Admin scheduler with preview → Task 10 (`MaintenanceGenerator`)
- [ ] GST never shown → Tasks 9, 11, 12 (no GST line anywhere)
- [ ] Online payment (Razorpay) → Task 6 + Task 12
- [ ] Offline payment (cash/UPI/etc.) → Task 5 + Task 9 (Record Payment modal)
- [ ] Admin rates page → Task 8
- [ ] Admin bills list with interest column → Task 9
- [ ] Resident bills page → Task 11
- [ ] Resident payment page with interest → Task 12
- [ ] Dashboard maintenance card → Task 12
- [ ] Maintenance nav link → Task 10
- [ ] Permission seeding → Task 10
