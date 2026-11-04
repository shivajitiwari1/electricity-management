# Repository instructions

Read [`PROJECT.md`](./PROJECT.md) before making changes. It records the architecture, implemented modules, billing rules, known issues, and the maintenance workflow.

Critical rules:

- The Next.js app lives in `electricity-management/`. The repository root is a deployment wrapper.
- Next.js 16 is in use. Read the relevant docs under `electricity-management/node_modules/next/dist/docs/` before using Next.js APIs.
- Never run `electricity-management/prisma/seed.ts` against production. It deletes all business data.
- Electricity bills have no GST.
- `MaintenanceBill.amount` is GST-inclusive. Never add GST again when displaying, paying, emailing, or rendering it.
- The UI uses manual UPI/NEFT payments. Razorpay code exists but is not wired into the UI.
- Only `/api/cron/overdue-notices` is scheduled in Vercel. The other cron routes need scheduling.
- Do not commit, push, deploy, or run a schema migration without explicit approval.
- Verify changes with `npm run build` and `npx tsc --noEmit` inside `electricity-management/`.
- `npm run lint` has a known noisy baseline; do not assume existing failures were introduced by your change.
- Do not add credentials, customer data, database dumps, or secrets to repository files.

## Recent fixes / reminders

- Maintenance receipt PDF/email: removed "(CASH)" when rebate/waiver present (`electricity-management/lib/pdf.ts`, `electricity-management/lib/email-templates.ts`).
- Maintenance payments: ADJUSTMENT/rebate entries do not get a receipt button. API blocks generating receipts for `ADJUSTMENT` (`app/api/maintenance/payments/[id]/receipt/route.ts`, `components/admin/maintenance-payments-table.tsx`).
- Deployment flow: commit/push from repo root (`git add .; git commit -m "..."; git push`), deploy from `electricity-management/` via `npx vercel --prod --yes`.
- Reports spacing: both electricity and maintenance reports rely on `space-y-6` on their printable containers (`#reports-printable`, `#maintenance-reports-printable`), with stat cards using `px-5 pt-5`. Keep the two pages in sync when editing either.
- Maintenance receipt balance: a rebate/waiver row is inserted microseconds after its payment, so balance-due calculations must count the payment and its paired `ADJUSTMENT` explicitly instead of relying on `createdAt <= payment.createdAt` (`app/api/maintenance/payments/[id]/receipt/route.ts`).
- Maintenance Reports visibility: do not gate the sidebar entry or page on `maintenanceBillingEnabled`. Production keeps that flag off, and gating only Reports hid it while Bills/Payments stayed accessible.
- Production: https://www.oasisvenetia.in (Vercel project `electricity-management`).

## Completed requests

### Maintenance dashboard/reports page

**Status: COMPLETE — committed in `e069234`, with later fixes `fa3a396` (receipt rebate balance) and `787b681` (Reports visibility); deployed to production** (see work log at the end).

Goal: add a dashboard-style reports page **under the Maintenance section** that mirrors the existing electricity `Reports` page, but is scoped to maintenance data only.

Mirror these existing electricity report features (`app/(admin)/admin/reports/page.tsx`, `components/admin/reports-client.tsx`):

- Stat cards (revenue, bills issued, residents/flats, overdue count).
- Quick date-range periods + custom start/end date filters.
- Time-series chart (day/week/month grouping) and tower-wise breakdown.
- Overdue bills table with days overdue.
- PDF and XLSX export.

Scope and placement:

- New route: `app/(admin)/admin/maintenance/reports/page.tsx`.
- New client component: `components/admin/maintenance-reports-client.tsx`.
- Add a "Reports" entry to `MAINTENANCE_SUB_ITEMS` in `components/admin/sidebar-nav.tsx`; gate it with the existing `maintenance` page permission (or add a dedicated `maintenance-reports` page id to `lib/permissions.ts` if separate permissions are wanted).
- Add a cached data loader (e.g. `getCachedMaintenanceReportsData`) to `lib/server-cache.ts` following `getCachedReportsData`, and/or new `app/api/maintenance/reports/{pdf,xlsx}` routes.

Maintenance-specific data rules (do not copy electricity logic blindly):

- `MaintenanceBill.amount` is **GST-inclusive**; use `splitMaintenanceAmount()` from `lib/maintenance-billing.ts` for base/GST breakdowns. Never add GST again.
- Include `previousDue`, `paidAmount`, `interestCharge`, and `status` (PENDING, PAID, OVERDUE, PARTIAL); revenue should be based on `MaintenancePayment.amount` (minus rebate/waiver), not the bill amount.
- Exclude `ADJUSTMENT` rows from revenue/receipt-style totals the same way the payments table does.
- Tower/flat breakdown comes via `connection` (`tower`, `flatNo`) and resident via `connection.resident.user.name`.
- Do **not** gate the admin menu/page on `SiteConfig.maintenanceBillingEnabled`: production keeps that flag off while Bills/Payments remain in use, so gating only Reports hides it.

#### Work log

- Added `getCachedMaintenanceReportsData` to `lib/server-cache.ts` (5 min cache, `reports`/`maintenance` tags). It returns paid maintenance payments excluding `ADJUSTMENT`, overdue bills with computed outstanding, recent bills, all-time revenue (ex-`ADJUSTMENT`), bill count, and active flat count.
- Added `app/(admin)/admin/maintenance/reports/page.tsx` and `components/admin/maintenance-reports-client.tsx` mirroring the electricity reports UI (stat cards, quick/custom date range, revenue chart, tower breakdown, overdue table, print, PDF/XLSX buttons). Requires the `maintenance` read permission for managers; no longer redirects when `maintenanceBillingEnabled` is false.
- Added the `Reports` entry to `MAINTENANCE_SUB_ITEMS`. It is deliberately **not** gated on `SiteConfig.maintenanceBillingEnabled`: production has that flag off while admins still use Bills/Payments, so gating only Reports hid it there. Reports is available whenever the Maintenance group is.
- Added `app/api/maintenance/reports/{xlsx,pdf}/route.ts`, guarded by `guardPermission(..., "maintenance", "canRead")`. Revenue excludes `ADJUSTMENT`; bill rows show GST-inclusive amount and computed outstanding (`amount + previousDue + interestCharge - paidAmount`).
- Made the bottom padding consistent across all Maintenance Reports cards: the stat cards now use `px-5 pt-5` so their bottom spacing comes from the shared `Card` padding (1 rem), matching the chart and overdue-table cards.
- Fixed the missing vertical gap between Maintenance Reports cards (visible from the "Revenue by Tower" card down): the outer `space-y-6` only spaced the controls card and `#maintenance-reports-printable`. Added `space-y-6` to `#maintenance-reports-printable` itself so the stat grid, revenue chart, tower chart, and overdue table all have consistent 1.5 rem gaps.
- Applied the same card spacing treatment to the electricity `Reports` page (`components/admin/reports-client.tsx`): `#reports-printable` now uses `space-y-6`, and the stat cards use `px-5 pt-5` to match Maintenance Reports.
- Deployment follow-up: the first production build had the reports routes but the menu entry vanished because production's `SiteConfig.maintenanceBillingEnabled` is `false`. Removed that gate from both the sidebar and the page and redeployed (`787b681`).
- Verified with `npx tsc --noEmit` and `npm run build`; the new `/admin/maintenance/reports`, `/api/maintenance/reports/pdf`, and `/api/maintenance/reports/xlsx` routes compile successfully. The electricity Reports page spacing changes also build cleanly.

### Maintenance advance payments page

**Status: COMPLETE — committed in `983864b` and deployed to production.**

Goal: a Maintenance section listing every advance payment with a receipt download per row.

- New route: `app/(admin)/admin/maintenance/advance/page.tsx`; new client table `components/admin/maintenance-advance-payments-table.tsx`; new `Advance Payments` entry in `MAINTENANCE_SUB_ITEMS` (gated on the existing `maintenance` read permission, like Bills/Payments).
- Advance payments have no database flag: the Advance Pay flow (`/api/maintenance/bills/advance`) raises a PAID bill per future month and records a `MaintenancePayment` on the day the money is taken. `isAdvancePayment()` in `lib/maintenance-billing.ts` therefore treats a payment as an advance when its billing period starts after the month of the payment date (payment month read in IST, since periods are stored at 00:00 UTC).
- The list shows one row per advance taken, not per month: `groupAdvancePaymentRuns()` groups payments into runs of consecutive months paid together on the same day for the same flat. Columns: receipt no, flat/resident, bill range, period covered, duration in months, total amount, method, reference, paid on, receipt.
- The receipt route (`app/api/maintenance/payments/[id]/receipt/route.ts`) reprints any advance payment as one **"ADVANCE MAINTENANCE PAYMENT RECEIPT"** for the whole batch: total of the batch, `Advance For: N Months`, `Period Covered`, and the bill-number range. The receipt number is the batch's first payment, so the same document comes out whichever row is clicked. `ReceiptData` gained `monthsCovered` and `periodLabel`.
- `ADJUSTMENT` rows are excluded from the list and from revenue: a rebate/waiver gets no receipt of its own.
- The Advance Pay dialog's rebate is recorded: `/api/maintenance/bills/advance` spreads it over the generated months as one `ADJUSTMENT` row per month, and each month's payment is reduced to the net received. The bill keeps its full GST-inclusive `amount` as `paidAmount`, matching how rebates are recorded elsewhere.
- Advance receipts print a **Payment Breakdown**: base charges, CGST/SGST (from `splitMaintenanceAmount()`, never added on top), total incl. GST, rebate/waiver and net amount received. If a legacy lump-sum advance was recorded on a single monthly bill, the excess over the bill total is treated as additional gross and the GST is backed out of it, so the breakdown always reconciles.
- Advance receipts also itemise every month in a **MONTH-WISE BREAKDOWN** table — period, bill number, base / CGST / SGST / GST-inclusive total / rebate share / net received — with a total row that sums all columns.
- Filters (tower, advance start month, search) and sorting are client-side because the page loads the advance rows already; no new API route.
- Verified with `npx tsc --noEmit` and `npm run build`; `/admin/maintenance/advance` compiles as a dynamic route. Advance detection and batch grouping were unit-checked (regular vs advance, IST midnight boundary, legacy period ends, non-contiguous same-day batches, multiple flats), and a sample advance receipt PDF was rendered and inspected.
