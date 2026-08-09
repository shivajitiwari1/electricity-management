# CSV Database Backup — Design Spec

**Date:** 2026-08-09
**Project:** Oasis Venetia Heights — Electricity Management

---

## Overview

Add a "Download Backup" button to the admin dashboard that exports all database tables as CSV files packaged into a single ZIP download. One click gives the admin a complete point-in-time snapshot of all data.

---

## API Route

**Endpoint:** `GET /api/backup/csv`

**Auth:** Admin session required. Returns 401 if unauthenticated, 403 if non-admin role.

**Behavior:**
1. Query all 5 tables in parallel via `Promise.all` using Prisma.
2. Convert each result set to a CSV string (header row + data rows).
3. Create an in-memory ZIP using `jszip` containing one `.csv` file per table.
4. Generate ZIP buffer and return as binary response.

**Response headers:**
- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="oasis-backup-YYYY-MM-DD.zip"` (date = server date at request time)

**Error handling:** Any Prisma error returns a 500 JSON `{ error: "Backup failed" }`.

---

## CSV Files in the ZIP

| Filename | Prisma model | Columns exported |
|---|---|---|
| `residents.csv` | `Resident` + `User` | ID, Name, Email, Phone, Created At |
| `connections.csv` | `Connection` + `Resident.User` | ID, Flat No, Tower, Floor, Unit Type, Meter No, Sanctioned Load, Status, Resident Name, Resident Email |
| `bills.csv` | `Bill` + `Connection` | Bill #, Flat No, Tower, Resident Name, Bill Date, Due Date, NCPL Units, DG Units, Total Amount, Paid Amount, Balance, Status |
| `payments.csv` | `Payment` + `Bill.Connection` | Receipt #, Flat No, Resident Name, Bill #, Amount, Payment Date, Method, Status, Razorpay/Ref ID |
| `meter_readings.csv` | `MeterReading` + `Connection` | ID, Flat No, Tower, Reading Date, NCPL Previous, NCPL Current, NCPL Units, DG Units |

All monetary values exported as plain numbers (no ₹ symbol) for spreadsheet compatibility. Dates exported as `DD Mon YYYY` (same as existing XLSX report).

---

## Dashboard Button

**Location:** The existing quick-action button row on the admin dashboard (`Add Resident`, `Enter Reading`, `View Reports`).

**Implementation:** A plain `<a href="/api/backup/csv" download>` styled as a button — no client state, no loading spinner needed. The browser handles the file download natively.

**Visibility:** Shown only to users with `role === "ADMIN"`. Hidden for staff/sub-admin users without explicit backup permission.

**Button label:** "Download Backup" with a database/download icon.

---

## New Dependency

`jszip` — pure JavaScript ZIP library, no native bindings, works in Next.js API routes on Vercel.

Install: `npm install jszip` + `npm install --save-dev @types/jszip`

---

## Files Changed

| File | Change |
|---|---|
| `app/api/backup/csv/route.ts` | New file — the backup API route |
| `app/(admin)/admin/dashboard/page.tsx` | Add "Download Backup" button to quick-action row |
| `package.json` | Add `jszip` dependency |

---

## Out of Scope

- Scheduling / automated backups
- Encryption of the ZIP
- Incremental / delta backups
- Maintenance billing tables (separate system)
