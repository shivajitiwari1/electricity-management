# Balance Due Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Balance Due" button to PARTIAL bills that sends a tailored reminder email showing the full charge breakdown and the outstanding balance.

**Architecture:** Three isolated changes — (1) a new `balanceDueEmail()` template in `lib/email-templates.ts`, (2) a new API route `POST /api/bills/[id]/balance-reminder`, and (3) UI changes in `components/admin/bills-table.tsx` plus one serialization addition in the bills page. Each layer is independently testable.

**Tech Stack:** Next.js App Router (TypeScript), Prisma ORM, Nodemailer SMTP, Sonner toast, shadcn/ui Button, Lucide icons

## Global Constraints

- All files live under `electricity-management/` — that is the Next.js project root
- No automated test framework exists — verification is done via `npm run build` and manual browser testing
- `npm run build` runs `prisma generate && next build` — always run it after implementation to catch type errors
- Email sending is guarded by env var `DISABLE_EMAILS=true`; the route still returns 200 (consistent with existing resend behavior)
- Audit log writes use `session!.user.id`; session is obtained via `auth()` from `@/auth`
- All monetary values come from Prisma as `Decimal` — call `.toFixed(2)` before passing to templates
- `SerializedBill` type is defined inline in `components/admin/bills-table.tsx` — keep it as the source of truth
- Follow the existing resend endpoint pattern exactly for the new API route

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `lib/email-templates.ts` | Add `balanceDueEmail()` function |
| Create | `app/api/bills/[id]/balance-reminder/route.ts` | POST handler — fetch bill, compute balance, send email, audit log |
| Modify | `app/(admin)/admin/bills/page.tsx` | Add `paidAmount` to serialization object |
| Modify | `components/admin/bills-table.tsx` | Add `paidAmount` to type, add state + handler + "Balance Due" button |

---

## Task 1: Email Template — `balanceDueEmail()`

**Files:**
- Modify: `lib/email-templates.ts` (append after existing `billGeneratedEmail`)

**Interfaces:**
- Produces: `balanceDueEmail(params: BalanceDueEmailParams): string`
- `BalanceDueEmailParams` fields: `residentName`, `flatNo`, `billNumber`, `billingPeriod`, `ncplCharge`, `dgCharge`, `fixedCharge`, `previousDues`, `totalAmount`, `paidAmount`, `balanceDue`, `dueDate`, `payUrl` (all strings)
- Later tasks import this function by name from `@/lib/email-templates`

- [ ] **Step 1: Open `lib/email-templates.ts` and scroll to the bottom**

  Note the existing helpers available to reuse:
  - `shell(content)` — wraps content in the standard branded email layout
  - `row(label, value, highlight?)` — renders a two-column table row with optional blue highlight

- [ ] **Step 2: Append the `balanceDueEmail` export at the bottom of `lib/email-templates.ts`**

  Add this after the last existing export:

  ```typescript
  export function balanceDueEmail(params: {
    residentName: string;
    flatNo: string;
    billNumber: string;
    billingPeriod: string;
    ncplCharge: string;
    dgCharge: string;
    fixedCharge: string;
    previousDues: string;
    totalAmount: string;
    paidAmount: string;
    balanceDue: string;
    dueDate: string;
    payUrl: string;
  }): string {
    const {
      residentName, flatNo, billNumber, billingPeriod,
      ncplCharge, dgCharge, fixedCharge, previousDues,
      totalAmount, paidAmount, balanceDue, dueDate, payUrl,
    } = params;

    const body = `
      <tr><td style="padding:32px 32px 0;">
        <!-- Amber notice bar -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
          <tr>
            <td width="36">
              <div style="width:32px;height:32px;background:#f59e0b;border-radius:50%;text-align:center;line-height:32px;font-size:18px;color:#fff;">&#9888;</div>
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:14px;font-weight:bold;color:#92400e;">Balance Due Notice</p>
              <p style="margin:2px 0 0;font-size:12px;color:#b45309;">A partial payment was received. Please clear the remaining balance.</p>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
        <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.6;">
          We have received a partial payment for your electricity bill for <strong>Flat ${flatNo}</strong>.
          Please find the outstanding balance details below and make the remaining payment before the due date.
        </p>
      </td></tr>

      <!-- Balance Due Banner -->
      <tr><td style="padding:24px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:2px solid #f59e0b;border-radius:6px;padding:20px;">
          <tr><td align="center">
            <p style="margin:0;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Balance Due</p>
            <p style="margin:6px 0 0;font-size:36px;font-weight:bold;color:#78350f;">Rs. ${balanceDue}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Please pay by: <strong style="color:#dc2626;">${dueDate}</strong></p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Charge Breakdown -->
      <tr><td style="padding:24px 32px 0;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Charge Breakdown</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row("Bill Number", billNumber)}
          ${row("Flat No", flatNo)}
          ${row("Billing Period", billingPeriod)}
          ${row("NPCL Energy Charges", "Rs. " + ncplCharge)}
          ${row("DG Charges", "Rs. " + dgCharge)}
          ${row("Fixed Charges", "Rs. " + fixedCharge)}
          ${row("Previous Dues", "Rs. " + previousDues)}
          ${row("Total Bill Amount", "Rs. " + totalAmount, true)}
          <tr style="background:#f0fdf4;">
            <td style="padding:10px 0;font-size:13px;color:#15803d;font-weight:bold;border-bottom:1px solid #f3f4f6;">Already Paid</td>
            <td style="padding:10px 0;font-size:13px;color:#15803d;font-weight:bold;text-align:right;border-bottom:1px solid #f3f4f6;">- Rs. ${paidAmount}</td>
          </tr>
          <tr style="background:#fffbeb;">
            <td style="padding:10px 0;font-size:14px;color:#92400e;font-weight:bold;border-bottom:1px solid #f3f4f6;">Balance Due</td>
            <td style="padding:10px 0;font-size:14px;color:#92400e;font-weight:bold;text-align:right;border-bottom:1px solid #f3f4f6;">Rs. ${balanceDue}</td>
          </tr>
        </table>
      </td></tr>

      <!-- Payment Options -->
      <tr><td style="padding:24px 32px 0;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Payment Options</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <tr>
            <td style="padding:16px 20px;vertical-align:top;">
              <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#374151;">Bank Transfer / NEFT / RTGS / UPI</p>
              <table cellpadding="0" cellspacing="0">
                <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;white-space:nowrap;padding-right:12px;">Beneficiary</td><td style="font-size:12px;color:#111827;font-weight:600;">OASIS BUILDMART INDIA PVT LTD</td></tr>
                <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">Bank</td><td style="font-size:12px;color:#111827;">Bank of Baroda</td></tr>
                <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">Account No.</td><td style="font-size:12px;color:#111827;font-weight:600;font-family:monospace;">88340200001343</td></tr>
                <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">IFSC</td><td style="font-size:12px;color:#111827;font-family:monospace;">BARB0DBGREA</td></tr>
                <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">Branch</td><td style="font-size:12px;color:#111827;">Greater Noida</td></tr>
                <tr><td style="font-size:12px;color:#6b7280;padding:3px 0;padding-right:12px;">UPI ID</td><td style="font-size:12px;color:#111827;font-family:monospace;">oasis88268343@barodampay</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:24px 32px 32px;" align="center">
        <a href="${payUrl}" style="display:inline-block;background:#f59e0b;color:#ffffff;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">
          Pay Balance Now
        </a>
        <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;">Please quote your bill number <strong>${billNumber}</strong> when making a bank transfer.</p>
      </td></tr>
    `;

    return shell(body);
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd electricity-management
  npx tsc --noEmit
  ```
  Expected: no errors in `lib/email-templates.ts`

- [ ] **Step 4: Commit**

  ```bash
  cd electricity-management
  git add lib/email-templates.ts
  git commit -m "feat: add balanceDueEmail template for partial payment reminder"
  ```

---

## Task 2: API Endpoint — `POST /api/bills/[id]/balance-reminder`

**Files:**
- Create: `app/api/bills/[id]/balance-reminder/route.ts`

**Interfaces:**
- Consumes: `balanceDueEmail` from `@/lib/email-templates` (defined in Task 1)
- Consumes: `sendEmail` from `@/lib/email`, `generatePaymentToken` from `@/lib/payment-token`, `guardPermission` from `@/lib/permissions`, `prisma` from `@/lib/prisma`, `auth` from `@/auth`
- Produces: `POST /api/bills/[id]/balance-reminder` → `200 { success: true }` or error JSON

- [ ] **Step 1: Create the directory**

  The file goes in `app/api/bills/[id]/balance-reminder/route.ts`. The `[id]` directory already exists (it holds `route.ts` and `resend/route.ts`). Just create the new nested directory + file.

- [ ] **Step 2: Create `app/api/bills/[id]/balance-reminder/route.ts`**

  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { auth } from "@/auth";
  import { prisma } from "@/lib/prisma";
  import { guardPermission } from "@/lib/permissions";
  import { sendEmail } from "@/lib/email";
  import { balanceDueEmail } from "@/lib/email-templates";
  import { generatePaymentToken } from "@/lib/payment-token";

  export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const session = await auth();
    const guard = await guardPermission(session as any, "bills", "canWrite");
    if (guard) return guard;

    const { id } = await params;

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        connection: {
          include: {
            resident: {
              include: {
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    if (bill.status !== "PARTIAL") {
      return NextResponse.json(
        { error: "Bill is not in PARTIAL status" },
        { status: 400 }
      );
    }

    const residentEmail = bill.connection.resident.user.email;
    const residentName = bill.connection.resident.user.name ?? "Resident";
    const flatNo = bill.connection.flatNo;

    const fmtDate = (d: Date) =>
      d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

    const payToken = generatePaymentToken(bill.id);
    const payUrl = `${process.env.NEXTAUTH_URL}/pay/${payToken}`;

    const billingPeriod = `${fmtDate(bill.billingPeriodStart)} – ${fmtDate(bill.billingPeriodEnd)}`;
    const balanceDue = (
      Number(bill.totalAmount) - Number(bill.paidAmount)
    ).toFixed(2);

    try {
      await sendEmail(
        residentEmail,
        `Balance Due Notice — ${bill.billNumber} | Oasis Venetia Heights`,
        balanceDueEmail({
          residentName,
          flatNo,
          billNumber: bill.billNumber,
          billingPeriod,
          ncplCharge: bill.ncplCharge.toFixed(2),
          dgCharge: bill.dgCharge.toFixed(2),
          fixedCharge: bill.fixedCharge.toFixed(2),
          previousDues: bill.previousDues.toFixed(2),
          totalAmount: bill.totalAmount.toFixed(2),
          paidAmount: bill.paidAmount.toFixed(2),
          balanceDue,
          dueDate: fmtDate(bill.dueDate),
          payUrl,
        })
      );

      await prisma.auditLog.create({
        data: {
          userId: session!.user.id,
          action: "BALANCE_REMINDER_SENT",
          entity: "Bill",
          entityId: bill.id,
          meta: {
            billNumber: bill.billNumber,
            sentTo: residentEmail,
            balanceDue,
          },
        },
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("Balance reminder email error:", err);
      return NextResponse.json(
        { error: "Failed to send balance reminder" },
        { status: 500 }
      );
    }
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd electricity-management
  npx tsc --noEmit
  ```
  Expected: no errors in the new route file

- [ ] **Step 4: Run build to catch any Next.js route issues**

  ```bash
  cd electricity-management
  npm run build
  ```
  Expected: build succeeds, new route appears in the output route list

- [ ] **Step 5: Commit**

  ```bash
  cd electricity-management
  git add app/api/bills/[id]/balance-reminder/route.ts
  git commit -m "feat: add POST /api/bills/[id]/balance-reminder endpoint"
  ```

---

## Task 3: UI — "Balance Due" Button

**Files:**
- Modify: `app/(admin)/admin/bills/page.tsx` — add `paidAmount` to serialization
- Modify: `components/admin/bills-table.tsx` — add type field, state, handler, button

**Interfaces:**
- Consumes: `POST /api/bills/[id]/balance-reminder` (defined in Task 2)
- The button renders only when `bill.status === "PARTIAL"` and `canWrite === true`

- [ ] **Step 1: Add `paidAmount` to bill serialization in `app/(admin)/admin/bills/page.tsx`**

  Find the serialization block (around line 85) that ends with:
  ```typescript
      totalAmount: b.totalAmount.toString(),
      status: b.status,
      paymentId: b.payments[0]?.id ?? null,
  ```

  Add `paidAmount` between `totalAmount` and `status`:
  ```typescript
      totalAmount: b.totalAmount.toString(),
      paidAmount: b.paidAmount.toString(),
      status: b.status,
      paymentId: b.payments[0]?.id ?? null,
  ```

- [ ] **Step 2: Add `paidAmount: string` to the `SerializedBill` type in `components/admin/bills-table.tsx`**

  Find the `SerializedBill` type (around line 30). It currently ends with:
  ```typescript
    totalAmount: string;
    status: string;
    paymentId: string | null;
  ```

  Add `paidAmount` between `totalAmount` and `status`:
  ```typescript
    totalAmount: string;
    paidAmount: string;
    status: string;
    paymentId: string | null;
  ```

- [ ] **Step 3: Add `sendingBalanceDue` state to `BillsTable`**

  In `BillsTable`, find the existing state declarations (around line 94–98):
  ```typescript
    const [resendingBill, setResendingBill] = useState<string | null>(null);
  ```

  Add the new state directly after it:
  ```typescript
    const [sendingBalanceDue, setSendingBalanceDue] = useState<string | null>(null);
  ```

- [ ] **Step 4: Add `handleBalanceDue` function to `BillsTable`**

  Find `handleResend` (around line 162). Add `handleBalanceDue` directly after it:

  ```typescript
  async function handleBalanceDue(bill: SerializedBill) {
    setSendingBalanceDue(bill.id);
    try {
      const res = await fetch(`/api/bills/${bill.id}/balance-reminder`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to send balance reminder");
        return;
      }
      toast.success(`Balance reminder sent to resident for ${bill.billNumber}`);
    } catch {
      toast.error("Failed to send balance reminder");
    } finally {
      setSendingBalanceDue(null);
    }
  }
  ```

- [ ] **Step 5: Add the "Balance Due" button in the actions column**

  Find the "Resend" button block (around line 352–363):
  ```tsx
  {canWrite && (
    <Button
      variant="outline"
      size="sm"
      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
      disabled={resendingBill === bill.id}
      onClick={() => handleResend(bill)}
    >
      <Mail className="h-3 w-3 mr-1" />
      {resendingBill === bill.id ? "Sending…" : "Resend"}
    </Button>
  )}
  ```

  Add the "Balance Due" button directly after the closing `}` of the Resend block, before the "Mark Paid" block:

  ```tsx
  {canWrite && bill.status === "PARTIAL" && (
    <Button
      variant="outline"
      size="sm"
      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
      disabled={sendingBalanceDue === bill.id}
      onClick={() => handleBalanceDue(bill)}
    >
      <Mail className="h-3 w-3 mr-1" />
      {sendingBalanceDue === bill.id ? "Sending…" : "Balance Due"}
    </Button>
  )}
  ```

- [ ] **Step 6: Verify TypeScript compiles**

  ```bash
  cd electricity-management
  npx tsc --noEmit
  ```
  Expected: no errors

- [ ] **Step 7: Run build**

  ```bash
  cd electricity-management
  npm run build
  ```
  Expected: build succeeds

- [ ] **Step 8: Manual browser verification**

  Start the dev server:
  ```bash
  cd electricity-management
  npm run dev
  ```

  1. Navigate to `/admin/bills`
  2. Locate a bill with **PARTIAL** status (amber badge)
  3. Confirm the "Balance Due" button appears in that row's actions — amber colored, mail icon
  4. Confirm the "Balance Due" button does **not** appear on PAID, PENDING, or OVERDUE bills
  5. Click "Balance Due" on a PARTIAL bill
  6. Confirm a loading state appears ("Sending…")
  7. Confirm a success toast appears ("Balance reminder sent to resident for…")
  8. Check the resident's inbox — email should show "Balance Due Notice" subject, amber notice bar, full charge breakdown, "Already Paid" in green, "Balance Due" in amber, and payment options

- [ ] **Step 9: Commit**

  ```bash
  cd electricity-management
  git add app/\(admin\)/admin/bills/page.tsx components/admin/bills-table.tsx
  git commit -m "feat: add Balance Due button for PARTIAL bills"
  ```
