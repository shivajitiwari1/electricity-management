# Electricity Bill Management System — Design Spec
**Date:** 2026-07-15  
**Updated:** 2026-07-15 (v2 — Vercel/Neon deployment, Oasis bill format, Excel resident import)  
**Status:** Approved  
**Approach:** Monolithic Next.js 15 App Router + API Routes

---

## 1. Overview

A full-stack electricity bill management system for **Oasis Venetia Heights** (a residential society in Greater Noida) with two portals:
- **Admin Portal** — manage residents, connections, meter readings, bill generation, email notifications, reports
- **Resident Portal** — view bills, pay online via Razorpay, download PDF bills and receipts

Deployed on **Vercel** with **Neon PostgreSQL** as the database. Bill PDF format matches the official Oasis Venetia Heights electricity bill (NPCL Power + DG Power + Fixed Charge, no GST). Residents are pre-loaded from the society's Excel inventory.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15, App Router, TypeScript |
| Styling | Tailwind CSS + Shadcn UI |
| ORM | Prisma |
| Database | Neon PostgreSQL (serverless, Vercel-native) |
| Auth | NextAuth v5, JWT strategy, Credentials provider |
| Payments | Razorpay (test mode) |
| Email | Nodemailer (Gmail SMTP, app password) |
| PDF | PDFKit (streamed via API route, Node.js runtime) |
| Charts | Recharts (admin reports) |
| CSV Export | papaparse (client-side) |
| Validation | Zod + React Hook Form |
| Password Hashing | bcryptjs (12 rounds, pure JS — no native addons needed) |
| Deployment | Vercel (auto-deploys from GitHub) |

---

## 3. Architecture & Project Structure

### Route Groups

```
app/
├── (auth)/
│   └── login/                    # Shared login page — redirects by role after auth
├── (admin)/
│   ├── layout.tsx                # Sidebar layout, ADMIN role guard
│   ├── dashboard/
│   ├── residents/                # Customer management (renamed "residents" for society context)
│   ├── connections/
│   ├── meter-readings/
│   ├── bills/
│   ├── payments/
│   └── reports/
├── (resident)/                   # Renamed from (customer)
│   ├── layout.tsx                # Top-nav layout, RESIDENT role guard
│   ├── dashboard/
│   ├── bills/
│   │   └── [id]/pay/
│   ├── payments/
│   └── profile/
└── api/
    ├── auth/[...nextauth]/
    ├── residents/
    ├── connections/
    ├── meter-readings/
    ├── bills/
    ├── payments/
    ├── razorpay/
    │   ├── create-order/
    │   └── verify/
    ├── pdf/
    │   ├── bill/[billId]/
    │   └── receipt/[paymentId]/
    ├── cron/
    │   ├── generate-bills/
    │   └── overdue-notices/
    └── reports/
```

### Supporting Directories

```
prisma/
├── schema.prisma
├── seed.ts                       # Creates admin + all 485+ residents from Excel data
└── data/
    └── residents.json            # Pre-processed resident data from Excel

lib/
├── auth.ts                       # NextAuth config (root level, not lib/)
├── prisma.ts                     # Prisma client singleton
├── email.ts                      # Nodemailer send utility
├── email-templates.ts            # HTML email templates
├── pdf.ts                        # PDFKit Oasis-format bill/receipt generators
├── razorpay.ts                   # Razorpay client singleton
└── billing.ts                    # Bill calculation logic

components/
├── ui/                           # Shadcn UI primitives
├── admin/                        # Admin-specific components
└── resident/                     # Resident-specific components

middleware.ts                     # Role-based route protection
```

---

## 4. Middleware & Auth

### Login Flow
1. User submits email + password on `/login`
2. NextAuth Credentials provider fetches `User` by email, verifies bcryptjs hash
3. JWT issued with `{ id, role, name }` claims
4. Middleware reads role and redirects:
   - `ADMIN` → `/admin/dashboard`
   - `RESIDENT` → `/resident/dashboard`

### Session
- JWT stored in `httpOnly` cookie (NextAuth default)
- Session expiry: 8 hours for ADMIN, 24 hours for RESIDENT
- No refresh tokens — re-login on expiry

### Middleware Route Protection

| Route Pattern | Required Role |
|---|---|
| `/admin/*` | `ADMIN` |
| `/resident/*` | `RESIDENT` |
| `/api/residents/*` | `ADMIN` |
| `/api/connections/*` | `ADMIN` |
| `/api/meter-readings/*` | `ADMIN` |
| `/api/bills/generate` | `ADMIN` |
| `/api/bills/[id]` (GET) | `ADMIN` or owner `RESIDENT` |
| `/api/razorpay/*` | `RESIDENT` |
| `/api/pdf/bill/[id]` | `ADMIN` or owner `RESIDENT` |
| `/api/pdf/receipt/[id]` | `ADMIN` or owner `RESIDENT` |
| `/api/payments/*` | `ADMIN` |
| `/api/reports/*` | `ADMIN` |
| `/api/cron/*` | `CRON_SECRET` header check |

### Resident Data Isolation
All resident-facing API routes derive `residentId` from the JWT — never from the request body or URL parameter alone.

### Password Security
- Hashed with bcryptjs (12 rounds) at account creation
- Admin sets initial password (seed: `Flat@123` for all imported residents)
- No self-service password reset

---

## 5. Database Schema (Prisma — PostgreSQL)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  RESIDENT
}

enum ConnectionStatus {
  ACTIVE
  INACTIVE
}

enum BillStatus {
  PENDING
  PAID
  OVERDUE
}

enum PaymentMethod {
  ONLINE
  CASH
}

enum PaymentStatus {
  INITIATED
  SUCCESS
  FAILED
}

model User {
  id        String     @id @default(cuid())
  name      String
  email     String     @unique
  password  String
  role      Role
  createdAt DateTime   @default(now())
  resident  Resident?
  auditLogs AuditLog[]
}

model Resident {
  id             String       @id @default(cuid())
  userId         String       @unique
  user           User         @relation(fields: [userId], references: [id])
  residentNumber String       @unique   // e.g. RES-0001
  phone          String?
  createdAt      DateTime     @default(now())
  connections    Connection[]
}

model Connection {
  id             String           @id @default(cuid())
  residentId     String
  resident       Resident         @relation(fields: [residentId], references: [id])
  tower          String           // A, B, C, V
  floor          String           // First, Second, etc.
  flatNo         String           @unique // A-101, B-205, V-405 (also the property number on bill)
  unitType       String           // "2BHK+2T+Study", "3BHK+2T", "Pent House - Duplex"
  unitArea       Int              // sq ft (995, 1150, 1290, 2300)
  meterNo        String?
  sanctionedLoad Decimal          // kW (4 or 5)
  status         ConnectionStatus @default(ACTIVE)
  connectedAt    DateTime         @default(now())
  meterReadings  MeterReading[]
  bills          Bill[]
}

model Rate {
  id           String   @id @default(cuid())
  ncplPerUnit  Decimal  // ₹7.00 — NPCL electricity rate per unit
  dgFixed      Decimal  // ₹200.00 — DG power fixed charge per month
  fixedPerKw   Decimal  // ₹115.00 — fixed energy charge per kW per month
  effectiveFrom DateTime
}

model MeterReading {
  id             String     @id @default(cuid())
  connectionId   String
  connection     Connection @relation(fields: [connectionId], references: [id])
  readingDate    DateTime
  ncplPrevious   Decimal    // NPCL initial reading
  ncplCurrent    Decimal    // NPCL final reading
  ncplUnits      Decimal    // ncplCurrent - ncplPrevious
  dgPrevious     Decimal    @default(0)
  dgCurrent      Decimal    @default(0)
  dgUnits        Decimal    @default(0)
  recordedById   String
  createdAt      DateTime   @default(now())
  bill           Bill?
}

model Bill {
  id                 String       @id @default(cuid())
  connectionId       String
  connection         Connection   @relation(fields: [connectionId], references: [id])
  meterReadingId     String       @unique
  meterReading       MeterReading @relation(fields: [meterReadingId], references: [id])
  billNumber         String       @unique  // OV-{flatNo}-{YYYYMM}
  billDate           DateTime
  dueDate            DateTime
  billingPeriodStart DateTime
  billingPeriodEnd   DateTime
  ncplUnits          Decimal
  ratePerUnit        Decimal      // snapshot of ncplPerUnit at bill generation
  ncplCharge         Decimal      // ncplUnits × ratePerUnit
  dgCharge           Decimal      // snapshot of dgFixed
  fixedCharge        Decimal      // sanctionedLoad × fixedPerKw
  previousDues       Decimal      @default(0)
  totalAmount        Decimal      // ncplCharge + dgCharge + fixedCharge + previousDues
  status             BillStatus   @default(PENDING)
  createdAt          DateTime     @default(now())
  payment            Payment?
}

model Payment {
  id                String        @id @default(cuid())
  billId            String        @unique
  bill              Bill          @relation(fields: [billId], references: [id])
  amount            Decimal
  paymentDate       DateTime
  method            PaymentMethod
  razorpayOrderId   String?
  razorpayPaymentId String?
  razorpaySignature String?
  status            PaymentStatus
  receiptNumber     String        @unique  // RCPT-YYYYMMDD-XXXX
  createdAt         DateTime      @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  action    String
  entity    String
  entityId  String
  meta      Json?
  createdAt DateTime @default(now())
}
```

### Key Design Decisions
- `Rate` has no unique connectionType — the society uses uniform rates for all flats. The latest `Rate` record (by `effectiveFrom`) is always used. Bills snapshot rate values at generation time.
- `Connection.flatNo` is the property number displayed on the bill (e.g., `V-405`)
- `MeterReading` tracks both NPCL and DG readings separately (DG is usually 0)
- No GST — matches the actual Oasis bill format
- `previousDues` on `Bill` — admin can enter outstanding balance when generating
- Email sending is internal to API route handlers (no public `/api/email/` route)

### Auto-Generated Number Formats
- **Resident number:** `RES-{padded 4-digit}` e.g. `RES-0001`
- **Bill number:** `OV-{flatNo}-{YYYYMM}` e.g. `OV-A-101-202607`
- **Receipt number:** `RCPT-{YYYYMMDD}-{padded 4-digit}` e.g. `RCPT-20260715-0001`

---

## 6. Core Business Logic

### Bill Calculation (Oasis Format — No GST)

```
ncplCharge   = ncplUnits × ratePerUnit          (NPCL energy charges)
dgCharge     = dgFixed                           (DG power fixed charge, snapshot)
fixedCharge  = sanctionedLoad × fixedPerKw       (fixed energy charges)
totalAmount  = ncplCharge + dgCharge + fixedCharge + previousDues
dueDate      = billDate + 9 days                 (matches "01-05-2026 → 10-05-2026" from sample)
```

### Bill Number Format
`OV-{flatNo}-{YYYYMM}` — e.g. `OV-V-405-202604` for April 2026, Flat V-405

### Duplicate Guard
System blocks generating a second bill for the same connection in the same billing period (409 Conflict).

### Monthly Auto-Scheduler
- Route: `GET /api/cron/generate-bills` with `x-cron-secret` header
- Vercel Cron Jobs (configured in `vercel.json`) calls this on the 1st of each month at 6:00 AM IST
- Loops through all `ACTIVE` connections, generates bills where none exists for current period

### Overdue Bill Processing
- Route: `GET /api/cron/overdue-notices` with `x-cron-secret` header  
- Vercel Cron Jobs calls this daily at 8:00 AM IST
- Finds all `PENDING` bills where `dueDate < today` → sets `status = OVERDUE` → sends overdue email
- One overdue email per bill (transition from PENDING → OVERDUE ensures only one send)

### Razorpay Payment Flow

```
1. Resident clicks "Pay Now" on a bill
2. POST /api/razorpay/create-order  →  creates Razorpay order, returns orderId + amount (in paise)
3. Razorpay checkout modal opens in browser
4. Resident completes payment
5. POST /api/razorpay/verify        →  HMAC signature verification
6. On success: Bill.status = PAID, Payment record created (method = ONLINE)
7. Email receipt sent via Nodemailer
8. Resident redirected to /resident/payments with success toast
9. Receipt PDF available at /api/pdf/receipt/[paymentId]
```

### PDF Bill Format (Oasis Venetia Heights Style)

Matches the official bill format:
```
┌─────────────────────────────────────────────────────────┐
│  OASIS BUILDMART INDIA PVT. LTD.        ELECTRICITY BILL│
│  Oasis Venetia Heights, Plot No-HRA, 12, A, Site-C,     │
│  Greater Noida - 201306 (UP) | Phone: 8130334857         │
├──────────────┬──────────────┬──────────────┬────────────┤
│ PROPERTY NO. │ BILL DATE    │ BILLING CYCLE│ SANCT LOAD │
│ V-405        │ 01-05-2026   │ 01-04-2026 to│ 4 KW       │
│              │              │ 30-04-2026   │            │
├──────────────┬──────────────┬──────────────┬────────────┤
│ NAME         │ DUE DATE     │ AREA         │ CONN LOAD  │
│ Mr. XYZ      │ 10-05-2026   │ 1100 Sq.Ft.  │ —          │
├─────────────────────────────────────────────────────────┤
│ ADDRESS: Flat No {flatNo}, Oasis Venetia Heights, ...    │
├─────────────────────────────────────────────────────────┤
│ METER READING DETAILS                                    │
│ Power Source │ From  │ To    │ Initial │ Final │ Units  │
│ NPCL Power   │ date  │ date  │ xxxx    │ xxxx  │ nnn    │
│ DG Power     │ date  │ date  │ 0       │ 0     │ 0      │
├─────────────────────────────────────────────────────────┤
│ BILL SUMMARY & BREAKDOWN                                 │
│ Current Energy Charges of NPCL Power      ₹ x,xxx.00   │
│ Current Energy Charges of DG Power         ₹   200.00   │
│ Fixed Energy Charges (@ ₹115 per kW/month) ₹   xxx.00   │
│ Previous Outstanding Balance               —             │
│ ─────────────────────────────────────────────────────── │
│ Net Payable Amount                        ₹ x,xxx.00    │
├─────────────────────────────────────────────────────────┤
│ PAYMENT INSTRUCTIONS                                     │
│ Pay via Razorpay or bank transfer                        │
├─────────────────────────────────────────────────────────┤
│ TERMS & NOTES                                            │
│ 1. Rate: ₹7.00/unit NPCL / DG rate ₹16.00/unit         │
│ 2. Disconnection after due date without notice           │
│ 3. Reconnection fee ₹500 + 24% p.a. interest            │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Resident Data Import (Excel → Seed)

The Excel file `SOCIETY ELECTRICITY WORKING 14-07-26.xlsx` contains 485+ residents across Towers A, B, C, and V. Pre-process into `prisma/data/residents.json`:

```json
[
  {
    "tower": "A",
    "floor": "First",
    "flatNo": "A-101",
    "unitType": "2BHK+2T+Study",
    "unitArea": 1150,
    "sanctionedLoad": 4,
    "dgFixed": 200,
    "ratePerUnit": 7,
    "customerName": "Mr. Bachoo Singh Bhagaur",
    "meterNo": ""
  }
]
```

Seed creates for each resident (where `customerName` is non-empty):
- `User`: `email = flatno@oasis.local` (lowercase, e.g. `a-101@oasis.local`), `password = bcrypt("Flat@123")`, `role = RESIDENT`
- `Resident`: `residentNumber = RES-{seq}`
- `Connection`: all flat details

---

## 8. Admin Portal

### Dashboard (`/admin/dashboard`)
- Stats: Total Residents, Active Connections, Bills This Month, Revenue This Month, Overdue Bills
- Recent Bills table (last 10 with status badges)
- Quick actions: Add Resident, Enter Meter Readings, View Reports

### Resident Management (`/admin/residents`)
- Searchable table by name/flat: Flat No, Tower, Name, Email, Status, Actions
- Add Resident form: flat details, name, phone, email, initial password
- Edit/deactivate resident (soft-delete preserves billing history)

### Connection Management (`/admin/connections`)
- List with filters: Tower (A/B/C/V), status
- View/edit connection: meter number, sanctioned load, status

### Rate Management (`/admin/rates`)
- Current rates: NPCL per unit, DG fixed, Fixed per kW
- Update rates (creates new Rate record with effectiveFrom = today)
- Rate history table

### Meter Readings (`/admin/meter-readings`)
- Select flat → enter NPCL current reading (previous auto-populated), DG reading (optional)
- System shows computed units on entry
- "Generate Bill" button after saving reading
- Previous dues field (defaults to 0, admin edits if needed)

### Bills (`/admin/bills`)
- List all bills: Flat#, Resident, Period, Amount, Due Date, Status
- Filter: Tower, Month, Status
- Per row: View details, Download PDF, Manual Generate

### Payments (`/admin/payments`)
- All payments: Flat#, Resident, Amount, Method, Razorpay ID, Date
- Filter: date range, method, status

### Reports (`/admin/reports`)
- Monthly revenue by Tower (bar chart + table)
- Overdue bills list
- Unit-wise consumption summary
- Export to CSV

---

## 9. Resident Portal

### Dashboard (`/resident/dashboard`)
- Welcome: resident name, flat number, tower
- Current bill card: amount due, due date, status badge, "Pay Now" CTA
- Quick links: All Bills, Payment History

### Bills (`/resident/bills`)
- List: Bill#, Period, NPCL Units, Total, Due Date, Status
- Per row: "View Details" modal (full Oasis-format breakdown), "Download PDF"

### Pay (`/resident/bills/[id]/pay`)
- Bill summary → "Pay ₹{amount} via Razorpay" button
- Razorpay checkout modal
- On success: redirect to `/resident/payments` with toast

### Payment History (`/resident/payments`)
- Table: Receipt#, Bill#, Amount, Date, Method, Transaction ID
- Per row: "Download Receipt" PDF

### Profile (`/resident/profile`)
- Read-only: name, email, phone, flat no, tower, unit type, area, sanctioned load

---

## 10. Email Notifications

| Trigger | Recipient | Content |
|---|---|---|
| Bill generated | Resident | Bill summary, amount, due date, Pay Now link |
| Payment successful | Resident | Receipt#, amount, Razorpay ID, Download link |
| Bill overdue | Resident | Overdue notice, amount, Pay Now link |

Templates in `lib/email-templates.ts` as plain HTML.

---

## 11. Error Handling

- **API routes:** try/catch, `{ error: string }` JSON with correct HTTP codes
- **Client forms:** Zod + React Hook Form inline errors
- **Razorpay failure:** Payment stays `INITIATED`, bill stays `PENDING` — retry allowed
- **Duplicate bill:** `409 Conflict`
- **PDF error:** `500` JSON body
- **Audit logging:** All admin write actions → `AuditLog`

---

## 12. Security

- JWT `httpOnly` cookie
- bcryptjs (12 rounds)
- Role-based middleware protection
- Resident data isolation via JWT claims
- Razorpay HMAC verification before marking payment success
- Cron routes protected by `CRON_SECRET`
- Zod validation on all API inputs
- Prisma ORM (no raw SQL)

---

## 13. Environment Variables

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/electricity_management?sslmode=require"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="https://your-app.vercel.app"

# Razorpay
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_..."

# Email (Gmail SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your@gmail.com"
SMTP_PASS="gmail-app-password"
SMTP_FROM="Oasis Venetia Heights <your@gmail.com>"

# Cron (Vercel Cron Jobs)
CRON_SECRET="generate-with-openssl-rand-base64-32"
```

---

## 14. Vercel Deployment Config (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-bills",
      "schedule": "30 0 1 * *"
    },
    {
      "path": "/api/cron/overdue-notices",
      "schedule": "30 2 * * *"
    }
  ]
}
```

Cron schedule uses UTC. `30 0 1 * *` = 1st of month at 00:30 UTC (≈6:00 AM IST). `30 2 * * *` = daily 02:30 UTC (≈8:00 AM IST).

Build command: `prisma generate && next build`

---

## 15. Seed Data

`prisma/seed.ts` creates:
1. 1 Admin user: `admin@oasis.local` / `Admin@123`
2. 1 Rate record: NPCL ₹7.00/unit, DG fixed ₹200.00, Fixed ₹115.00/kW
3. All residents from `prisma/data/residents.json` (~485 active flats across Towers A, B, C, V):
   - Each gets: `User` (email: `{flatno}@oasis.local`, password: `Flat@123`), `Resident`, `Connection`

---

## Out of Scope
- Multi-admin roles
- IoT meter integration
- SMS notifications
- Mobile app
- Self-service password reset
- Resident self-registration
- DG unit-based billing (DG charge is fixed per month, units tracking is informational only)
