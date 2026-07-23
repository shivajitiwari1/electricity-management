# Maintenance Charges Implementation Design

**Goal:** Add a fully separate maintenance billing module where a fixed rate (₹ per sq ft) is applied to each flat's unit area to generate monthly bills, with online (Razorpay) and offline payment support.

**Architecture:** Three new Prisma models (MaintenanceRate, MaintenanceBill, MaintenancePayment) mirror the existing electricity billing pattern. New admin pages, resident pages, API routes, and a cron job are added without touching any existing electricity billing code.

**Tech Stack:** Next.js 15 App Router, Prisma ORM, MySQL, Razorpay, Nodemailer, Vercel Cron

---

## Global Constraints

- GST is always 0 on maintenance bills — never calculate or display it
- Do NOT modify any existing model's fields, API route, or UI component — the one exception is adding a Prisma back-relation field `maintenanceBills MaintenanceBill[]` to the existing `Connection` model (required by Prisma ORM; zero database table change)
- Bill number format: `OM-{flatNo}-{YYYYMM}` (e.g. `OM-V405-202608`)
- Receipt number format: `MRCPT-{YYYYMMDD}-{seq}` (e.g. `MRCPT-20260801-0001`)
- Due date: billDate + 15 days
- Amount formula: `unitArea (sq ft) × ratePerSqFt (₹)` — no other charges
- **Billing period**: 1st of month to last day of month (28/29/30/31)
- **Bills generated at month-end**: the automatic cron runs on the last day of each month
- **Interest**: 24% per annum charged on overdue amount after due date — formula: `amount × 0.24 × (daysOverdue / 365)`, stored in `interestCharge` field on the bill, updated daily by a separate cron
- **Scheduler**: admin can manually select a month and raise bills for all active connections (manual trigger of the same generation logic)
- Cron protected by same `x-cron-secret` header as existing cron routes; admin session (ADMIN role) may also trigger the generation route directly
- All new admin pages respect the existing `guardPermission` pattern
- All new resident pages restrict data to the authenticated resident's own connections

---

## Data Layer

### New Models

#### MaintenanceRate
Stores the fixed rate per sq ft with effective-date history. Only one rate is "current" (the one with the latest `effectiveFrom` that is ≤ today).

```prisma
model MaintenanceRate {
  id            String   @id @default(cuid())
  ratePerSqFt   Decimal  @db.Decimal(10, 2)
  effectiveFrom DateTime
  createdAt     DateTime @default(now())

  bills MaintenanceBill[]
}
```

#### MaintenanceBill
One record per active Connection per billing month. Snapshots both `unitArea` and `ratePerSqFt` at creation time so historical accuracy is preserved if the rate changes.

```prisma
model MaintenanceBill {
  id                 String              @id @default(cuid())
  connectionId       String
  maintenanceRateId  String
  billNumber         String              @unique
  billDate           DateTime
  dueDate            DateTime
  billingPeriodStart DateTime
  billingPeriodEnd   DateTime
  unitArea           Int
  ratePerSqFt        Decimal             @db.Decimal(10, 2)
  amount             Decimal             @db.Decimal(10, 2)
  paidAmount         Decimal             @default(0) @db.Decimal(10, 2)
  interestCharge     Decimal             @default(0) @db.Decimal(10, 2)
  status             MaintenanceBillStatus @default(PENDING)
  createdAt          DateTime            @default(now())

  connection connection          @relation(fields: [connectionId], references: [id])
  rate       MaintenanceRate     @relation(fields: [maintenanceRateId], references: [id])
  payments   MaintenancePayment[]
}

enum MaintenanceBillStatus {
  PENDING
  PAID
  OVERDUE
  PARTIAL
}
```

#### MaintenancePayment
Records each payment against a MaintenanceBill. Reuses existing enums.

```prisma
model MaintenancePayment {
  id                  String              @id @default(cuid())
  maintenanceBillId   String
  amount              Decimal             @db.Decimal(10, 2)
  paymentDate         DateTime
  method              PaymentMethod
  razorpayOrderId     String?
  razorpayPaymentId   String?
  razorpaySignature   String?
  status              PaymentStatus
  receiptNumber       String              @unique
  createdAt           DateTime            @default(now())

  bill MaintenanceBill @relation(fields: [maintenanceBillId], references: [id], onDelete: Cascade)
}
```

---

## API Routes

All new routes — no existing routes modified.

### Maintenance Rates
- `GET /api/maintenance/rates` — list all rates (newest first)
- `POST /api/maintenance/rates` — create a new rate (`{ ratePerSqFt, effectiveFrom }`)

### Maintenance Bills
- `GET /api/maintenance/bills` — list bills, filters: `tower`, `month` (YYYY-MM), `status`, `flatNo`
- `GET /api/maintenance/bills/[id]` — single bill with connection, resident, payments
- `PUT /api/maintenance/bills/[id]` — update status (admin: mark OVERDUE, etc.)

### Maintenance Payments
- `POST /api/maintenance/payments/cash` — record offline payment (admin only)
  - Body: `{ maintenanceBillId, amount, method, paymentDate }`
  - Generates `receiptNumber`, updates `paidAmount` and `status` on the bill
- `GET /api/maintenance/payments` — list payments (admin)

### Razorpay
- `POST /api/razorpay/maintenance/create-order` — creates Razorpay order for a maintenance bill
  - Body: `{ maintenanceBillId }`
  - Returns: `{ orderId, amount, currency }`
- `POST /api/razorpay/maintenance/verify` — verifies HMAC, creates MaintenancePayment, marks bill PAID
  - Body: `{ razorpayOrderId, razorpayPaymentId, razorpaySignature, maintenanceBillId }`

### Cron
- `GET /api/cron/generate-maintenance-bills` — monthly bill generation (also used by admin scheduler)
  - Accepts `x-cron-secret` header (automated) OR valid ADMIN session (manual scheduler)
  - Accepts optional `?month=YYYY-MM` query param (admin override; defaults to current month)
  - Runs automatically on the last day of each month — the route checks `isLastDayOfMonth()` when triggered by cron; admin trigger bypasses this check
  - Fetches all ACTIVE connections with their `unitArea`
  - Fetches latest MaintenanceRate where `effectiveFrom ≤ billDate`
  - For each connection: skips if `OM-{flatNo}-{YYYYMM}` already exists, skips if `unitArea = 0`
  - Creates MaintenanceBill: `amount = unitArea × ratePerSqFt`, `dueDate = billDate + 15 days`, `billingPeriodStart = 1st of month`, `billingPeriodEnd = last day of month`
  - Sends email notification to resident
  - Returns: `{ created: N, skipped: N, errors: N }`

- `GET /api/cron/update-maintenance-interest` — daily interest update
  - Protected by `x-cron-secret` header only
  - Finds all PENDING/PARTIAL bills where `dueDate < today`
  - Marks them OVERDUE
  - Calculates `interestCharge = amount × 0.24 × (daysOverdue / 365)` (rounded to 2 decimal places)
  - Updates `interestCharge` and `status = OVERDUE` in a batch update
  - Returns: `{ updated: N }`

---

## Admin Interface

Three new pages under `/admin/maintenance/`. All protected by the existing `guardPermission` pattern using a new `"maintenance"` page key added to the Permission matrix.

### `/admin/maintenance/` — Bill List
- Table with columns: billNumber, flatNo, tower, residentName, unitArea (sq ft), amount (₹), dueDate, status badge
- Filters: tower dropdown, month picker, status dropdown
- Actions per row:
  - **View details** — modal showing bill breakdown and payment history
  - **Record payment** — inline form for offline payment (method, amount, date)
  - **Mark paid** — quick action for fully paid offline bills
- Summary row: total amount, total collected

### `/admin/maintenance/rates/` — Rate Management
- Current rate displayed prominently: "₹ X.XX per sq ft (effective from DD MMM YYYY)"
- Rate history table: ratePerSqFt, effectiveFrom, createdAt
- "Add New Rate" form: ratePerSqFt (number input), effectiveFrom (date picker)
  - New rate takes effect from chosen date; all bills created after that date use the new rate
  - Historical bills keep their snapshot rate

### `/admin/maintenance/generate/` — Scheduler (Manual Generation)
- Month picker (default: current month)
- "Raise Bills for All Customers" button → calls cron route with admin session (no cron secret needed)
- Table preview of all active connections (flatNo, residentName, unitArea, projected amount) before generating
- Result display: "X bills created, Y skipped (already existed)"
- Used to manually trigger generation outside the cron schedule, to backfill a missed month, or to trigger mid-month when needed

---

## Resident Interface

### `/resident/maintenance/` — Maintenance Bill List
- Table/card list: billingPeriod, unitArea, ratePerSqFt, amount, dueDate, status badge
- "Pay Now" button (green) on PENDING/OVERDUE bills → navigates to pay page
- Restricted to authenticated resident's connections only

### `/resident/maintenance/[id]/pay/` — Online Payment Page
- Bill summary card:
  - Flat: V-405, Period: August 2026
  - Unit Area: 950 sq ft
  - Rate: ₹ 2.50 per sq ft
  - Maintenance Charge: ₹ 2,375.00
  - Interest (24% p.a.): ₹ X.XX (only shown if bill is OVERDUE; 0 if within due date)
  - **Total Payable: ₹ 2,375.00 + interest**
  - GST: not displayed (always 0)
  - Due Date: 15 Aug 2026
- "Pay ₹ X.XX" button (amount = amount + interestCharge - paidAmount) → calls `/api/razorpay/maintenance/create-order`
- On Razorpay success → calls `/api/razorpay/maintenance/verify` → redirects to success page

### Resident Dashboard Addition
- New maintenance bill card added below the existing electricity bill card
- Same visual style: amount, status badge, dueDate, "Pay Now" button
- Shows only the most recent PENDING/OVERDUE maintenance bill (or "No dues" if all paid)
- The existing electricity card is NOT modified — new card is purely additive

---

## Email Notification

When a maintenance bill is generated (by cron or manually), send an email to the resident using the existing `sendEmail()` infrastructure:

- Subject: `Maintenance Bill for [flatNo] – [Month Year]`
- Body: flat number, billing period, unit area, rate, amount due, due date
- No PDF attachment for MVP — text email only

---

## Bill Generation Logic (detailed)

```
billingMonth = monthParam ?? currentMonth  (YYYY-MM, e.g. "2026-08")
billingPeriodStart = first day of billingMonth  (e.g. 2026-08-01 00:00:00)
billingPeriodEnd   = last day of billingMonth   (e.g. 2026-08-31 23:59:59)
billDate = today (actual date of generation)
dueDate  = billDate + 15 days

for each ACTIVE Connection:
  if connection.unitArea = 0 → skip (log warning)
  
  billNumber = "OM-" + flatNo + "-" + YYYYMM  (YYYYMM from billingMonth)
  if MaintenanceBill with billNumber exists → skip (idempotent)
  
  rate = latest MaintenanceRate where effectiveFrom ≤ billDate
  if no rate exists → skip (log warning)
  
  amount = connection.unitArea × rate.ratePerSqFt
  
  create MaintenanceBill {
    connectionId, maintenanceRateId: rate.id,
    billNumber, billDate, dueDate,
    billingPeriodStart, billingPeriodEnd,
    unitArea: connection.unitArea,
    ratePerSqFt: rate.ratePerSqFt,
    amount, paidAmount: 0, interestCharge: 0, status: PENDING
  }
  
  send email to resident

When triggered by cron (not admin): first check isLastDayOfMonth(today) — if false, return { skipped: "not last day of month" }
When triggered by admin: skip the last-day check, always generate for specified month
```

## Interest Update Logic (daily cron)

```
today = now

find all MaintenanceBills where:
  status IN (PENDING, PARTIAL)
  dueDate < today

for each overdue bill:
  daysOverdue = floor((today - dueDate) / 86400000)
  interestCharge = bill.amount × 0.24 × (daysOverdue / 365)
  
  update MaintenanceBill {
    status: OVERDUE,
    interestCharge: round(interestCharge, 2)
  }
```

---

## Vercel Cron Configuration

Add two entries to `vercel.json` (existing entries untouched):

```json
{ "path": "/api/cron/generate-maintenance-bills", "schedule": "0 23 28,29,30,31 * *" }
{ "path": "/api/cron/update-maintenance-interest", "schedule": "0 3 * * *" }
```

- Bill generation cron runs at 23:00 UTC on the 28th–31st of each month; the route internally checks `isLastDayOfMonth()` and exits early if not the last day (handles Feb 28/29, months ending on 30, 31).
- Interest update cron runs daily at 03:00 UTC.

---

## Permission Matrix

Add `"maintenance"` as a new page in the Permission model:
- ADMIN: canRead ✓, canWrite ✓, canDelete ✓ (seeded by default)
- MANAGER: canRead ✓, canWrite ✓, canDelete ✗ (seeded by default)
- RESIDENT: no entry (resident access handled by session-based ownership check)

---

## What Is Explicitly NOT In Scope

- File upload / receipt PDF attachment
- GST calculation (always 0, not shown)
- Modifying existing electricity Bill, Payment, Rate, or MeterReading models
- Modifying existing admin or resident electricity pages
- Maintenance bill PDF generation (can be added later)
- Late payment penalties
