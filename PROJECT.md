# Oasis Venetia Heights — Project Memory

Last reviewed: 2026-10-27

This file is the durable engineering context for future development. Read it before changing the app. It records what exists, the business rules that must not be broken, known problems, and the expected maintenance workflow.

> Internal engineering notes. The repository has previously been public. Do not add credentials, tokens, passwords, customer data, or database dumps to this file.

---

## 1. What this project is

A full-stack billing portal for **Oasis Venetia Heights**, a residential society in Greater Noida.

It has two portals:

- **Admin / Manager portal** — residents, connections, flats, meter readings, electricity bills, electricity payments, maintenance billing, maintenance payments, reports, managers, permissions.
- **Resident portal** — bills, payment instructions, payment history, receipts, maintenance bills, profile.

The original scope was electricity billing only. The current app also includes a large **maintenance billing** module and a **MANAGER** role, which are not in the original design spec.

Production shape:

- Next.js app deployed on Vercel.
- Database is **MySQL/TiDB Cloud**, reached through Prisma 7 and `@prisma/adapter-mariadb`.
- Real payments in the UI are **manual UPI/NEFT + WhatsApp confirmation**, with admin recording the payment. Razorpay code exists but is not wired into the UI.

---

## 2. Repository layout

The repository root is a deployment wrapper around the actual Next.js app.

```text
/
├─ vercel.json                 # outputDirectory: electricity-management/.next
├─ PROJECT.md                  # this file
├─ AGENTS.md                   # agent instructions; points here
├─ backups/                    # database dumps (see security notes)
├─ docs/superpowers/           # design specs and implementation plans
├─ testing/                    # screenshots and demo videos, not tests
├─ prisma/data/residents.json  # seed data at repo root
└─ electricity-management/     # the Next.js application
   ├─ app/
   │  ├─ (admin)/admin/        # admin pages
   │  ├─ (resident)/resident/  # resident pages
   │  ├─ (auth)/               # login, forgot/reset password
   │  ├─ (legal)/              # about, terms
   │  ├─ maintenance/          # maintenance-mode holding page
   │  ├─ pay/[token]/          # public tokenized bill page
   │  └─ api/                  # all API routes
   ├─ components/
   │  ├─ admin/                # admin tables, dialogs, sidebar
   │  ├─ resident/             # resident tables, payment forms
   │  └─ ui/                   # shadcn-style primitives
   ├─ lib/                     # billing, PDF, email, auth helpers, caches
   ├─ prisma/
   │  ├─ schema.prisma
   │  ├─ seed.ts               # destructive; do not run against production
   │  └─ data/residents.json
   ├─ auth.ts                  # NextAuth callbacks
   ├─ auth.config.ts           # JWT/session/cookie config
   ├─ middleware.ts            # route and maintenance-mode gates
   ├─ AGENTS.md                # Next.js 16 rules + pointer to this file
   └─ vercel.json              # region and cron schedule
```

`electricity-management/AGENTS.md` contains an important instruction: this is Next.js 16, and relevant docs must be read from `node_modules/next/dist/docs/` before writing Next.js code.

---

## 3. Stack and runtime

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.10, App Router |
| UI | React 19.2.4, TypeScript 5, Tailwind CSS 4, shadcn/Radix/Base UI |
| Data | Prisma 7, `@prisma/adapter-mariadb`, MySQL/TiDB Cloud |
| Auth | NextAuth v5 beta, Credentials provider, JWT sessions |
| Passwords | bcryptjs |
| Validation | Zod 4, React Hook Form |
| Payments | Razorpay SDK present, but UI is manual UPI/NEFT |
| Email | Nodemailer |
| PDF | PDFKit |
| Excel/CSV | ExcelJS, JSZip, PapaParse |
| QR | qrcode |
| Charts | Recharts |
| Toasts | Sonner |
| Theme | next-themes |
| Deployment | Vercel; Singapore region (`sin1`) |

There is **no automated test suite**. `testing/` contains manual screenshots and MP4 recordings.

---

## 4. Authentication, roles, and access

Roles:

- `ADMIN` — full access.
- `MANAGER` — access controlled by per-page `Permission` rows.
- `RESIDENT` — own bills, payments, maintenance bills, profile.

Auth flow:

1. `/login` submits email + password.
2. NextAuth Credentials provider fetches the user, checks `isActive`, and verifies the bcrypt hash.
3. JWT is issued with `id`, `role`, `isActive`, and manager `permissions`.
4. `middleware.ts` redirects by role.
5. `IdleTimeout` signs the user out after 10 minutes of inactivity (client-side only).

Important behaviour:

- Manager permissions are captured into the JWT at login. Permission changes and deactivation do **not** apply until the manager logs in again.
- Session `maxAge` is not explicitly configured; NextAuth defaults to 30 days.
- ADMIN-only pages/APIs: `/admin/users`, `/admin/permissions`, `/api/users`, `/api/permissions`.
- Maintenance mode blocks residents/public, but ADMIN and MANAGER bypass it.
- `auth.config.ts` hardcodes the cookie domain to `.oasisvenetia.in`, which breaks preview deployments and alternate domains.
- Forgot/reset password exists. Reset tokens are currently reusable for 24 hours.

---

## 5. Implemented features

### 5.1 Public pages

- `/` redirects to `/about`.
- `/about` — society, legal entity, portal, Oasis Group, bank details.
- `/terms` — terms page.
- `/maintenance` — holding page when maintenance mode is on.
- `/login`, `/forgot-password`, `/reset-password/[token]`.
- `/pay/[token]` — public tokenized bill page:
  - Bill summary and PDF.
  - UPI QR and bank transfer details.
  - WhatsApp confirmation link.
  - No public payment recording; admin reconciles manually.

### 5.2 Admin dashboard

- Stats: residents, active connections, bills this month, revenue, overdue, partial payments.
- Recent bills table.
- Quick actions: add resident, enter reading, reports.
- CSV/database ZIP backup download.
- Maintenance-mode toggle (ADMIN only).

### 5.3 Residents

- Searchable list with tower/status filters.
- Add resident:
  - Pick a flat; tower, floor, unit type, and area auto-fill.
  - Owner/tenant fields.
  - Creates the login user, resident, and connection.
- Edit personal details and connection details.
- Deactivate/reactivate resident.
- Permanently delete resident.
- Per-resident history modal:
  - Electricity bills, payments, maintenance bills.
  - XLSX export of history.

### 5.4 Connections and flats

- Connection list with tower/status filters.
- Edit meter number, sanctioned load, status.
- Flat inventory CRUD in `FlatInfo`: flat number, tower, floor, unit type, area.
- A static full flat list also exists in `lib/flat-data.ts` for forms.

### 5.5 Electricity rates

- Current rates: NPCL per unit, DG fixed charge, fixed charge per kW.
- Update rates by creating a new `Rate` row with `effectiveFrom`.
- Rate history and delete.

### 5.6 Meter readings

- Add reading: NPCL previous/current, DG previous/current, computed units.
- Previous reading auto-populates.
- Delete reading.
- Generate a bill from a reading.
- Filters for flat and bill status.

### 5.7 Electricity bills

- Bill calculation:

```text
NPCL charge  = NPCL units × NPCL rate per unit
DG charge    = fixed DG charge
Fixed charge = sanctioned load (kW) × fixed charge per kW
Total        = NPCL charge + DG charge + Fixed charge + previous dues
Due date     = bill date + 9 days
```

- No GST on electricity bills.
- Bill number: `OV-{flatNo}-{YYYYMM}`.
- Duplicate bill for the same connection and month is blocked.
- Statuses: `PENDING`, `PAID`, `PARTIAL`, `OVERDUE`, `CARRIED_FORWARD`.
- Carry-forward:
  - When a new bill is generated with `previousDues`, unpaid older bills that are fully covered are marked `CARRIED_FORWARD` and linked to the new bill.
  - Partially covered older bills remain open.
- Bill list: filters, details, PDF, resend email, mark paid, delete.
- Balance-reminder email route exists.

### 5.8 Electricity payments

- Record cash/UPI/NEFT/RTGS/cheque payments.
- Full or partial payment.
- Bill becomes `PAID` or `PARTIAL`; `paidAmount` and balance are recalculated.
- Payment list with filters.
- Receipt PDF.
- Delete payment and restore the bill balance.
- Receipt number: `RCPT-YYYYMMDD-XXXX`.
- Payment history per bill/resident.

### 5.9 Maintenance billing

- Maintenance billing toggle in `SiteConfig`.
- Maintenance rate per square foot with effective date.
- GST configuration: CGST and SGST, default 9% + 9%.
- Generate bills:
  - Bulk for a month.
  - One flat at a time.
- Advance payment for multiple months.
- Maintenance bill calculation:

```text
Base          = round(unitArea × ratePerSqFt)
CGST          = round(base × CGST rate)
SGST          = round(base × SGST rate)
Stored amount = base + CGST + SGST       # GST-INCLUSIVE
Net payable   = stored amount + previous due + interest - paid
Due date      = 15th of the month after the billing month
Interest      = 12% per annum, simple, after due date
```

- Bill list: filters, details, PDF, email, demand letter, delete, Excel export.
- Record maintenance payment with optional rebate/waiver.
- Maintenance payment list and delete.
- Statuses: `PENDING`, `PARTIAL`, `OVERDUE`, `PAID`.
- Receipt route exists.

### 5.10 Reports

- Date-range filters.
- Monthly revenue chart.
- Tower-wise revenue chart.
- Overdue bills table with days overdue.
- PDF export.
- XLSX export.

### 5.11 Managers and permissions

- ADMIN can add/edit/delete managers.
- Activate/deactivate managers.
- Welcome email on manager creation.
- Permission matrix for MANAGER: read/write/delete per page.
- Sidebar hides pages based on `canRead`.
- Changes require manager re-login to take effect.

### 5.12 Resident portal

- Dashboard with latest outstanding bill and pay CTA.
- Electricity bill list.
- Bill pay page: UPI QR, bank details, WhatsApp confirmation.
- Maintenance bill list and pay page.
- Payment history with receipt download.
- Read-only profile: personal, flat, connection details.
- Maintenance menu appears only when maintenance billing is enabled.
- Forgot/reset password.

### 5.13 Automation

Cron routes:

- `/api/cron/generate-bills`
- `/api/cron/overdue-notices`
- `/api/cron/generate-maintenance-bills`
- `/api/cron/maintenance-overdue-notices`
- `/api/cron/update-maintenance-interest`

All require the `x-cron-secret` header matching `CRON_SECRET`.

Only one is scheduled in `electricity-management/vercel.json`:

- `/api/cron/overdue-notices` at `0 2 * * *`.

The other four must be scheduled or called manually.

---

## 6. Billing rules that must not be broken

### Electricity

- Electricity bills have **no GST**.
- Use `lib/billing.ts` for calculations; do not duplicate the formula in components.
- `previousDues` is part of `totalAmount`.
- Due date is bill date + 9 days.
- Carry-forward semantics are implemented in `lib/carry-forward.ts` and `POST /api/bills`.
- A bill marked `CARRIED_FORWARD` is no longer separately payable; its balance lives in the newer bill.

### Maintenance

- `MaintenanceBill.amount` is **GST-inclusive**.
- Never add CGST/SGST on top of `amount` for display, payment, PDF, or email.
- Use `splitMaintenanceAmount()` from `lib/maintenance-billing.ts` to derive base and GST.
- Construction is base + CGST + SGST, stored as total.
- Due date is the 15th of the following month, derived from the billing period.
- Interest is simple 12% per annum, counted after the due date.
- Advance bills and rebate/waiver adjustments are supported.

### Money handling

- Use Prisma `Decimal` for money; avoid floating-point arithmetic.
- Receipt numbers are per-day sequential. `nextReceiptNumber()` has a race condition under concurrency.
- Do not hard-delete financial records without a product decision; current behaviour can destroy history.

---

## 7. Data model

| Model | Purpose |
|---|---|
| `User` | Login identity, role, active flag |
| `Resident` | Resident profile, owner/tenant info, link to `User` |
| `Connection` | Flat, tower, floor, area, meter, load, status |
| `Rate` | Electricity rate snapshots |
| `MeterReading` | NPCL/DG readings; linked to one bill |
| `Bill` | Electricity bill, charges, previous dues, status, carry-forward link |
| `Payment` | Electricity payment, Razorpay fields, receipt |
| `MaintenanceRate` | Maintenance rate per square foot |
| `MaintenanceBill` | Monthly maintenance bill, GST-inclusive amount, interest |
| `MaintenancePayment` | Maintenance receipt, rebate, method |
| `AuditLog` | Written by several admin mutations; no UI |
| `FlatInfo` | Flat inventory |
| `Permission` | MANAGER read/write/delete per page |
| `SiteConfig` | Maintenance mode, maintenance billing toggle, CGST/SGST |

Enums:

- `Role`: ADMIN, MANAGER, RESIDENT.
- `ConnectionStatus`: ACTIVE, INACTIVE.
- `BillStatus`: PENDING, PAID, OVERDUE, PARTIAL, CARRIED_FORWARD.
- `PaymentMethod`: ONLINE, CASH, UPI, NEFT, RTGS, CHEQUE, CREDIT_CARD, ADJUSTMENT.
- `PaymentStatus`: INITIATED, SUCCESS, FAILED.
- `MaintenanceBillStatus`: PENDING, PAID, OVERDUE, PARTIAL.

---

## 8. Actual payment flow

What the UI does today:

1. Resident opens a bill/pay page or public token page.
2. Sees amount, UPI QR, bank account details, and WhatsApp button.
3. Pays externally via UPI/NEFT.
4. Sends payment details on WhatsApp.
5. Admin records the payment in the admin portal.
6. System updates bill status and generates a receipt.

Razorpay:

- SDK and API routes exist (`/api/razorpay/*`, `/api/public-pay/*`).
- No Razorpay checkout is wired into resident/public pages.
- Do not assume online card/netbanking payments work.
- Current Razorpay verification routes are not production-safe; see known issues.

Public pay token:

- `lib/payment-token.ts` creates `billId_HMAC(billId)`.
- There is no expiry.
- The token grants access to the bill and PDF.

---

## 9. Deployment and environment

- Repository root `vercel.json` sets `outputDirectory` to `electricity-management/.next`.
- App `vercel.json` sets region `sin1` and the single cron.
- Production DB is TiDB Cloud; SSL is forced when the host is not localhost.
- The deployed site has been protected by Vercel deployment protection.
- Account access for GitHub, Vercel, and TiDB belongs to the project owner; no credentials are stored in this repo.
- Expected environment variables:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - `CRON_SECRET`

Never run `prisma/seed.ts` against production. It deletes audit logs, payments, bills, readings, connections, residents, and users, then imports from a hardcoded Windows path.

---

## 10. Known issues and priorities

These are confirmed from the code review. Fix them before adding new features in the same area.

### P0 — urgent

1. **Repository data exposure**
   - A tracked backup under `backups/` contains a production SQL dump with resident names, phones, flats, payment references, and bcrypt hashes.
   - The GitHub repository has been public.
   - Required: make the repo private or purge history, remove the dump, and rotate affected credentials/passwords.

2. **Manager read-permission bypass**
   - `middleware.ts` and `app/(admin)/layout.tsx` allow any MANAGER into `/admin`.
   - Pages such as residents, bills, and reports check role only, not `canRead`.
   - GET APIs (`/api/residents`, `/api/bills`, `/api/meter-readings`, etc.) check role only.
   - A manager with read disabled can still read data through the UI/API.

3. **Bulk maintenance bills undercharge GST**
   - `POST /api/cron/generate-maintenance-bills` stores an amount that excludes GST.
   - `generate-one` correctly stores a GST-inclusive amount.
   - `splitMaintenanceAmount()` treats `amount` as inclusive, so the two generation paths disagree.

### P1 — high

4. **Razorpay verification is unsafe**
   - `/api/razorpay/verify` does not bind the order to the bill, expected amount, owner, or status, and does not block replay.
   - `/api/razorpay/maintenance/verify` trusts the client-supplied amount and ignores `previousDue`.
   - `/api/public-pay/verify` verifies the token but not the order/amount binding.

5. **Maintenance receipt IDOR**
   - `/api/maintenance/payments/[id]/receipt` checks only that a session exists, not that the payment belongs to the resident.

6. **Test/bypass endpoints**
   - `/api/test-db` exposes database/admin details without auth.
   - `/api/payments/test-pay` and `/api/public-pay/test` can mark bills paid without money.
   - Remove these from production or hard-disable them.

7. **Destructive financial deletes**
   - Deleting an electricity bill deletes its payments.
   - Deleting a maintenance payment hard-deletes it and resets the bill.
   - Permanently deleting a resident wipes all financial records.
   - Prefer soft delete or a documented admin-only purge.

8. **Password/session weaknesses**
   - Reset tokens are reusable for 24 hours and never invalidated after use.
   - Forgot-password reveals whether an account exists.
   - JWT sessions last 30 days, so disabled users remain active until expiry.

9. **Hardcoded production cookie domain**
   - `auth.config.ts` uses `.oasisvenetia.in`; previews and alternate domains break.

10. **Destructive seed**
    - `prisma/seed.ts` deletes all business data and reads a hardcoded Windows XLSX path.
    - It must not be part of a normal deploy or migration.

11. **Validation gaps**
    - Negative meter readings are accepted.
    - Bills can be marked `PAID` without a payment.
    - `nextReceiptNumber()` can race and collide.
    - `run-migration` enum list omits `CREDIT_CARD` and `ADJUSTMENT`.

12. **Reporting inconsistency**
    - The XLSX report total uses revenue rather than billed total.

13. **Cron gaps**
    - `generate-bills` sets `previousDues = 0`, so cron-generated bills do not carry forward.
    - `overdue-notices` skips `PARTIAL` bills.
    - `update-maintenance-interest` excludes already-`OVERDUE` bills, so interest freezes.
    - Some maintenance payment/total routes omit `previousDue`.
    - Only one cron is scheduled in `vercel.json`.

### Quality baseline

At the last review:

- `npm run build` — passes.
- `npx tsc --noEmit` — passes.
- `npm run lint` — fails with about 135 errors and 10 warnings, mostly `no-explicit-any`, linting `.vercel/output`, a component created during render, and setState in effects.
- Next.js warns that `middleware.ts` is deprecated in Next 16 in favour of `proxy`.

Do not treat the lint baseline as clean until the above is addressed.

---

## 11. Maintenance workflow

1. Read this file, the relevant spec in `docs/superpowers/specs/`, and any matching plan.
2. Read `electricity-management/AGENTS.md` and the relevant Next.js 16 docs before using Next APIs.
3. Keep changes scoped. Prefer extending existing modules over creating parallel ones.
4. Follow the existing pattern:
   - Server page reads Prisma.
   - Client table/dialog calls an API route.
   - API route validates with Zod, calls `guardPermission`, and writes an `AuditLog` where appropriate.
5. Reuse:
   - `lib/billing.ts`
   - `lib/maintenance-billing.ts`
   - `lib/carry-forward.ts`
   - `lib/pdf.ts`
   - `lib/email-templates.ts`
   - `lib/payment-details.ts`
   - `lib/prisma.ts`
6. Verify:
   - `npm run build`
   - `npx tsc --noEmit`
   - `npm run lint` (currently noisy; use it as a signal)
7. Never run the seed against production.
8. Do not commit, push, deploy, or run a schema migration without explicit approval.
9. Before a migration, take a database backup and confirm the target environment.
10. Add a spec/plan under `docs/superpowers/` for non-trivial features, matching the existing style.

---

## 12. Key files

| Area | Files |
|---|---|
| Auth | `electricity-management/auth.ts`, `auth.config.ts`, `middleware.ts`, `lib/permissions.ts` |
| Billing | `lib/billing.ts`, `lib/maintenance-billing.ts`, `lib/carry-forward.ts` |
| Money/PDF/email | `lib/pdf.ts`, `lib/email.ts`, `lib/email-templates.ts`, `lib/payment-details.ts` |
| Tokens | `lib/payment-token.ts`, `lib/reset-token.ts` |
| Data | `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/data/residents.json`, `lib/flat-data.ts` |
| Electricity APIs | `app/api/bills/*`, `app/api/payments/*`, `app/api/meter-readings/*`, `app/api/rates/*` |
| Maintenance APIs | `app/api/maintenance/*`, `app/api/cron/*maintenance*` |
| Reports | `app/api/reports/*`, `components/admin/reports-client.tsx` |
| Admin UI | `components/admin/*`, `app/(admin)/admin/*` |
| Resident UI | `components/resident/*`, `app/(resident)/resident/*` |
| Deployment | `vercel.json`, `electricity-management/vercel.json` |
| Design history | `docs/superpowers/specs/`, `docs/superpowers/plans/` |

---

## 13. Open product/engineering decisions

- Retire the dormant Razorpay integration, or finish it with safe order/amount/owner binding and UI wiring.
- Schedule all required crons, or run them from an external scheduler.
- Add an Excel/CSV import UI, or keep seed/static data as the only import path.
- Decide whether financial records can be hard-deleted; otherwise introduce soft delete.
- Add token expiry and rotation for public pay links.
- Add an audit-log viewer.
- Fix manager read enforcement and decide whether permissions should be live without re-login.
- Clean the repository history and remove large binaries/screenshots if the repo stays public.
- Add automated tests for billing, carry-forward, GST, and payment verification.
