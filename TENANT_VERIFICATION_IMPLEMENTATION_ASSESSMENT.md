# TENANT VERIFICATION PORTAL — PHASE 0 IMPLEMENTATION ASSESSMENT

**Repository:** Oasis Venetia Heights (Electricity Bill)  
**App location:** `electricity-management/` (Next.js app)  
**Repository root:** Deployment wrapper  
**Specification:** `Tenant_Verification_Agent_Implementation_Specification_v2 (1).docx`  
**Status:** Phase 0 — Read-only assessment. No source files modified.  
**Date:** Thu Nov 05 2026  

---

## CRITICAL CONSTRAINT (from specification)

> Add the Tenant Verification module without breaking the existing live website, changing existing business rules, damaging customer records, or performing unapproved production operations.

This assessment is **read-only**. No code edits, no migrations, no commits, no deployments, no database access. Approval is required before Phase 1.

---

## 1. EXISTING ARCHITECTURE AND RELEVANT FILES/MODELS/ROUTES

### Stack (confirmed from package.json, PROJECT.md, AGENTS.md)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.10, App Router |
| React | 19.2.4 |
| TypeScript | 5 |
| CSS | Tailwind CSS 4 |
| UI components | shadcn / Radix / Base UI |
| ORM | Prisma 7 + `@prisma/adapter-mariadb` |
| Database | MySQL / TiDB Cloud |
| Auth | NextAuth v5 beta (Credentials provider, JWT session) |
| Password hashing | bcryptjs |
| Validation | Zod 4 + React Hook Form |
| Email | Nodemailer (SMTP) |
| PDF | PDFKit |
| Excel/CSV | ExcelJS, JSZip, PapaParse |
| QR | qrcode |
| Charts | Recharts |
| Deployment | Vercel (region sin1) |

### Repository layout (confirmed from PROJECT.md)

```
/ (deployment wrapper)
├─ vercel.json              # outputDirectory: electricity-management/.next
├─ AGENTS.md                # agent instructions
├─ PROJECT.md               # project memory
├─ electricity-management/  # Next.js application
│  ├─ app/
│  │  ├─ (admin)/admin/        # admin pages (dashboard, residents, bills, etc.)
│  │  ├─ (resident)/resident/  # resident pages
│  │  ├─ (auth)/               # login, forgot/reset password
│  │  ├─ (legal)/              # about, terms
│  │  ├─ maintenance/          # holding page
│  │  ├─ pay/[token]/          # public tokenized bill page
│  │  └─ api/                  # all API routes
│  ├─ components/
│  │  ├─ admin/                # admin tables, dialogs, sidebar
│  │  ├─ resident/             # resident tables, payment forms
│  │  └─ ui/                   # shadcn primitives
│  ├─ lib/                     # billing, PDF, email, auth helpers, caches
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ seed.ts               # destructive; never run against production
│  └─ auth.ts, auth.config.ts, middleware.ts
```

### Existing Prisma schema models (confirmed from schema.prisma)

| Model | Purpose |
|-------|---------|
| `User` | Login identity, role, active flag, links to Resident, tickets, audit logs |
| `Resident` | Resident profile, owner/tenant info, link to User, connections |
| `Connection` | Flat, tower, floor, area, meter, load, status; links bills, maintenance bills |
| `FlatInfo` | Flat inventory (flatNo, tower, floor, unitType, area) |
| `Bill` / `Payment` | Electricity billing & payments |
| `MaintenanceBill` / `MaintenancePayment` | Maintenance billing & payments (GST-inclusive) |
| `Ticket`, `TicketComment`, `TicketAttachment` | Help Desk (attachments stored as MEDIUMBLOB) |
| `AuditLog` | Admin mutation log (user, action, entity, entityId, meta, createdAt) |
| `Permission` | MANAGER read/write/delete per page |
| `SiteConfig` | Singleton: maintenanceMode, maintenanceBillingEnabled, helpDeskEnabled, CGST/SGST |
| `Rate`, `MeterReading` | Electricity rates and readings |

### Existing roles (confirmed from schema.prisma)

- `Role`: ADMIN, MANAGER, RESIDENT

### Existing API route patterns (confirmed from app/api/)

```
/api/auth/[...nextauth]          # NextAuth
/api/bills/*                     # Electricity bills
/api/payments/*                  # Electricity payments
/api/maintenance/*               # Maintenance billing
/api/help-desk/*                 # Help Desk (tickets, attachments, config, export)
/api/reports/*                   # Reports (PDF, XLSX)
/api/residents/*                 # Residents
/api/connections/*               # Connections/flats
/api/permissions/*               # Permissions matrix
/api/rates/*                     # Rates
/api/cron/*                      # Cron jobs
/api/site/status                 # Site status (maintenance mode)
```

### Existing auth/permission framework (confirmed from auth.ts, auth.config.ts, middleware.ts, lib/permissions.ts)

- NextAuth v5 Credentials provider with JWT session
- `auth()` returns session with `user.id`, `user.role`, `user.isActive`, `user.permissions`
- `guardPermission(session, page, action)` — ADMIN bypasses; MANAGER checks JWT-cached permissions; RESIDENT gets 403
- Middleware handles role-based redirects for `/admin`, `/resident`, `/api/*` routes
- Cookie domain hardcoded to `.oasisvenetia.in` in production (known issue)

### Existing reusable utilities (confirmed from lib/)

| File | Purpose |
|------|---------|
| `lib/prisma.ts` | Singleton PrismaClient with MariaDB adapter, SSL when not localhost |
| `lib/permissions.ts` | `guardPermission()` — role/permission guard |
| `lib/email.ts` | Nodemailer transporter (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) |
| `lib/email-templates.ts` | Branded HTML email shell |
| `lib/pdf.ts` | PDFKit: bills, receipts, demand letters, maintenance bills |
| `lib/help-desk-job-card.ts` | PDFKit job card (template for module PDFs) |
| `lib/qr.ts` | UPI QR generation |
| `lib/server-cache.ts` | `unstable_cache` data loaders with TTL and tags |
| `lib/help-desk-config.ts` | `helpDeskEnabled()` + `guardHelpDeskEnabled()` 503 guard pattern |
| `lib/help-desk.ts` | Help Desk core logic, ticket serialization |
| `lib/help-desk-format.ts` | Client-safe labels/badges |
| `lib/maintenance-billing.ts` | Maintenance billing calculations |
| `lib/billing.ts` | Electricity billing calculations |

### Existing file storage pattern (confirmed from schema.prisma + help-desk routes)

- `TicketAttachment.data` stored as `Bytes @db.MediumBlob` (5 MB limit)
- File upload via multipart FormData, image-only allowlist, magic-byte validation
- Document download via `GET /api/help-desk/attachments/[id]` with `private, no-store` headers and ownership checks

### Known issues (from PROJECT.md Section 10) that affect this module

1. **Repository data exposure** — backup under `backups/` contains production SQL dump with resident data
2. **Manager read-permission bypass** — middleware and pages check role only, not `canRead`
3. **Bulk maintenance bills undercharge GST** — bulk generation path disagrees with single path
4. **Razorpay verification unsafe** — not wired into UI anyway
5. **Maintenance receipt IDOR** — receipt route checks only session, not ownership
6. **Test/bypass endpoints** — `/api/test-db`, `/api/payments/test-pay`, `/api/public-pay/test`
7. **Destructive financial deletes** — hard-deletes bills, payments, residents
8. **Password/session weaknesses** — reset tokens reusable for 24 hours, JWT 30 days
9. **Hardcoded production cookie domain** — breaks preview deployments
10. **Destructive seed** — `prisma/seed.ts` deletes all business data
11. **Validation gaps** — negative readings, PAID without payment, receipt number race
12. **Reporting inconsistency** — XLSX report total uses revenue vs billed total
13. **Cron gaps** — only one cron scheduled

---

## 2. WHAT CAN BE REUSED

Per the specification's constraint: "Reuse existing user, flat, tower, owner and role models where they represent the same real-world entities. Do not create duplicate master data."

### Reusable — No changes needed

| Capability | Existing asset | Reuse approach |
|-----------|---------------|---------------|
| Authentication | `auth.ts`, `auth.config.ts`, NextAuth Credentials + JWT | Reuse for Property Owner and Management Admin login. Tenant/Applicant may use OTP-based identity (see gaps) |
| Roles | `Role` enum: ADMIN, MANAGER, RESIDENT | Reuse ADMIN/MANAGER for management staff. Tenant identity needs separate handling (see gaps) |
| Permissions | `Permission` model, `guardPermission()`, `lib/permissions.ts` | Reuse for Management Admin and Owner permission checks. Add `tenant-verification` page ids |
| User/Resident | `User`, `Resident` models | Property Owner maps to existing `Resident`/`User` with `flatNo` via `Connection` |
| Flat/Tower | `Connection` (tower, flatNo), `FlatInfo` | Reuse for flat selection and owner mapping |
| Email | `lib/email.ts`, `lib/email-templates.ts`, Nodemailer SMTP | Reuse for notification triggers |
| PDF | `lib/pdf.ts`, PDFKit, `help-desk-job-card.ts` pattern | Reuse for approved verification certificate PDF |
| Excel | `lib/server-cache.ts`, ExcelJS | Reuse for filtered export reports |
| Audit log | `AuditLog` model | Reuse for tenant verification audit history |
| Module toggle | `SiteConfig.helpDeskEnabled` + `guardHelpDeskEnabled()` pattern | Reuse pattern for `tenantVerificationEnabled` flag |
| File upload | Help Desk attachment route (MEDIUMBLOB, 5 MB, allowlist) | **CAUTION** — spec says inspect but "do not assume MEDIUMBLOB is suitable for identity documents or larger files" |
| Sidebar nav | `components/admin/sidebar-nav.tsx` | Reuse expandable group pattern for Tenant Verification group |
| Reports | `components/admin/maintenance-reports-client.tsx`, `reports-client.tsx` | Reuse for Excel/PDF report UI pattern |
| Data loaders | `lib/server-cache.ts` `unstable_cache` | Reuse for cached dashboard stats |

### Needs new code (isolated module)

| Capability | New files needed |
|-----------|-----------------|
| Tenant application models | New Prisma models (see Section 6) |
| OTP request/verify | New API routes (no existing OTP infrastructure) |
| Tenant application CRUD | New API routes under `/api/tenant-verification/` |
| Owner decision API | New API routes under `/api/owner/tenant-verification/` |
| Admin workflow API | New API routes under `/api/admin/tenant-verification/` |
| Tenant UI pages | New pages under `app/tenant-verification/` (or `app/(resident)/tenant-verification/`) |
| Owner UI pages | New pages under `app/owner/tenant-verification/` |
| Admin UI pages | New pages under `app/(admin)/admin/tenant-verification/` |
| Shared components | New components under `components/tenant-verification/` |
| Library services | New files under `lib/tenant-verification/` |

---

## 3. GAPS AND DECISIONS NEEDED

### Critical decisions requiring management confirmation (from spec Section 16)

| Decision | Why needed |
|----------|-----------|
| **Mobile OTP provider** | No OTP infrastructure exists. Need provider (Twilio, MSG91, etc.), sender ID, and account owner |
| **Private document storage** | Spec: "Inspect existing Help Desk attachment storage (MEDIUMBLOB) but do not assume suitable for identity documents or larger files." Need approved private object storage or confirm MEDIUMBLOB is acceptable |
| **Owner-to-flat mapping** | Existing `Connection` model links `Resident` to `flatNo`. Need to verify if this can serve as owner mapping or if new `TenantFlatOwnerMapping` model is needed |
| **Mandatory vs optional fields** | Spec Section 18 lists many fields but doesn't specify which are mandatory. Need management confirmation |
| **Police verification policy** | Can application be approved with verification pending, or must it be verified first? |
| **Owner rejection / tenant withdrawal policy** | Exact behavior needed |
| **Electronic signature legal method** | Spec: "Do not claim electronic signature is legally equivalent without approval" |
| **PDF content and signatory** | What must appear on final PDF, who is authorized signatory |
| **Excel export roles and fields** | Which roles can export, which fields may be included |
| **Canonical domain** | `oasisvenetia.in` vs `www.oasisvenetia.in` (redirect behavior) |
| **Retention period** | For applications and identity documents |
| **File size/type limits** | For document uploads |

### Technical gaps

| Gap | Impact |
|-----|--------|
| No OTP infrastructure | Need to build request-OTP / verify-OTP with rate limiting, expiry, attempt limits |
| No tenant identity model | Tenants/Applicants may not have `User`/`Resident` records. Need phone-based identity mapping |
| No owner-flat mapping model | Existing `Connection` links Resident→flat, but owner may differ from resident. May need `TenantFlatOwnerMapping` |
| MEDIUMBLOB size limit | 5 MB may be insufficient for ID proofs, rent agreements, police reports |
| No signed URL infrastructure | Need private document download with auth checks |
| Manager permission cache staleness | Known issue — permissions cached in JWT at login, stale until re-login |

---

## 4. PROPOSED FRONTEND ROUTE/SCREEN PLAN

Per spec Section 4 and Section 13 repository structure guidance. Routes isolated under dedicated namespace:

### Tenant / Applicant portal

| Route | Purpose | Auth |
|-------|---------|------|
| `/tenant-verification/` | Landing/instructions — who should apply, required documents, process, privacy notice, Start Application action | Public |
| `/tenant-verification/register` | Multi-step wizard (8 steps per spec Section 18.3) | OTP-verified session |
| `/tenant-verification/applications` | My applications / tracking — application number, flat, status, timeline, corrections, approved PDF download | OTP-verified session |
| `/tenant-verification/applications/[id]` | Application detail — read-only summary, correction requests, resubmit | OTP-verified session + ownership check |

### Property Owner portal

| Route | Purpose | Auth |
|-------|---------|------|
| `/owner/tenant-verification/` | Owner dashboard — summary counts for pending/approved/rejected limited to mapped flats | Existing login (ADMIN/MANAGER/RESIDENT role + owner mapping) |
| `/owner/tenant-verification/applications` | Application list — search/filter by application number, flat, tenant, status; pagination | Owner role + flat mapping check |
| `/owner/tenant-verification/applications/[id]` | Application detail — permitted tenant/tenancy/family/police/document info, document preview, approve/reject decision | Owner role + flat mapping check |

### Management Admin portal

| Route | Purpose | Auth |
|-------|---------|------|
| `/admin/tenant-verification/` | Admin dashboard — counts for submitted/owner pending/management pending/correction requested/approved/rejected | ADMIN/MANAGER + `tenant-verification` canRead |
| `/admin/tenant-verification/applications` | Work queue — search/filter by application number, tower, flat, tenant, owner, date, police status, workflow status; pagination | ADMIN/MANAGER + `tenant-verification` canRead |
| `/admin/tenant-verification/applications/[id]` | Application review — full permitted application, family, documents, consent, approval history | ADMIN/MANAGER + `tenant-verification` canRead |
| `/admin/tenant-verification/flats` | Flat-owner mapping management | ADMIN/MANAGER + canWrite |
| `/admin/tenant-verification/reports` | Excel/PDF reports | ADMIN/MANAGER + canRead |

### Shared UI components

| Component | Purpose |
|-----------|---------|
| `components/tenant-verification/application-wizard.tsx` | Multi-step registration wizard (8 steps) |
| `components/tenant-verification/document-upload.tsx` | Private document upload with progress, replace/remove |
| `components/tenant-verification/application-list.tsx` | Tenant application tracking list |
| `components/tenant-verification/application-detail.tsx` | Application detail view |
| `components/tenant-verification/owner-decision.tsx` | Owner approve/reject with remarks |
| `components/tenant-verification/admin-review.tsx` | Admin document/police review, correction request, final decision |
| `components/tenant-verification/tenant-verification-toggle.tsx` | Module enable/disable toggle card |

---

## 5. PROPOSED BACKEND API/SERVICE PLAN

Per spec Section 5. API endpoint names are logical examples — must adapt to repository conventions (Help Desk pattern: `auth()` → module guard → `guardPermission()` → Zod validate → Prisma → `AuditLog` → `NextResponse`).

### API routes (all guarded)

| Route | Method | Purpose | Guard |
|-------|--------|---------|-------|
| `/api/tenant-verification/auth/request-otp` | POST | Validate phone, rate-limit, send OTP | Public (rate-limited) |
| `/api/tenant-verification/auth/verify-otp` | POST | Verify OTP, create/reuse identity mapping | Public (rate-limited) |
| `/api/tenant-verification/applications` | GET | List current applicant's applications | Tenant session |
| `/api/tenant-verification/applications` | POST | Create draft application | Tenant session |
| `/api/tenant-verification/applications/[id]` | GET | Get application (ownership check) | Tenant session |
| `/api/tenant-verification/applications/[id]` | PATCH | Update draft fields | Tenant session |
| `/api/tenant-verification/applications/[id]/submit` | POST | Validate, consent, documents, assign application number | Tenant session |
| `/api/tenant-verification/applications/[id]/family-members` | POST/PATCH/DELETE | Manage family records | Tenant session + ownership |
| `/api/tenant-verification/applications/[id]/documents` | POST/GET | Upload/list documents | Tenant session + ownership |
| `/api/tenant-verification/applications/[id]/timeline` | GET | Status history (applicant-visible only) | Tenant session + ownership |
| `/api/tenant-verification/applications/[id]/pdf` | GET | Generate/serve approved PDF | Auth + access check |
| `/api/owner/tenant-verification/applications` | GET | List applications for mapped flats | Owner role + mapping check |
| `/api/owner/tenant-verification/applications/[id]/decision` | POST | Approve/reject with remarks | Owner role + mapping check |
| `/api/admin/tenant-verification/dashboard` | GET | Aggregate counts | ADMIN/MANAGER + canRead |
| `/api/admin/tenant-verification/applications` | GET | Search/filter/paginate | ADMIN/MANAGER + canRead |
| `/api/admin/tenant-verification/applications/[id]/decision` | POST | Final approve/reject | ADMIN/MANAGER + canWrite |
| `/api/admin/tenant-verification/applications/[id]/corrections` | POST | Request corrections | ADMIN/MANAGER + canWrite |
| `/api/admin/tenant-verification/flats` | GET/POST/PATCH | Manage flat-owner mapping | ADMIN/MANAGER + canWrite |
| `/api/admin/tenant-verification/owners` | GET/POST/PATCH | Manage owner mapping | ADMIN/MANAGER + canWrite |
| `/api/admin/tenant-verification/reports` | GET | Filtered Excel export | ADMIN/MANAGER + canRead |

### Service boundaries (per spec Section 5.1)

| Service | Responsibilities |
|---------|-----------------|
| `ApplicationService` | Draft creation, field updates, submission validation, application number assignment, status changes |
| `AuthorizationService` | Tenant ownership, owner-flat mapping, admin permissions, document access decisions |
| `WorkflowService` | Allowed state transitions, approval/rejection/correction logic, transactional history writes |
| `DocumentService` | Upload validation, private storage, metadata, signed download access, replacement, retention |
| `NotificationService` | Email/WhatsApp/in-app notification dispatch, templates, retries, delivery logs |
| `PdfService` / `ReportService` | Approved PDF, permission-controlled Excel exports |
| `AuditService` | Record actor, role, action, target, timestamp, outcome; redact sensitive values |

---

## 6. PROPOSED PRISMA MODEL CHANGES AND MIGRATION IMPACT

### New models to add to `prisma/schema.prisma`

**TenantApplication** — Core application record
```
id (cuid), applicationNumber (unique), applicantPhone, applicantUserId (optional),
flatId (references Connection), ownerReference (owner userId or connection resident),
status (enum: DRAFT, SUBMITTED, OWNER_PENDING, MANAGEMENT_PENDING, CHANGES_REQUESTED, APPROVED, REJECTED, WITHDRAWN),
personal fields (name, fatherSpouseName, dob, mobile, email, occupation, employer, officeAddress, nationality, maritalStatus),
tenancy fields (moveInDate, tenancyFrom, tenancyTo, permanentAddress, occupancyType),
employment fields,
police fields (idProofType, idProofLast4, policeStatus, policeRef, policeDate, previousAddress),
vehicle fields (repeatable — separate model),
emergency contact fields,
consentVersion, consentAcceptedAt,
applicationNumber, submittedAt, createdAt, updatedAt
```

**TenantFamilyMember** — Repeatable family records
```
id, applicationId, name, relationship, age/dob, mobile, createdAt
```

**TenantDocument** — Private document storage
```
id, applicationId, category (enum), storageKey, originalFileName, mimeType, sizeBytes, checksum,
uploadedBy, reviewStatus (PENDING/VERIFIED/REJECTED/NEEDS_REPLACEMENT), reviewer, reviewedAt, remarks, createdAt
```

**TenantVehicle** — Repeatable vehicle records
```
id, applicationId, vehicleType, registrationNo, stickerRfidNo, createdAt
```

**TenantApprovalHistory** — Immutable audit history
```
id, applicationId, stage, action, previousStatus, nextStatus, actorUserId, actorRole, remarks, createdAt
```

**TenantNotificationLog** — Notification delivery log
```
id, applicationId, channel, template, recipientReference, status, providerMessageId, attemptCount, errorCode, timestamps
```

**TenantFlatOwnerMapping** (only if needed)
```
flatId, ownerUserId, active, effectiveFrom, effectiveTo, createdBy, audit fields
```

**SiteConfig** — Add `tenantVerificationEnabled` boolean (pattern matches `helpDeskEnabled`)

**Permission** — Add page ids: `tenant-verification`, `owner-tenant-verification`, `admin-tenant-verification`

### Migration impact

- **Additive only** — no existing tables modified, no columns dropped
- `SiteConfig` gets one new nullable boolean column with `DEFAULT false`
- `Permission` gets new rows (no schema change)
- Migration must be reviewed and explicitly approved before applying
- Must test on local/staging copy before production

### ID convention

Use repository's established `cuid()` convention (confirmed from existing models).

---

## 7. WORKFLOW STATE-TRANSITION MATRIX

Per spec Section 6. Preserves clear distinction between owner approval and final management approval.

| Current State | Actor/Action | Next State | Rules |
|--------------|-------------|-----------|-------|
| DRAFT | Tenant submits | SUBMITTED / OWNER_PENDING | All required fields, documents, consent validated; duplicate submission guarded |
| OWNER_PENDING | Mapped owner approves | MANAGEMENT_PENDING | Only owner mapped to that flat; record decision and remarks/history |
| OWNER_PENDING | Mapped owner rejects | REJECTED | Require reason; notify tenant and management; cannot proceed to final approval |
| MANAGEMENT_PENDING | Authorized admin requests corrections | CHANGES_REQUESTED | Specify fields/documents and instructions; notify tenant |
| CHANGES_REQUESTED | Tenant resubmits | MANAGEMENT_PENDING | Validate updated data; preserve prior values and full history |
| MANAGEMENT_PENDING | Authorized admin approves | APPROVED | Final approval only; transactionally record decision, actor, timestamp; trigger PDF and notifications |
| MANAGEMENT_PENDING | Authorized admin rejects | REJECTED | Require reason; record final decision and notify parties |
| DRAFT / SUBMITTED | Tenant withdraws (if policy permits) | WITHDRAWN | Only if permitted by policy and before restricted workflow stage; audit action |

### Key business rules

- Owner approval ≠ Management approval (two distinct gates)
- Application number assigned at submission, unique at database level
- Duplicate submission guarded
- Police verification: uploaded evidence alone must NOT automatically set verified status
- Corrections: tenant can only update permitted fields/documents; prior values preserved
- Final decision: transactional — decision + history + PDF trigger + notifications all in one transaction
- No hard-deletion of approval/audit history

---

## 8. SECURITY AND PRIVACY RISKS

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Identity document exposure** | High | Private storage only, no public URLs, authenticated download endpoints, short-lived signed URLs, MIME/signature validation, size limits |
| **Owner impersonation** | High | Server-side owner-flat mapping check on every request, never trust frontend flat ID |
| **Tenant data leakage** | High | Tenant can only access own application; server-side ownership re-check on every API |
| **OTP abuse / phone enumeration** | Medium | Rate limiting, attempt limits, resend cooldown, no OTP in logs |
| **Permission cache staleness** | Medium (known issue) | Document limitation; consider live permission check for sensitive operations |
| **Audit log containing PII** | Medium | Redact sensitive values from audit metadata |
| **Notification failure after decision** | Low | Decouple notification from core transaction; decision remains committed |
| **Electronic signature legality** | Medium | Do not claim legal equivalence without approval; provide printable/signature workflow |
| **Cookie domain hardcoded** | Low (known issue) | Affects preview deployments; production domain confirmed |
| **MEDIUMBLOB size limit (5 MB)** | Medium | May be insufficient for ID proofs, rent agreements, police reports; consider external storage |

### Privacy considerations (Indian context)

- Collect minimum required personal data
- Prefer masked Aadhaar (last 4 digits) unless management/legal requires full
- Document consent, purpose, retention period, access policy, deletion/anonymization process
- Obtain legal/business review for applicable Indian privacy requirements
- No identity numbers, document contents, OTPs, or signed URLs in logs/analytics/error traces/notifications

---

## 9. TEST AND REGRESSION PLAN

### Per spec Section 12 — Minimum test cases

| Area | Test cases |
|------|-----------|
| OTP | Correct OTP, wrong OTP, expired OTP, resend cooldown, too many attempts, rate-limit, phone enumeration protection |
| Tenant | Create draft, save/reopen, required-field validation, duplicate submit, own application access, deny another tenant's application, correction and resubmit |
| Flat/owner | Valid flat, invalid/nonexistent flat, inactive mapping, owner sees mapped flat, owner denied unmapped flat, mapping change audited |
| Documents | Allowed file, disallowed extension, MIME mismatch, oversized file, duplicate/replacement, unauthorized preview/download, expired signed URL |
| Workflow | Owner approval, owner rejection, admin correction request, tenant resubmission, final approval, final rejection, invalid transition, concurrent decisions |
| Admin | Permission separation, search/filter/pagination, unauthorized export, audit history completeness |
| PDF/Excel | PDF unavailable before final approval, PDF accessible to authorized applicant, sensitive fields masked, Excel filters correct, export audited |
| Notifications | Each workflow trigger, provider failure, retry, duplicate delivery protection, approval remains committed after notification failure |
| **Regression** | **Existing login, resident pages, electricity billing, maintenance billing, Help Desk, reports and other existing routes continue to work** |

### Verification commands (from AGENTS.md)

- `npx tsc --noEmit` inside `electricity-management/`
- `npm run build` inside `electricity-management/`
- `npm run lint` (known noisy baseline — distinguish baseline vs new issues)

---

## 10. PHASED IMPLEMENTATION ESTIMATE AND EXACT FILES EXPECTED TO CHANGE

### Phase 0 — Read-only discovery (CURRENT — NO CHANGES)

**Deliverable:** This assessment report  
**Status:** Complete — awaiting user approval before Phase 1

### Phase 1 — Design approval

**Deliverable:** Proposed route tree, permissions matrix, schema diagram, status transition matrix, storage approach, OTP provider, migration plan  
**Files:** Documentation only (no source changes)  
**Gate:** User reviews and approves design. No migration or provider setup before approval.

### Phase 2 — Foundation

| File | Action |
|------|--------|
| `electricity-management/lib/tenant-verification/config.ts` | **Create** — `tenantVerificationEnabled()` + `guardTenantVerificationEnabled()` 503 guard |
| `electricity-management/lib/tenant-verification.ts` | **Create** — core business logic, application number generation, status transitions |
| `electricity-management/lib/tenant-verification-format.ts` | **Create** — client-safe labels/badges/status colors |
| `electricity-management/lib/tenant-verification-workflow.ts` | **Create** — state transition validation |
| `electricity-management/components/admin/tenant-verification-toggle.tsx` | **Create** — enable/disable toggle card |
| `electricity-management/components/admin/sidebar-nav.tsx` | **Modify** — add Tenant Verification expandable group |
| `electricity-management/app/(admin)/layout.tsx` | **Modify** — fetch and pass `tenantVerificationEnabled` to sidebar |
| `electricity-management/app/layout.tsx` | **Modify** (if needed) — route namespace setup |

### Phase 3 — Data layer

| File | Action |
|------|--------|
| `electricity-management/prisma/schema.prisma` | **Modify** — add new models, enums, relation fields, `tenantVerificationEnabled` on SiteConfig |
| `electricity-management/prisma/migrations/2026XXXX_add_tenant_verification/migration.sql` | **Create** — migration SQL (additive only) |
| `electricity-management/prisma/seed-tenant-verification.ts` | **Create** — seed Permission rows (run only with approval, never against production indiscriminately) |

### Phase 4 — Auth and applicant identity

| File | Action |
|------|--------|
| `electricity-management/app/api/tenant-verification/auth/request-otp/route.ts` | **Create** — OTP request with rate limiting |
| `electricity-management/app/api/tenant-verification/auth/verify-otp/route.ts` | **Create** — OTP verify, identity mapping |

### Phase 5 — Tenant application

| File | Action |
|------|--------|
| `electricity-management/app/tenant-verification/page.tsx` | **Create** — landing/instructions |
| `electricity-management/app/tenant-verification/register/page.tsx` | **Create** — multi-step wizard |
| `electricity-management/app/tenant-verification/applications/page.tsx` | **Create** — my applications list |
| `electricity-management/app/tenant-verification/applications/[id]/page.tsx` | **Create** — application detail |
| `electricity-management/components/tenant-verification/application-wizard.tsx` | **Create** — 8-step form |
| `electricity-management/components/tenant-verification/document-upload.tsx` | **Create** — private document upload |
| `electricity-management/app/api/tenant-verification/applications/route.ts` | **Create** — list + create |
| `electricity-management/app/api/tenant-verification/applications/[id]/route.ts` | **Create** — get/update |
| `electricity-management/app/api/tenant-verification/applications/[id]/submit/route.ts` | **Create** — submit with validation |
| `electricity-management/app/api/tenant-verification/applications/[id]/family-members/route.ts` | **Create** — family CRUD |
| `electricity-management/app/api/tenant-verification/applications/[id]/documents/route.ts` | **Create** — document upload/list |
| `electricity-management/app/api/tenant-verification/applications/[id]/timeline/route.ts` | **Create** — status history |

### Phase 6 — Documents

| File | Action |
|------|--------|
| `electricity-management/app/api/tenant-verification/applications/[id]/documents/[docId]/route.ts` | **Create** — document download with auth |
| `electricity-management/lib/tenant-verification-document.ts` | **Create** — document service (upload validation, private storage) |

### Phase 7 — Owner workflow

| File | Action |
|------|--------|
| `electricity-management/app/owner/tenant-verification/page.tsx` | **Create** — owner dashboard |
| `electricity-management/app/owner/tenant-verification/applications/page.tsx` | **Create** — application list |
| `electricity-management/app/owner/tenant-verification/applications/[id]/page.tsx` | **Create** — application detail + decision |
| `electricity-management/app/api/owner/tenant-verification/applications/route.ts` | **Create** — list mapped flats |
| `electricity-management/app/api/owner/tenant-verification/applications/[id]/decision/route.ts` | **Create** — approve/reject |

### Phase 8 — Management workflow

| File | Action |
|------|--------|
| `electricity-management/app/(admin)/admin/tenant-verification/page.tsx` | **Create** — admin dashboard |
| `electricity-management/app/(admin)/admin/tenant-verification/applications/page.tsx` | **Create** — work queue |
| `electricity-management/app/(admin)/admin/tenant-verification/applications/[id]/page.tsx` | **Create** — application review |
| `electricity-management/components/tenant-verification/admin-review.tsx` | **Create** — document/police review, corrections |
| `electricity-management/app/api/admin/tenant-verification/dashboard/route.ts` | **Create** — aggregate counts |
| `electricity-management/app/api/admin/tenant-verification/applications/route.ts` | **Create** — search/filter/paginate |
| `electricity-management/app/api/admin/tenant-verification/applications/[id]/decision/route.ts` | **Create** — final approve/reject |
| `electricity-management/app/api/admin/tenant-verification/applications/[id]/corrections/route.ts` | **Create** — request corrections |
| `electricity-management/app/api/admin/tenant-verification/flats/route.ts` | **Create** — flat-owner mapping |
| `electricity-management/app/api/admin/tenant-verification/owners/route.ts` | **Create** — owner mapping |

### Phase 9 — Outputs and communications

| File | Action |
|------|--------|
| `electricity-management/lib/tenant-verification-pdf.ts` | **Create** — approved verification certificate PDF |
| `electricity-management/app/api/tenant-verification/applications/[id]/pdf/route.ts` | **Create** — PDF generation/download |
| `electricity-management/app/api/admin/tenant-verification/reports/route.ts` | **Create** — Excel export |
| `electricity-management/lib/tenant-verification-email.ts` | **Create** — email templates for workflow |
| `electricity-management/lib/tenant-verification-notifications.ts` | **Create** — notification service |

### Phase 10 — QA and security

- `npx tsc --noEmit` — passes
- `npm run build` — passes
- Unit/integration/e2e tests for authorization, workflow, validation, regression
- Accessibility review
- Upload and authorization tests

### Phase 11 — Preview acceptance

- Deploy to Vercel Preview only after approval
- Synthetic/test data only
- Validate roles and workflows

### Phase 12 — Production release (ONLY after explicit user approval)

- Database backup
- Approved migration applied
- Production deployment
- Smoke test

---

## ESTIMATED FILE CHANGES SUMMARY

| Category | Files |
|----------|-------|
| **New library files** | 7 (config, core, format, workflow, document, pdf, email/notifications) |
| **New API routes** | 15+ (auth, applications, family, documents, timeline, owner, admin, reports) |
| **New UI pages** | 9 (tenant: 4, owner: 3, admin: 2) |
| **New components** | 6+ (wizard, document-upload, list, detail, owner-decision, admin-review, toggle) |
| **Modified existing** | 4 (schema.prisma, sidebar-nav.tsx, admin layout.tsx, root layout.tsx) |
| **New migration** | 1 (additive only) |
| **New seed** | 1 (seed-tenant-verification.ts) |

**Total:** ~40+ new files, 4 modified existing files, 1 migration

---

## NEXT STEP

**PHASE 0 IS COMPLETE.** This assessment report is the deliverable.

Per the specification: **"After the assessment, STOP and wait for explicit user approval. Do not begin Phase 1 or implementation until approval is given."**

Please confirm:
1. Do you approve proceeding to Phase 1 (Design approval)?
2. Any changes to the proposed route structure, model design, or workflow?
3. Which decisions from Section 3 (Gaps and Decisions Needed) should I prioritize for management confirmation?

Once approved, I will proceed with Phase 1 design documentation and then Phase 2 foundation code — always running `npx tsc --noEmit` and `npm run build` before requesting further approval.
