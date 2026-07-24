# Design: Maintenance Module Enhancements
**Date:** 2026-07-24  
**Branch:** main  
**Scope:** Sidebar submenu, PDF download, Excel export, History dialog update, Advance payment

---

## 1. Sidebar Submenu

### Goal
Replace the single flat "Maintenance" nav link with an expandable group containing 4 sub-items.

### Sub-items
| Label | Route | Status |
|---|---|---|
| Bills | `/admin/maintenance` | existing page |
| Rates | `/admin/maintenance/rates` | existing page |
| Scheduler | `/admin/maintenance/generate` | existing page |
| Payments | `/admin/maintenance/payments` | **new page** |

### Behavior
- Group auto-expands when `pathname.startsWith("/admin/maintenance")`
- Sub-items highlighted individually based on exact/prefix match
- Collapsed when on non-maintenance pages (chevron icon indicates toggle)
- Works in both desktop sidebar and mobile sheet
- Permission-gated: only shown if `isAdmin || permissions["maintenance"]?.canRead`

### Changes
- `components/admin/sidebar-nav.tsx` — add `MAINTENANCE_SUB_ITEMS` array, convert Maintenance entry to expandable group with `useState` for open/close
- `app/(admin)/admin/maintenance/page.tsx` — remove "Manage Rates" and "Scheduler" header buttons (replaced by submenu)
- `app/(admin)/admin/maintenance/payments/page.tsx` — **new page**
- `components/admin/maintenance-payments-table.tsx` — **new component**

### Maintenance Payments Page
Displays `MaintenancePayment` records joined to `MaintenanceBill` + `Connection` + `Resident`.
Filters: Tower (all/A/B/C/V), Month (month picker), Method (all/CASH/UPI/NEFT/RTGS/CHEQUE).
Columns: Receipt No · Flat · Resident · Bill No · Amount · Method · Ref · Date · Status.
Read-only, no write actions on this page.

---

## 2. Maintenance Bill PDF

### Goal
Add a "Download PDF" button per bill in the maintenance bills table that generates an A4 PDF in the same style as the electricity bill.

### PDF Layout (A4, PDFKit)
- **Header bar** (navy `#1e3a5f`): "OASIS BUILDMART INDIA PVT. LTD.", address, "MAINTENANCE BILL" badge
- **Info block (4 columns):**
  - Col 1: Flat No
  - Col 2: Resident Name
  - Col 3: Bill No
  - Col 4: Bill Date / Due Date
- **Billing period line:** "Period: DD-MM-YYYY to DD-MM-YYYY"
- **Charge table:**
  | Description | Amount |
  |---|---|
  | Maintenance Charge (area sq ft × ₹X/sq ft) | ₹X |
  | Interest Charge (24% p.a.) | ₹X (omitted if 0) |
  | Amount Already Paid | ₹X (omitted if 0) |
  | **Net Payable** | **₹X** |
- **Terms (3 lines):**
  1. Rate: ₹X/sq ft · Area: X sq ft
  2. Payment due by DD-MM-YYYY. Late payment attracts 24% p.a. interest.
  3. This is a computer-generated bill.

### New Files
- `lib/pdf.ts` — add `generateMaintenanceBillPdf(data: MaintenanceBillPdfData): Promise<Buffer>`
- `app/api/maintenance/bills/[id]/pdf/route.ts` — GET handler: fetch bill → generate PDF → return with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="maintenance-bill-<billNumber>.pdf"`

### UI Change
- `components/admin/maintenance-bills-table.tsx` — add `FileDown` icon button in Actions column per row. Opens PDF in new tab via `window.open(/api/maintenance/bills/${id}/pdf)`.
- Button shown for all bills regardless of status (admin may need to print paid bills too).

---

## 3. Maintenance Bills Table Improvements

### A — Current Month Default
- `month` state initializes to `new Date().toISOString().slice(0, 7)` (e.g. `"2026-07"`)
- `useEffect` on mount calls `fetchBills()` immediately so current-month data loads without manual click
- "Apply Filter" still works for other months

### B — Excel Export Button
- New `FileSpreadsheet` icon button "Download Excel" added to filter bar (right of Apply Filter)
- Uses ExcelJS (already in dependencies via history dialog)
- Sheet: "Maintenance Bills"
- Styled header row (navy fill, white bold text)
- Columns with widths: Bill No (18) · Flat (8) · Tower (8) · Resident (22) · Area sq ft (10) · Rate/sq ft (12) · Maintenance ₹ (14) · Interest ₹ (12) · Paid ₹ (12) · Outstanding ₹ (14) · Due Date (14) · Status (10)
- Currency columns formatted as `#,##0.00`
- Filename: `maintenance-bills-<YYYY-MM>.xlsx`
- Operates on current `bills` state (respects active filters)

---

## 4. History Dialog — Maintenance Bills Section

### Goal
Add a "Maintenance Bills" section to the existing resident History dialog in `components/admin/residents-table.tsx`.

### API Change
`openHistory()` adds a third parallel fetch:
```ts
fetch(`/api/maintenance/bills?flatNo=${encodeURIComponent(flatNo)}`)
```
`historyData` type: `{ bills: any[]; payments: any[]; maintenanceBills: any[] }`

### Dialog UI
After the existing "Payments" section, add:

**Maintenance Bills (N)**
Table: Bill No · Billing Period · Amount (₹) · Interest (₹) · Status

### Excel Export Update
Add a second worksheet "Maintenance Bills" to the existing workbook:
- Styled header (same navy style)
- Columns: Bill No · Billing Period · Amount (₹) · Interest (₹) · Paid (₹) · Status
- Existing "Electricity Bills" and "Payments" sheets unchanged

---

## 5. Advance Payment

### Goal
Allow admin to pre-pay 6 or 12 months of maintenance for a flat upfront. Bills are generated for each future month and immediately marked PAID.

### UI
- New "Advance Pay" button in the maintenance bills page header (alongside the new Excel button)
- Opens a Dialog with fields:
  | Field | Type | Notes |
  |---|---|---|
  | Flat | Searchable select | All active maintenance connections |
  | Months | Radio | 6 months / 12 months |
  | Start From | Month picker | Defaults to next month |
  | Amount/Month | Number input | Auto-filled: rate × area (editable) |
  | Total | Read-only | months × amount/month |
  | Method | Select | CASH / UPI / NEFT / RTGS / CHEQUE |
  | Payment Date | Date picker | Defaults to today |
  | Reference / UTR | Text | Optional |

### API: `POST /api/maintenance/bills/advance`
Request body:
```ts
{
  connectionId: string;
  months: 6 | 12;
  startMonth: string; // "YYYY-MM"
  amountPerMonth: number;
  method: string;
  paymentDate: string;
  referenceId?: string;
}
```

Logic:
0. Fetch connection details (flatNo, tower, unitArea) + current `MaintenanceRate` upfront (once, before the loop)
1. For each N in 0..months-1: compute `billingPeriodStart` = first day of `startMonth + N months`, `billingPeriodEnd` = last day of that same month, `dueDate` = 10th of that month (matching scheduler pattern)
2. Check if `MaintenanceBill` already exists for this `connectionId` + `billingPeriodStart` → if yes, skip (count as `skipped`)
3. Otherwise: create `MaintenanceBill` with `status: PAID`, `paidAmount = amountPerMonth`, bill number follows existing format `OM-<tower>-<flatNo>-<YYYYMM>`. Then create `MaintenancePayment` record linked to that bill.

Response: `{ generated: number; skipped: number; receiptNumbers: string[] }`

### Post-Submit
- Toast: "X bills generated and marked paid. Y month(s) already had bills and were skipped."
- Refresh table (re-fetch current month filter)
- Dialog closes

---

## Files Changed Summary

| File | Change |
|---|---|
| `components/admin/sidebar-nav.tsx` | Add expandable Maintenance submenu |
| `app/(admin)/admin/maintenance/page.tsx` | Remove header buttons (Manage Rates, Scheduler) |
| `app/(admin)/admin/maintenance/payments/page.tsx` | **New** — Maintenance payments list page |
| `components/admin/maintenance-payments-table.tsx` | **New** — Payments table component |
| `lib/pdf.ts` | Add `generateMaintenanceBillPdf()` |
| `app/api/maintenance/bills/[id]/pdf/route.ts` | **New** — PDF download route |
| `components/admin/maintenance-bills-table.tsx` | PDF button, Excel export, current-month default, Advance Pay button + dialog |
| `components/admin/residents-table.tsx` | Add maintenance bills fetch, dialog section, Excel sheet |
| `app/api/maintenance/bills/advance/route.ts` | **New** — Advance payment generation route |

---

## Non-Goals
- No changes to resident-facing maintenance pages
- No Razorpay integration for advance payment (offline/cash only per admin recording)
- No email notifications for advance payment bills
- No changes to electricity bill flows
