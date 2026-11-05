# Tenant Verification Portal — Architecture Assessment Report

**Repository:** Oasis Venetia Heights (Electricity Bill)  
**App location:** `electricity-management/` (Next.js app)  
**Repository root:** Deployment wrapper (`vercel.json` → `outputDirectory: electricity-management/.next`)  
**Status:** Inspection-only assessment. No source code, migrations, env vars, or config were modified.  
**Date:** Thu Nov 05 2026  
**Production URL:** https://www.oasisvenetia.in (Vercel project `electricity-management`)

---

## 1. Executive Summary & Recommendation

**Recommended architecture: Option A — Reuse existing Next.js + Prisma + TiDB Cloud.**

This is the safest choice for this production application because:

- It keeps a **single database, single auth system, single deployment unit**, and single codebase — no split-brain between two auth providers or two databases.
- The existing codebase already contains **proven, reusable patterns** for every capability the Tenant Verification Portal needs: Prisma models + migrations, NextAuth + JWT + role/permission guards, Zod validation, PDFKit PDF generation, Nodemailer email, ExcelJS export, file upload stored as MEDIUMBLOB, audit logging, server page + client API route pattern, and Vercel deployment.
- Option B (Supabase) would introduce a **second auth provider, second database, second file store, second deployment pipeline**, and require synchronizing users/roles between NextAuth and Supabase Auth — high complexity, high operational cost, and clear data-isolation risk for a society portal whose tenants are already Residents in the same MySQL/TiDB database.
- Option C (hybrid) is only justified if a specific need (e.g. large document volumes) cannot be met by the existing MEDIUMBLOB approach; current ticket attachments already use MEDIUMBLOB at 5 MB, which is adequate for verification documents.

**Bottom line:** Build the Tenant Verification Portal as a new module inside the existing Next.js app, extending the same Prisma schema, NextAuth auth, permission system, PDF/email/Excel utilities, and Vercel deployment. Follow the Help Desk module as the closest template (it was recently added end-to-end using exactly this approach).

---

## 2. Current Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         VERCEL (sin1 / Singapore)                   │
│  ┌─────────────┐  ┌─────────────────────────────────────────────┐   │
│  │ vercel.json │  │  Next.js 16 App Router (Turbopack build)    │   │
│  │ outputDir   │  │  app/(admin), app/(resident), app/(auth),   │   │
│  │ → .next     │  │  app/(legal), app/maintenance, app/pay,     │   │
│  │             │  │  app/api/*                                   │   │
│  └─────────────┘  └─────────────────────────────────────────────┘   │
│                                   │                                   │
│                                   │ HTTPS                             │
└───────────────────────────────────┼───────────────────────────────────┘
                                    │
                                    v
┌─────────────────────────────────────────────────────────────────────┐
│                    TiDB Cloud (MySQL-compatible)                    │
│  Prisma ORM v7 + @prisma/adapter-mariadb                            │
│  Models: User, Resident, Connection, Bill, Payment,                 │
│  MaintenanceBill, MaintenancePayment, Ticket*, Permission,          │
│  SiteConfig, AuditLog, FlatInfo, Rate, MeterReading                 │
└─────────────────────────────────────────────────────────────────────┘

Auth: NextAuth v5 (Credentials provider, JWT session, bcrypt)
- Cookie domain: .oasisvenetia.in (production only)
- Roles: ADMIN, MANAGER, RESIDENT
- Manager permissions cached in JWT at login (stale until re-login)

Utilities:
- lib/prisma.ts          — singleton PrismaClient (MariaDB adapter, SSL when !localhost)
- lib/permissions.ts     — guardPermission(session, page, action)
- lib/email.ts           — Nodemailer transporter (SMTP)
- lib/email-templates.ts — branded HTML email shells
- lib/pdf.ts             — PDFKit: bills, receipts, demand letters, maintenance bills
- lib/help-desk-job-card.ts — PDFKit job card (template for new PDFs)
- lib/qr.ts              — UPI QR generation
- lib/server-cache.ts    — next/cache unstable_cache (5-min TTL, tags)
- lib/helpers: billing, maintenance-billing, carry-forward, payment-token, reset-token

API pattern (per Help Desk module):
- route.ts → auth() → guardHelpDeskEnabled()/guardPermission() → Zod validate → Prisma → AuditLog → NextResponse
- File uploads: multipart FormData, 5 MB, image-only allowlist, stored as MEDIUMBLOB in DB
- PDF routes: generate buffer → NextResponse with Content-Disposition inline/attachment
- Excel routes: ExcelJS workbook → NextResponse application/vnd.openxmlformats

Deployment:
- Root vercel.json: outputDirectory = electricity-management/.next
- App vercel.json: region sin1, one cron (/api/cron/overdue-notices)
- Env vars (never printed): DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, SMTP_*, CRON_SECRET, RAZORPAY_*
- Build: `prisma generate && next build`; Verify: `npx tsc --noEmit`, `npm run build`
```

---

## 3. Existing Application Structure

### 3.1 Directory layout (inside `electricity-management/`)

```
app/
├── (admin)/admin/          → dashboard, residents, connections, meter-readings,
│                            bills, payments, rates, reports, maintenance/*
├── (resident)/resident/    → dashboard, bills, payments, profile
├── (auth)/                 → login, forgot-password, reset-password/[token]
├── (legal)/                → about, terms
├── maintenance/            → maintenance-mode holding page
├── pay/[token]/            → public tokenized bill page (UPI QR, WhatsApp)
├── api/
│   ├── admin/*, auth/*, backup/*, bills/*, connections/*, cron/*,
│   ├── flat-info/*, help-desk/*, maintenance/*, meter-readings/*,
│   ├── payments/*, pdf/*, permissions/*, public-pay/*, rates/*,
│   ├── razorpay/*, reports/*, residents/*, site/*, test-db/*, users/*
├── layout.tsx, page.tsx
components/
├── admin/                  → sidebar-nav, tables, dialogs, managers (reports, help desk)
├── resident/               → resident tables, payment forms
├── help-desk/              → shared ticket-detail component
├── ui/                     → shadcn primitives
├── idle-timeout.tsx, theme-provider.tsx, theme-toggle.tsx
lib/
├── billing.ts, maintenance-billing.ts, carry-forward.ts
├── email.ts, email-templates.ts, pdf.ts, qr.ts, razorpay.ts
├── payment-token.ts, reset-token.ts, server-cache.ts, utils.ts
├── permissions.ts, help-desk-config.ts, help-desk.ts, help-desk-assignment.ts,
│   help-desk-format.ts, help-desk-job-card.ts, help-desk-categories.ts
├── flat-data.ts, prisma.ts
prisma/
├── schema.prisma           → single source of truth for DB models
├── migrations/             → SQL migrations (e.g. help-desk migration applied to prod)
├── seed.ts                 → destructive; never run against production
├── data/residents.json     → seed data
├── seed-help-desk.ts       → ran against production (permissions + categories)
```

### 3.2 Stack versions

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.10, App Router |
| React | 19.2.4 |
| TypeScript | 5 |
| CSS | Tailwind CSS 4 |
| UI components | shadcn / Radix / Base UI |
| ORM | Prisma 7 + `@prisma/adapter-mariadb` |
| Database | MySQL / TiDB Cloud |
| Auth | NextAuth v5 beta (Credentials, JWT) |
| Password hashing | bcryptjs |
| Validation | Zod 4 + React Hook Form |
| Email | Nodemailer (SMTP) |
| PDF | PDFKit |
| Excel/CSV | ExcelJS, JSZip, PapaParse |
| QR | qrcode |
| Charts | Recharts |
| Toasts | Sonner |
| Deployment | Vercel (region sin1) |

### 3.3 Existing database models (relevant for reuse)

| Model | Purpose |
|-------|---------|
| `User` | Login identity, role, active flag, links to Resident, tickets, audit logs |
| `Resident` | Resident profile, owner/tenant info, link to User, connections, tickets |
| `Connection` | Flat, tower, floor, area, meter, load, status; links bills, maintenance bills, tickets |
| `Bill` / `Payment` | Electricity billing & payments |
| `MaintenanceBill` / `MaintenancePayment` | Maintenance billing & payments (GST-inclusive) |
| `Ticket`, `TicketComment`, `TicketAttachment` | Help Desk (attachment = MEDIUMBLOB bytes) |
| `AuditLog` | Admin mutation log (user, action, entity, entityId, meta, createdAt) |
| `FlatInfo` | Flat inventory (flatNo, tower, floor, unitType, area) |
| `Permission` | MANAGER read/write/delete per page |
| `SiteConfig` | Singleton: maintenanceMode, maintenanceBillingEnabled, helpDeskEnabled, CGST/SGST |

### 3.4 Existing modules & reusable patterns

1. **Electricity Management** — bills, payments, meter readings, rates, carry-forward, PDF receipts, email, public token pay page.
2. **Maintenance Billing** — GST-inclusive bills, advance payments, rebate/waiver adjustments, interest, receipts, demand letters.
3. **Maintenance Reports** — stat cards, charts, overdue table, PDF/XLSX export, cached data loader.
4. **Maintenance Advance Payments** — grouped advance runs, receipt reprints, month-wise breakdown.
5. **Help Desk** — tickets, categories/subcategories, escalation matrix, assignment rules, attachments (MEDIUMBLOB), job-card PDF, Excel export, config toggle (503 guard), resident + admin UI.
6. **Resident Dashboard** — bills, payments, receipts, read-only profile.
7. **Admin Dashboard** — stats, residents, connections, bills, payments, reports, users, permissions, maintenance toggle.

**Key reusable assets for Tenant Verification:**
- `lib/prisma.ts` — DB client
- `lib/permissions.ts` — `guardPermission()` (ADMIN/MANAGER/RESIDENT)
- `auth.ts` / `auth.config.ts` — NextAuth, JWT session
- `middleware.ts` — route gating by role
- `lib/pdf.ts` + `lib/help-desk-job-card.ts` — PDFKit patterns
- `lib/email.ts` + `lib/email-templates.ts` — Nodemailer + branded templates
- `lib/server-cache.ts` — `unstable_cache` data loaders
- `app/api/help-desk/*` — full CRUD + attachment + PDF + export pattern to copy
- `components/admin/sidebar-nav.tsx` — nav group pattern (Maintenance, Help Desk)
- `prisma/schema.prisma` — add new models + migration
- `AuditLog` — audit history pattern

---

## 4. Tenant Verification Requirements Analysis

Based on the stated requirements, the following capabilities are needed:

| Capability | Description |
|------------|-------------|
| Tenant registration | Resident/tenant submits application for a flat |
| Mobile OTP | OTP sent to tenant mobile for verification |
| Flat and owner mapping | Link tenant to a flat and its owner |
| Family member information | Family details of the tenant |
| Document management | ID proof, address proof, agreement, photos, NOC |
| Police verification | Police verification status/workflow |
| Owner approval | Flat owner approves/rejects the tenant |
| Management final approval | Society management gives final approval |
| Application tracking | Track status through the workflow |
| PDF generation | Verification certificate / application form PDF |
| Email and WhatsApp notifications | Status updates to tenant, owner, management |
| Admin dashboard | Manage/verify all applications |
| Excel reporting | Export applications to Excel |
| Audit history | Who changed what and when |

---

## 5. Evaluation of Three Architecture Options

### Option A — Reuse existing Next.js + Prisma + TiDB Cloud (RECOMMENDED)

| Criterion | Assessment |
|-----------|-----------|
| **Development complexity** | Low — all patterns already exist; copy Help Desk module structure |
| **Security** | High — single NextAuth/JWT, existing `guardPermission`, existing middleware, existing SQL database |
| **Data isolation** | High — single database, tenant data isolated by `residentId`/`flatNo` and role checks |
| **Authentication** | Reuses NextAuth (email/password, bcrypt, JWT). Tenants can be `RESIDENT` users or a new `TENANT` role; or unauthenticated public registration with OTP + token-based tracking |
| **Database consistency** | Strong — single TiDB/MySQL database, ACID transactions, Prisma relations |
| **Document storage** | MEDIUMBLOB in DB (already used for `TicketAttachment`, 5 MB limit, image allowlist) |
| **Operational cost** | Low — no new services, no new env vars, same Vercel + TiDB |
| **Maintenance** | Low — one codebase, one migration strategy, one backup strategy |
| **Deployment complexity** | Low — same Vercel push, same build (`prisma generate && next build`) |
| **Future scalability** | Good — TiDB scales horizontally; MEDIUMBLOB adequate for verification docs |

### Option B — Introduce Supabase (PostgreSQL, Auth, Storage) as separate subsystem

| Criterion | Assessment |
|-----------|-----------|
| **Development complexity** | High — new stack, new client libraries, sync between NextAuth and Supabase Auth |
| **Security** | Medium risk — two auth systems to secure, two databases, cross-system consistency |
| **Data isolation** | Lower — tenant verification data split across TiDB and Supabase PG; joins/transactions impossible across DBs |
| **Authentication** | Conflict — NextAuth already in production; Supabase Auth would be a second identity provider with duplicate users |
| **Database consistency** | Weak — eventual consistency between TiDB and Supabase; no foreign keys across DBs |
| **Document storage** | Supabase Storage (S3-compatible) — good for files but a new service to manage |
| **Operational cost** | High — new Supabase project, new env vars, new monitoring, new backups |
| **Maintenance** | High — two ORMs (Prisma + Supabase client), two migration systems, two auth configs |
| **Deployment complexity** | Medium — Supabase env vars in Vercel, separate DB connection management |
| **Future scalability** | Good for Supabase, but adds operational surface area |

### Option C — Hybrid (existing app + DB, separate document storage or auth where justified)

| Criterion | Assessment |
|-----------|-----------|
| **Development complexity** | Medium — reuse app/DB, add one external service (e.g. S3/Blob) only if needed |
| **Security** | High if storage is access-controlled; medium if auth split |
| **Data isolation** | High for DB; storage must be access-controlled per tenant |
| **Authentication** | Reuse NextAuth (no conflict) |
| **Database consistency** | Strong — single DB |
| **Document storage** | External (Vercel Blob, S3, etc.) — justified only if doc volume exceeds MEDIUMBLOB |
| **Operational cost** | Low–Medium — one new storage service at most |
| **Maintenance** | Low — if only storage is added |
| **Deployment complexity** | Low — new env var for storage endpoint |
| **Future scalability** | Good — storage can scale independently |

### Comparison summary

| Criterion | A (Reuse) | B (Supabase) | C (Hybrid) |
|-----------|-----------|--------------|------------|
| Development complexity | Low | High | Medium |
| Security | High | Medium | High |
| Data isolation | High | Lower | High |
| Authentication | Reuse (no conflict) | Conflict (2 providers) | Reuse (no conflict) |
| DB consistency | Strong | Weak | Strong |
| Document storage | MEDIUMBLOB (existing) | Supabase Storage | External (if needed) |
| Operational cost | Low | High | Low–Medium |
| Maintenance | Low | High | Low |
| Deployment complexity | Low | Medium | Low |
| Future scalability | Good | Good (but costly) | Good |

**Winner: Option A.**

---

## 6. Potential Conflicts Identified

| Conflict area | Detail | Resolution in recommended design |
|---------------|--------|----------------------------------|
| **Authentication** | Existing NextAuth (Credentials + JWT) vs Supabase Auth | **Do not introduce Supabase Auth.** Reuse NextAuth. Add OTP via a custom provider or a separate `otpSessions` table + email/SMS; tenants can register without full NextAuth login if desired, using token-based links. |
| **Prisma models vs new models** | New models must be added to the single `schema.prisma` | Add `TenantApplication`, `TenantDocument`, `TenantFamilyMember`, `TenantAudit` models; generate one migration. |
| **User roles vs proposed roles** | Existing roles: ADMIN, MANAGER, RESIDENT | Tenant Verification can reuse `RESIDENT` for owners, add `TENANT` role (or keep applicants as unauthenticated records with `applicationToken`). No conflict if additive. |
| **File storage vs Supabase Storage** | Existing stores attachments as MEDIUMBLOB (Help Desk pattern) | Reuse MEDIUMBLOB for verification documents (5 MB, image/PDF allowlist). No new storage service. |
| **Domain and routes** | Production domain `oasisvenetia.in`, cookie domain hardcoded `.oasisvenetia.in` | New routes under `/admin/tenant-verification` and `/resident/tenant-verification`; cookie domain already covers production. Preview deployments have the known cookie-domain bug (existing issue, not introduced by this feature). |
| **Middleware and API authorization** | `middleware.ts` hard-codes `/admin` and `/resident` role gates; not DB-driven | New API routes use `auth()` + `guardPermission()` per route (Help Desk pattern) rather than relying on middleware. Add new paths to middleware matcher if UI pages need role-based redirect. |
| **Production env vars** | No new secrets strictly needed (SMTP already exists) | WhatsApp would need a new provider env var (optional; can start with email only). |
| **Backup & migration strategy** | Single Prisma migration, TiDB backups, `backups/` folder | New migration follows the Help Desk migration pattern; take a DB backup before applying (per PROJECT.md rule #9). |

---

## 7. Recommended Database Design (Option A)

Add these models to `prisma/schema.prisma` (additive, no changes to existing models):

```prisma
enum TenantApplicationStatus {
  PENDING
  DOCUMENTS_SUBMITTED
  OWNER_APPROVED
  OWNER_REJECTED
  POLICE_VERIFICATION_PENDING
  POLICE_VERIFIED
  POLICE_VERIFICATION_FAILED
  MANAGEMENT_APPROVED
  MANAGEMENT_REJECTED
  ACTIVE
  INACTIVE
}

enum VerificationDocumentType {
  ID_PROOF
  ADDRESS_PROOF
  RENT_AGREEMENT
  NOC
  PHOTO
  OTHER
}

model TenantApplication {
  id              String              @id @default(cuid())
  applicationNumber String            @unique
  residentId      String?             // owner resident (flat owner)
  connectionId    String?             // flat connection
  tenantName      String
  tenantPhone     String
  tenantEmail     String?
  tenantIdProof   String?             // aadhaar/passport number
  moveInDate      DateTime?
  moveOutDate     DateTime?
  status          TenantApplicationStatus @default(PENDING)
  ownerApprovedAt DateTime?
  ownerApprovedBy String?             // user id
  managementApprovedAt DateTime?
  managementApprovedBy String?
  policeVerifiedAt DateTime?
  policeVerificationRef String?
  applicationToken String            @unique // public tracking link
  otpExpiresAt    DateTime?
  otpVerified     Boolean             @default(false)
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  resident    Resident?   @relation(fields: [residentId], references: [id], onDelete: SetNull)
  connection  Connection? @relation(fields: [connectionId], references: [id], onDelete: SetNull)
  documents   TenantDocument[]
  family      TenantFamilyMember[]
  auditLogs   TenantApplicationAudit[]

  @@index([status])
  @@index([applicationNumber])
  @@index([connectionId])
  @@index([applicationToken])
}

model TenantDocument {
  id          String   @id @default(cuid())
  applicationId String
  application TenantApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  documentType VerificationDocumentType
  fileName    String
  mimeType    String
  sizeBytes   Int
  data        Bytes    @db.MediumBlob
  verified    Boolean  @default(false)
  verifiedBy  String?  // user id
  verifiedAt  DateTime?
  createdAt   DateTime @default(now())
  uploadedBy  String?  // user id or tenant id

  @@index([applicationId])
}

model TenantFamilyMember {
  id            String   @id @default(cuid())
  applicationId String
  application   TenantApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  fullName      String
  relation      String
  age           Int?
  idProof       String?
  createdAt     DateTime @default(now())

  @@index([applicationId])
}

model TenantApplicationAudit {
  id        String   @id @default(cuid())
  applicationId String
  application TenantApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  action    String   // STATUS_CHANGE, DOCUMENT_UPLOAD, OWNER_APPROVE, etc.
  fromStatus TenantApplicationStatus?
  toStatus  TenantApplicationStatus?
  meta      Json?
  createdAt DateTime @default(now())

  @@index([applicationId])
  @@index([createdAt])
}
```

**Permission page id:** `tenant-verification` (added to `Permission` model via seed, like `help-desk`).

**SiteConfig:** Consider adding `tenantVerificationEnabled` flag to `SiteConfig` (consistent with `helpDeskEnabled`, `maintenanceBillingEnabled`), or gate purely on permission. Recommend: additive flag for consistency with Help Desk pattern.

---

## 8. Authentication and Authorization Design

### Authentication
- **Reuse NextAuth v5 (Credentials provider, JWT session)** — no new auth provider.
- **Residents/Owners** log in with existing email/password flow (`RESIDENT` role).
- **Tenants/applicants** who don't have a society login: use a public registration form with mobile OTP. OTP stored in a short-lived `otpSessions` table (or in-memory/Redis); verification issues an `applicationToken` for public tracking without full login.
- **Admin/Manager**: existing `ADMIN`/`MANAGER` roles + `guardPermission("tenant-verification", canRead|canWrite|canDelete)`.

### Authorization rules
| Actor | Can create application | Can view own application | Can view all applications | Can approve/reject | Can upload documents |
|-------|----------------------|------------------------|------------------------|-------------------|---------------------|
| Tenant (public, token) | Yes (own flat) | Yes (via token) | No | No | Yes (own docs) |
| RESIDENT (owner) | No | Yes (own flats) | No | Yes (own flat) | No |
| MANAGER (canRead) | No | Yes | Yes (if canRead) | No | No |
| MANAGER (canWrite) | No | Yes | Yes | Yes | No |
| ADMIN | Yes | Yes | Yes | Yes | Yes |

### Session considerations
- Manager permissions are cached in JWT at login (stale until re-login) — existing known limitation, acceptable for this module.
- Cookie domain `.oasisvenetia.in` (production) — new routes share the same domain.

---

## 9. Document Storage Design

**Recommended: Continue MEDIUMBLOB in TiDB/MySQL (same as `TicketAttachment`).**

Rationale:
- `TicketAttachment` already stores file bytes as `Bytes @db.MediumBlob` with 5 MB limit, image-only allowlist, filename + magic-byte validation.
- Verification documents (ID proof, address proof, agreement, photo, NOC) are typically < 5 MB each — fits the same pattern.
- No new storage service, no new env vars, no new backup strategy, single DB transaction for document + application.
- Access control via `auth()` + ownership check (same as `/api/help-desk/attachments/[id]`).

**When to consider external storage (Option C variant):**
- If document volume grows beyond TiDB storage comfort, or if very large files (>5 MB) are needed. At that point add Vercel Blob / S3 with signed URLs, storing only the URL in `TenantDocument`. Not required for MVP.

### API route for documents (modeled on Help Desk)
- `POST /api/tenant-verification/applications/[id]/documents` — multipart, 5 MB, allowlist (image/pdf), magic-byte check.
- `GET /api/tenant-verification/documents/[id]` — auth + ownership, `private, no-store`, inline disposition.

---

## 10. API Design (Next.js App Router route handlers)

Follow the Help Desk pattern exactly: `export const runtime = "nodejs"`, `auth()` → module-enabled guard → `guardPermission()` → Zod validate → Prisma → `AuditLog` → `NextResponse`.

### Admin API
| Route | Method | Description | Guard |
|-------|--------|-------------|-------|
| `/api/tenant-verification/applications` | GET | List all applications (role-aware) | `canRead` |
| `/api/tenant-verification/applications` | POST | Create application (admin on behalf) | `canWrite` |
| `/api/tenant-verification/applications/[id]` | GET | Get one application | `canRead` |
| `/api/tenant-verification/applications/[id]` | PATCH | Update status / approve / reject | `canWrite` |
| `/api/tenant-verification/applications/[id]` | DELETE | Soft-delete / reject | `canDelete` |
| `/api/tenant-verification/applications/[id]/documents` | POST | Upload document | `canWrite` |
| `/api/tenant-verification/documents/[id]` | GET | Download document | `canRead` |
| `/api/tenant-verification/applications/[id]/pdf` | GET | Generate verification PDF | `canRead` |
| `/api/tenant-verification/export` | GET | Excel export (ExcelJS) | `canRead` |
| `/api/tenant-verification/config` | GET/POST | Toggle module enabled | ADMIN only |

### Resident / public API
| Route | Method | Description | Guard |
|-------|--------|-------------|-------|
| `/api/tenant-verification/applications` | POST | Resident submits application (forced to own resident) | RESIDENT / public OTP |
| `/api/tenant-verification/applications/[id]` | GET | Resident views own application | ownership re-check |
| `/api/tenant-verification/applications/[id]/documents` | POST | Resident uploads documents | ownership |
| `/api/tenant-verification/applications/[id]/pdf` | GET | Resident downloads own PDF | ownership |
| `/api/tenant-verification/track/[token]` | GET | Public tracking by applicationToken | no session (token) |
| `/api/tenant-verification/otp/send` | POST | Send mobile OTP | public |
| `/api/tenant-verification/otp/verify` | POST | Verify OTP | public |

### Notification triggers (server actions / API)
- On application submitted → email to owner + management.
- On OTP verified → email/SMS to tenant.
- On owner approve/reject → email to tenant + management.
- On management approve/reject → email + WhatsApp to tenant.
- PDF attached to approval emails.

---

## 11. Security Architecture

| Layer | Control |
|-------|---------|
| **Transport** | HTTPS (Vercel), secure cookies in production |
| **Authentication** | NextAuth JWT, bcrypt password hashing, OTP for tenant mobile verification |
| **Authorization** | `guardPermission()` per API route; role-based middleware redirects; ownership re-check for resident endpoints |
| **Input validation** | Zod schemas on all API routes (as in Help Desk) |
| **File upload** | 5 MB limit, MIME allowlist + magic-byte validation, stored as MEDIUMBLOB, `private, no-store` delivery |
| **SQL injection** | Prisma parameterized queries |
| **Audit trail** | `TenantApplicationAudit` + existing `AuditLog` for admin mutations |
| **Public tracking** | Un-guessable `applicationToken` (cuid + hash), no auth required for `/track/[token]` |
| **IDOR protection** | Every document/application access checks ownership (`residentId`/`connectionId`) or staff permission |
| **No secrets in repo** | Env vars only; `.env.local`/` .env.production.local` gitignored |

---

## 12. Deployment Architecture

- **Single Vercel project** (`electricity-management`), region `sin1`, same as production.
- **Build command:** `prisma generate && next build` (already in `package.json`).
- **Database migration:** New Prisma migration file under `prisma/migrations/`; apply to TiDB Cloud after a backup (per PROJECT.md rules). Do NOT run seed against production.
- **Env vars:** No new strictly required vars. Optional WhatsApp provider vars can be added to Vercel.
- **Cron:** If OTP expiry or status reminders are needed, add a cron route (e.g. `/api/cron/tenant-verification-otp-cleanup`) and schedule in `electricity-management/vercel.json`. Currently only `/api/cron/overdue-notices` is scheduled.
- **No separate deployment pipeline** — same `git push → Vercel` flow.

---

## 13. Risks and Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| MEDIUMBLOB storage grows large | Low–Medium | Medium | Archive old documents; move to external storage later (Option C variant) |
| Manager permissions stale until re-login | Medium | Low | Document the limitation (existing); acceptable for MVP |
| Cookie domain `.oasisvenetia.in` breaks previews | Medium | Low | Existing known issue; new routes share it |
| OTP delivery depends on SMS provider | Medium | Medium | Start with email OTP; add SMS/WhatsApp later |
| Migration applied without backup | Low | High | Follow PROJECT.md rule #9 (backup before migration) |
| Two parallel modules with similar patterns | Low | Low | Reuse Help Desk code structure to keep consistency |

---

## 14. Implementation Roadmap

**Phase 1 — Database & schema**
1. Add models to `prisma/schema.prisma` (`TenantApplication`, `TenantDocument`, `TenantFamilyMember`, `TenantApplicationAudit`, enums, optional `tenantVerificationEnabled` on `SiteConfig`).
2. Generate Prisma migration SQL; apply to a staging copy of TiDB, then production (with backup).
3. Add `tenant-verification` page id to `Permission` seed + `Permission` rows for ADMIN/MANAGER.

**Phase 2 — Core API routes**
4. `POST/GET /api/tenant-verification/applications` (create + list).
5. `GET/PATCH/DELETE /api/tenant-verification/applications/[id]`.
6. Document upload + download routes.
7. OTP send/verify routes (public).
8. Public tracking route `/api/tenant-verification/track/[token]`.
9. Config toggle (`GET/POST /api/tenant-verification/config`).

**Phase 3 — PDF, email, WhatsApp**
10. Verification certificate PDF (PDFKit, modeled on `help-desk-job-card.ts`).
11. Email templates for status changes (Nodemailer + `email-templates.ts`).
12. WhatsApp notifications (optional, new provider env var).

**Phase 4 — UI**
13. Sidebar nav entry under Maintenance or a new group (`Tenant Verification`).
14. Admin: application list, detail view, approve/reject, document review, Excel export.
15. Resident: submit application, upload documents, track status.
16. Public: track page by token.

**Phase 5 — Verification & deployment**
17. `npx tsc --noEmit`, `npm run build`, lint review.
18. Staging test; production deploy via `git push` + `npx vercel --prod --yes` from `electricity-management/`.

---

## 15. Exact Files and Folders to Modify or Create

### In `electricity-management/prisma/`
- **Modify:** `schema.prisma` — add new models/enums/page id.
- **Create:** `migrations/2026XXXX_add_tenant_verification/migration.sql` (new migration).
- **Create:** `seed-tenant-verification.ts` (upsert permissions + default data; run only with approval, never against production indiscriminately).

### In `electricity-management/lib/`
- **Create:** `tenant-verification.ts` — core business logic (application number, OTP helpers, status transitions, assignee resolution).
- **Create:** `tenant-verification-config.ts` — `tenantVerificationEnabled()` + `guardTenantVerificationEnabled()` (mirror `help-desk-config.ts`).
- **Create:** `tenant-verification-format.ts` — client-safe labels/badges (mirror `help-desk-format.ts`).
- **Create:** `tenant-verification-pdf.ts` — PDFKit verification certificate (mirror `help-desk-job-card.ts` / `pdf.ts`).
- **Create:** `tenant-verification-email.ts` — email templates for verification status (mirror `email-templates.ts`).
- **Modify:** `server-cache.ts` — add cached data loader for tenant verification dashboard stats.

### In `electricity-management/app/api/tenant-verification/`
- **Create:** `applications/route.ts` (GET/POST).
- **Create:** `applications/[id]/route.ts` (GET/PATCH/DELETE).
- **Create:** `applications/[id]/documents/route.ts` (POST).
- **Create:** `documents/[id]/route.ts` (GET).
- **Create:** `applications/[id]/pdf/route.ts` (GET).
- **Create:** `export/route.ts` (GET Excel).
- **Create:** `config/route.ts` (GET/POST toggle).
- **Create:** `otp/send/route.ts` and `otp/verify/route.ts` (public).
- **Create:** `track/[token]/route.ts` (public tracking).

### In `electricity-management/app/`
- **Create:** `(admin)/admin/tenant-verification/page.tsx` — admin list page.
- **Create:** `(admin)/admin/tenant-verification/[id]/page.tsx` — admin detail page.
- **Create:** `(resident)/tenant-verification/page.tsx` — resident submit/track.
- **Create:** `(resident)/tenant-verification/new/page.tsx` — resident new application.
- **Create:** `(resident)/tenant-verification/[id]/page.tsx` — resident detail.
- **Create:** `(public)/tenant-verification/track/[token]/page.tsx` — public track page (optional).
- **Modify:** `middleware.ts` — add new paths to matcher if UI page redirects needed (optional; API routes self-guard).

### In `electricity-management/components/`
- **Create:** `admin/tenant-verification-list.tsx` — admin table.
- **Create:** `admin/tenant-verification-detail.tsx` — admin detail (or share with resident).
- **Create:** `admin/tenant-verification-toggle.tsx` — enable/disable toggle card.
- **Create:** `resident/tenant-verification-form.tsx` — resident application form.
- **Create:** `resident/tenant-verification-document-upload.tsx` — document upload.
- **Create:** `shared/tenant-verification-detail.tsx` — shared detail (staff controls + resident read-only).
- **Modify:** `components/admin/sidebar-nav.tsx` — add Tenant Verification group/sub-items (mirror Help Desk group).

### In `electricity-management/`
- **Modify:** `vercel.json` — add cron routes if scheduled jobs needed (optional).

### Repository root (inspection-only deliverable)
- **Create:** `TENANT_VERIFICATION_ARCHITECTURE_ASSESSMENT.md` (this report).

---

## 16. Final Recommendation

**Architecture Option A — Reuse existing Next.js + Prisma + TiDB Cloud — is the safest choice.**

**Why:**
1. **Single system of record:** One database (TiDB Cloud), one auth (NextAuth), one codebase, one deployment (Vercel). No split-brain between NextAuth and Supabase Auth, no cross-database consistency problems.
2. **Every required capability already exists in pattern form:** PDF generation (PDFKit), email (Nodemailer + templates), Excel export (ExcelJS), file upload as MEDIUMBLOB (5 MB, validated), audit logging, role/permission guards, server page + client API route pattern, module on/off toggle with 503 guard. The Help Desk module is a near-perfect template for this exact kind of feature addition.
3. **Minimal operational surface:** No new services, no new env vars (strictly), no new backup or migration strategy, no new monitoring. Tenant Verification piggybacks on the existing Vercel + TiDB + NextAuth operational model.
4. **Data isolation is preserved:** All verification data lives in the same MySQL/TiDB database, isolated by `residentId`/`connectionId` and enforced by `guardPermission()` and ownership re-checks — the same model already protecting bills, payments, and tickets.
5. **Lower risk:** Introducing Supabase (Option B) would duplicate users, auth sessions, and file storage, and create distributed transactions that the current stack doesn't support. Option C only makes sense if document storage outgrows MEDIUMBLOB — not a day-one concern.

**Implementation should proceed only after explicit approval**, following the repository rules: no seed against production, backup before migration, verify with `npx tsc --noEmit` and `npm run build`, and do not commit/push/deploy without approval.
