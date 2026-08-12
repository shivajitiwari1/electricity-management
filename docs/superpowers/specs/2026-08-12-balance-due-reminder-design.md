# Balance Due Reminder — Design Spec

**Date:** 2026-08-12
**Status:** Approved

## Overview

When a bill has `PARTIAL` status (resident has made a partial payment but balance remains outstanding), admins need a way to send a targeted balance-due reminder email to the resident. This feature adds a **"Balance Due"** button in the bills table that triggers a dedicated reminder email showing the full charge breakdown and the outstanding balance.

## Context

- Bills acquire `PARTIAL` status automatically when a cash/manual payment covers less than the full amount (`paidAmount < totalAmount - 0.01`).
- The existing "Resend" button re-sends the original bill email (full amount, no partial context).
- A separate "Balance Due" button gives admins a distinct, purpose-built reminder without altering existing resend behavior.

---

## Architecture

Three changes, each with a single clear responsibility:

| Layer | Change | File |
|---|---|---|
| API | New endpoint `POST /api/bills/[id]/balance-reminder` | `app/api/bills/[id]/balance-reminder/route.ts` |
| Email | New template function `balanceDueEmail()` | `lib/email-templates.ts` |
| UI | "Balance Due" button, visible only on PARTIAL bills | `components/admin/bills-table.tsx` |

---

## API Endpoint

**Route:** `POST /api/bills/[id]/balance-reminder`

**Permission:** `bills.canWrite` (same guard as the existing `/resend` route)

**Logic:**
1. Fetch bill by `id`, include connection → resident → user
2. Return `400` if `bill.status !== "PARTIAL"` — safety guard to prevent misuse
3. Compute `balanceDue = bill.totalAmount - bill.paidAmount`
4. Call `balanceDueEmail(bill, resident, balanceDue)` to produce HTML
5. Send via existing `sendEmail(to, subject, html)` to resident's email address
6. Write an `auditLog` entry: action `BALANCE_REMINDER_SENT`, entity `Bill`, entityId = bill id
7. Return `200 { message: "Balance reminder sent" }`

**Error responses:**
- `400` — Bill is not in PARTIAL status
- `404` — Bill not found
- `403` — Insufficient permission
- `500` — Email send failure

---

## Email Template

**Function:** `balanceDueEmail(bill, resident, balanceDue)` in `lib/email-templates.ts`

Follows the same HTML structure and design system as `billGeneratedEmail` (same header, footer, fonts, color palette).

**Content structure:**
1. **Header** — "Balance Due Notice" with amber accent color (`#f59e0b`) matching the PARTIAL badge
2. **Greeting** — Resident name, flat number, tower
3. **Charge breakdown table** — NPCL units + charge, DG charge, fixed charge, previous dues, total bill amount (same rows as original bill email)
4. **Already Paid row** — Highlighted in green (`#16a34a`), shows `paidAmount`
5. **Balance Due box** — Visually prominent block in amber/orange, large font, shows `balanceDue` amount
6. **Due date reminder** — "Please clear the balance by [dueDate]"
7. **Payment instructions** — Bank details + UPI QR code (same as original bill email so resident can act immediately)
8. **Footer** — Oasis Venetia Heights branding

**Subject line:** `Balance Due Notice — Flat [flatNo], [period] | Oasis Venetia Heights`

---

## UI Changes

**File:** `components/admin/bills-table.tsx`

- Render "Balance Due" button **only when `bill.status === "PARTIAL"`**
- Position: between "Resend" and "Delete" in the actions column
- Style: amber color scheme to match the PARTIAL status badge
- Permission guard: `canWrite` (same as "Resend")
- Icon: mail icon (consistent with "Resend")
- On click behavior:
  1. Set loading state on button
  2. `POST /api/bills/[id]/balance-reminder`
  3. On success: toast "Balance reminder sent"
  4. On error: toast error message
  5. Clear loading state

---

## Data Flow

```
Admin clicks "Balance Due"
  → POST /api/bills/[id]/balance-reminder
    → Validate permission (bills.canWrite)
    → Fetch bill (status must be PARTIAL)
    → Compute balanceDue = totalAmount - paidAmount
    → Generate balanceDueEmail HTML
    → sendEmail() via Nodemailer SMTP
    → Write auditLog (BALANCE_REMINDER_SENT)
    → Return 200
  → UI toast "Balance reminder sent"
```

---

## Out of Scope

- No PDF attachment on the reminder (email-only, consistent with existing resend behavior)
- No scheduling or auto-send of reminders (manual admin trigger only)
- No changes to Razorpay or online payment flow
- No new database schema changes (uses existing `auditLog` table)
