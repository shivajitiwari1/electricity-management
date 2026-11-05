# TENANT VERIFICATION PORTAL — PHASE 1 DESIGN DOCUMENT

**Repository:** Oasis Venetia Heights (Electricity Bill)  
**Specification:** `Tenant_Verification_Agent_Implementation_Specification_v2 (1).docx`  
**Assessment:** `TENANT_VERIFICATION_IMPLEMENTATION_ASSESSMENT.md` (Phase 0 — complete)  
**Phase:** 1 — Design Approval (documentation only, no source code changes)  
**Date:** Thu Nov 05 2026  

---

## GATE: USER APPROVAL REQUIRED

Per specification Section 15: **"User reviews and approves design. No migration or provider setup before approval."**

This document proposes the complete design. No files are modified, no migrations created, no dependencies installed. Approve this design before Phase 2 begins.

---

## 1. ROUTE TREE (isolated module namespaces)

Per spec Section 13, routes organized under dedicated namespaces without creating a parallel Next.js app:

### Tenant / Applicant portal (resident-facing)

| Route | Purpose | Auth | Page ID |
|-------|---------|------|---------|
| `/tenant-verification/` | Landing/instructions — who should apply, required documents, process, privacy notice, Start Application action | Public | — |
| `/tenant-verification/register` | 8-step wizard (flat→tenant→family→ID→vehicle→emergency→documents→declaration) | OTP-verified session | `tenant-verification` |
| `/tenant-verification/applications` | My applications / tracking — number, flat, date, status, timeline, corrections, approved PDF download | Tenant session | `tenant-verification` |
| `/tenant-verification/applications/[id]` | Application detail — read-only summary, correction requests, resubmit | Tenant session + ownership | `tenant-verification` |

### Property Owner portal

| Route | Purpose | Auth | Page ID |
|-------|---------|------|---------|
| `/owner/tenant-verification/` | Owner dashboard — summary counts for pending/approved/rejected limited to mapped flats | Existing login + owner-flat mapping | `owner-tenant-verification` |
| `/owner/tenant-verification/applications` | Application list — search/filter by application number, flat, tenant, status; pagination | Owner role + mapping check | `owner-tenant-verification` |
| `/owner/tenant-verification/applications/[id]` | Application detail — permitted tenant/tenancy/family/police/document info, document preview, approve/reject | Owner role + mapping check | `owner-tenant-verification` |

### Management Admin portal

| Route | Purpose | Auth | Page ID |
|-------|---------|------|---------|
| `/admin/tenant-verification/` | Admin dashboard — counts for submitted/owner pending/management pending/correction requested/approved/rejected | ADMIN/MANAGER + `tenant-verification` canRead | `tenant-verification` |
| `/admin/tenant-verification/applications` | Work queue — search/filter/paginate by application number, tower, flat, tenant, owner, date, police status, workflow status | ADMIN/MANAGER + `tenant-verification` canRead | `tenant-verification` |
| `/admin/tenant-verification/applications/[id]` | Application review — full permitted application, family, documents, consent, approval history | ADMIN/MANAGER + `tenant-verification` canRead | `tenant-verification` |
| `/admin/tenant-verification/flats` | Flat-owner mapping management | ADMIN/MANAGER + `tenant-verification` canWrite | `tenant-verification` |
| `/admin/tenant-verification/owners` | Owner mapping management | ADMIN/MANAGER + `tenant-verification` canWrite | `tenant-verification` |
| `/admin/tenant-verification/reports` | Excel/PDF reports | ADMIN/MANAGER + `tenant-verification` canRead | `tenant-verification` |

### API routes (all server-guarded, following Help Desk pattern)

| Route | Method | Guard |
|-------|--------|-------|
| `/api/tenant-verification/auth/request-otp` | POST | Public (rate-limited) |
| `/api/tenant-verification/auth/verify-otp` | POST | Public (rate-limited) |
| `/api/tenant-verification/applications` | GET/POST | Tenant session |
| `/api/tenant-verification/applications/[id]` | GET/PATCH | Tenant session + ownership |
| `/api/tenant-verification/applications/[id]/submit` | POST | Tenant session + ownership |
| `/api/tenant-verification/applications/[id]/family-members` | POST/PATCH/DELETE | Tenant session + ownership |
| `/api/tenant-verification/applications/[id]/documents` | POST/GET | Tenant session + ownership |
| `/api/tenant-verification/applications/[id]/documents/[docId]` | GET | Tenant session + ownership |
| `/api/tenant-verification/applications/[id]/timeline` | GET | Tenant session + ownership |
| `/api/tenant-verification/applications/[id]/pdf` | GET | Auth + access check |
| `/api/owner/tenant-verification/applications` | GET | Owner role + mapping check |
| `/api/owner/tenant-verification/applications/[id]/decision` | POST | Owner role + mapping check |
| `/api/admin/tenant-verification/dashboard` | GET | ADMIN/MANAGER + canRead |
| `/api/admin/tenant-verification/applications` | GET | ADMIN/MANAGER + canRead |
| `/api/admin/tenant-verification/applications/[id]/decision` | POST | ADMIN/MANAGER + canWrite |
| `/api/admin/tenant-verification/applications/[id]/corrections` | POST | ADMIN/MANAGER + canWrite |
| `/api/admin/tenant-verification/flats` | GET/POST/PATCH | ADMIN/MANAGER + canWrite |
| `/api/admin/tenant-verification/owners` | GET/POST/PATCH | ADMIN/MANAGER + canWrite |
| `/api/admin/tenant-verification/reports` | GET | ADMIN/MANAGER + canRead |

### UI pages requiring `tenantVerificationEnabled` module toggle

Following the Help Desk pattern (`guardHelpDeskEnabled()` → 503), all new pages and mutating API routes check `tenantVerificationEnabled` from `SiteConfig`. When disabled:
- Sidebar group hidden (except super admin)
- API routes return 503
- Pages redirect to dashboard

---

## 2. PERMISSIONS MATRIX

Per spec Section 3 (User roles and access boundaries). Added to existing `Permission` model (page + role + canRead/canWrite/canDelete).

| Page ID | Role | canRead | canWrite | canDelete |
|---------|------|---------|----------|-----------|
| `tenant-verification` | ADMIN | ✅ | ✅ | ✅ |
| `tenant-verification` | MANAGER | ✅ | ✅ | ❌ |
| `owner-tenant-verification` | ADMIN | ✅ | ✅ | ✅ |
| `owner-tenant-verification` | MANAGER | ✅ | ✅ | ❌ |
| `owner-tenant-verification` | RESIDENT | ✅ (own flats only) | ❌ | ❌ |

### Authorization rules (enforced server-side on every route)

| Actor | Can create application | Can view own application | Can view all applications | Can approve/reject (owner) | Can approve/reject (management) | Can upload documents |
|-------|----------------------|------------------------|-------------------------|--------------------------|-------------------------------|---------------------|
| Tenant (OTP session) | Yes (own flat) | Yes (own) | No | No | No | Yes (own docs) |
| Property Owner | No | Yes (mapped flats) | No | Yes (mapped flats) | No | No |
| MANAGER (canRead) | No | Yes | Yes (if canRead) | No | No | No |
| MANAGER (canWrite) | No | Yes | Yes | No | Yes | No |
| ADMIN | Yes | Yes | Yes | Yes | Yes | Yes |

### Owner-flat mapping authorization

Every owner/management API call must verify server-side that:
- The authenticated user is mapped to the flat via `Connection` → `Resident` → `User` (or new `TenantFlatOwnerMapping` if approved)
- No cross-owner data leakage
- Frontend-supplied flat IDs are never trusted

---

## 3. SCHEMA DIAGRAM (PRISMA MODELS)

Additive only — no existing tables modified. Following repository conventions (`cuid()` IDs, `@db.MediumBlob` for bytes, `Decimal` for money).

### New models

```
TenantApplication
├── id                String @id @default(cuid())
├── applicationNumber String @unique
├── applicantPhone    String          // OTP-verified mobile
├── applicantUserId   String?         // links to User if tenant has account
├── flatId            String          // references Connection.id
├── ownerReference    String?         // owner userId from flat mapping
├── status            TenantApplicationStatus @default(DRAFT)
├── tower             String          // denormalized for search
├── flatNo            String          // denormalized for search
├── moveInDate        DateTime?
├── tenancyFrom       DateTime?
├── tenancyTo         DateTime?
├── permanentAddress  String?         // multiline
├── fullName          String          // as per ID
├── fatherSpouseName  String?
├── dateOfBirth       DateTime?
├── mobileNumber      String          // same as applicantPhone
├── alternateMobile   String?
├── email             String?
├── occupation        String?
├── employer          String?
├── officeAddress     String?
├── nationality       String?
├── maritalStatus     String?
├── idProofType       VerificationIdType? // AADHAAR/PASSPORT/VOTER_ID/DRIVING_LICENCE/OTHER
├── idProofLast4      String?         // last 4 digits preferred
├── policeStatus      PoliceStatus?   // COMPLETED/APPLIED_IN_PROCESS/NOT_YET_APPLIED
├── policeRefNumber   String?         // conditional on status
├── policeRefDate     DateTime?       // conditional on status
├── previousAddress   String?         // multiline
├── emergencyContactName String?
├── emergencyContactRelation String?
├── emergencyContactMobile String?
├── consentVersion    String?
├── consentAcceptedAt DateTime?
├── submittedAt       DateTime?
├── createdAt         DateTime @default(now())
├── updatedAt         DateTime @updatedAt
├── @@index([status])
├── @@index([applicationNumber])
├── @@index([flatId])
├── @@index([applicantPhone])
```

```
TenantFamilyMember
├── id                String @id @default(cuid())
├── applicationId     String
├── application       TenantApplication @relation(...)
├── fullName          String
├── relationship      String
├── age               Int?
├── mobileNo          String?
├── createdAt         DateTime @default(now())
├── @@index([applicationId])
```

```
TenantVehicle
├── id                String @id @default(cuid())
├── applicationId     String
├── application       TenantApplication @relation(...)
├── vehicleType       String?
├── registrationNo    String?
├── stickerRfidNo     String?
├── createdAt         DateTime @default(now())
├── @@index([applicationId])
```

```
TenantDocument
├── id                String @id @default(cuid())
├── applicationId     String
├── application       TenantApplication @relation(..., onDelete: Cascade)
├── category          VerificationDocumentType  // ID_PROOF/ADDRESS_PROOF/RENT_AGREEMENT/NOC/PHOTO/POLICE_PROOF/VEHICLE_RC/OTHER
├── storageKey        String          // server-generated, not client filename
├── originalFileName  String
├── mimeType          String
├── sizeBytes         Int
├── checksum          String?         // SHA-256 of content
├── uploadedBy        String?
├── reviewStatus      DocumentReviewStatus @default(PENDING)  // PENDING/VERIFIED/REJECTED/NEEDS_REPLACEMENT
├── reviewer          String?         // userId
├── reviewedAt        DateTime?
├── reviewerRemarks   String?
├── createdAt         DateTime @default(now())
├── @@index([applicationId])
```

```
TenantVehicle — (see above)
```

```
TenantApprovalHistory
├── id                String @id @default(cuid())
├── applicationId     String
├── application       TenantApplication @relation(..., onDelete: Cascade)
├── stage             String          // DRAFT/SUBMITTED/OWNER_PENDING/etc.
├── action            String          // SUBMIT/APPROVE/REJECT/REQUEST_CORRECTION/RESUBMIT/WITHDRAW
├── previousStatus    TenantApplicationStatus?
├── nextStatus        TenantApplicationStatus?
├── actorUserId       String?
├── actorRole         String?
├── remarks           String?         // tenant-visible only; internal remarks separate
├── createdAt         DateTime @default(now())
├── @@index([applicationId])
├── @@index([createdAt])
```

```
TenantNotificationLog
├── id                String @id @default(cuid())
├── applicationId     String
├── channel           String          // EMAIL/WHATSAPP/IN_APP
├── template          String
├── recipientReference String?        // masked phone/email
├── status            String          // SENT/FAILED/PENDING
├── providerMessageId String?
├── attemptCount      Int @default(0)
├── errorCode         String?         // safe to retain, no secrets
├── createdAt         DateTime @default(now())
```

```
TenantFlatOwnerMapping (only if approved — see gaps)
├── id                String @id @default(cuid())
├── flatId            String          // references Connection.id
├── ownerUserId       String          // references User.id
├── active            Boolean @default(true)
├── effectiveFrom     DateTime?
├── effectiveTo       DateTime?
├── createdBy         String?
├── createdAt         DateTime @default(now())
├── @@unique([flatId, ownerUserId])  // prevent duplicate active mappings
```

### New enums

```
enum TenantApplicationStatus {
  DRAFT
  SUBMITTED
  OWNER_PENDING
  MANAGEMENT_PENDING
  CHANGES_REQUESTED
  APPROVED
  REJECTED
  WITHDRAWN
}

enum VerificationIdType {
  AADHAAR
  PASSPORT
  VOTER_ID
  DRIVING_LICENCE
  OTHER
}

enum PoliceStatus {
  COMPLETED
  APPLIED_IN_PROCESS
  NOT_YET_APPLIED
}

enum VerificationDocumentType {
  ID_PROOF
  ADDRESS_PROOF
  RENT_AGREEMENT
  POLICE_PROOF
  PHOTO
  VEHICLE_RC
  OTHER
}

enum DocumentReviewStatus {
  PENDING
  VERIFIED
  REJECTED
  NEEDS_REPLACEMENT
}
```

### SiteConfig modification

```
model SiteConfig {
  id                        String  @id @default("singleton")
  maintenanceMode           Boolean @default(false)
  maintenanceBillingEnabled Boolean @default(false)
  helpDeskEnabled           Boolean @default(false)
  tenantVerificationEnabled Boolean @default(false)  // NEW
  cgstRate                  Decimal @default(9) @db.Decimal(5, 2)
  sgstRate                  Decimal @default(9) @db.Decimal(5, 2)
}
```

### Permission page ids (new rows, no schema change)

| page | role | canRead | canWrite | canDelete |
|------|------|---------|----------|-----------|
| `tenant-verification` | ADMIN | true | true | true |
| `tenant-verification` | MANAGER | true | true | false |
| `owner-tenant-verification` | ADMIN | true | true | true |
| `owner-tenant-verification` | MANAGER | true | true | false |
| `owner-tenant-verification` | RESIDENT | true (own flats) | false | false |

---

## 4. STATUS TRANSITION MATRIX

Per spec Section 6. Preserves clear distinction between owner approval and final management approval.

| Current State | Actor/Action | Next State | Rules |
|--------------|-------------|-----------|-------|
| DRAFT | Tenant submits | SUBMITTED → OWNER_PENDING | All required fields, documents, consent validated; duplicate submission guarded |
| OWNER_PENDING | Mapped owner approves | MANAGEMENT_PENDING | Only owner mapped to that flat; record decision and remarks/history |
| OWNER_PENDING | Mapped owner rejects | REJECTED | Require reason; notify tenant and management; cannot proceed |
| MANAGEMENT_PENDING | Authorized admin requests corrections | CHANGES_REQUESTED | Specify fields/documents + instructions; notify tenant |
| CHANGES_REQUESTED | Tenant resubmits | MANAGEMENT_PENDING | Validate updated data; preserve prior values + full history |
| MANAGEMENT_PENDING | Authorized admin approves | APPROVED | Final approval only; transactional (decision + history + PDF trigger + notifications) |
| MANAGEMENT_PENDING | Authorized admin rejects | REJECTED | Require reason; record final decision; notify parties |
| DRAFT / SUBMITTED | Tenant withdraws (if policy permits) | WITHDRAWN | Only if permitted by policy and before restricted stage; audit action |

### Transactional boundaries

- **Submit:** application number assignment + status change + history record + notification trigger (all in one Prisma transaction)
- **Owner approve/reject:** status change + history + notification (transactional)
- **Admin approve/reject:** status change + history + PDF generation trigger + notification (transactional)
- **Correction request:** status change + correction details + history + notification (transactional)
- **Resubmit:** field updates + status change + history preservation (transactional)

---

## 5. STORAGE APPROACH

### Decision required from management

The specification (Section 8) states:

> "Inspect existing Help Desk attachment storage (including MEDIUMBLOB use) but do not assume it is suitable for identity documents or larger files. Prefer an approved private object-storage solution if already available. If none exists, propose options and wait for approval before selecting/adding a provider."

### Current state

- Help Desk `TicketAttachment.data` stored as `Bytes @db.MediumBlob` (5 MB limit)
- File upload via multipart FormData, image-only allowlist, magic-byte validation
- Download via `GET /api/help-desk/attachments/[id]` with `private, no-store` headers and ownership checks

### Options for management approval

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **A. MEDIUMBLOB (existing)** | No new service, no new env vars, single DB transaction, proven pattern | 5 MB limit per file, TiDB storage cost, backups include binaries | Acceptable for MVP if files < 5 MB |
| **B. Vercel Blob** | Integrated with Vercel, signed URLs, separate env var | New service, new secret, separate backup strategy | Good if files > 5 MB |
| **C. AWS S3** | Industry standard, scalable | New AWS credentials, new SDK, separate bucket policy | Overkill for MVP |

**Proposed default:** Option A (MEDIUMBLOB) for MVP, matching Help Desk pattern. Upgrade to Option B if file size exceeds 5 MB or management prefers external storage.

### Security controls (regardless of option)

- Storage keys generated server-side (never trust client filenames)
- File validation: extension + MIME type + file signature (magic bytes)
- Size limit: configurable (default 5 MB, matching Help Desk)
- Reject executable/unexpected formats
- Download via authenticated endpoint only (no public URLs)
- Access restricted to: applicant, mapped owner for their flat, authorized management staff
- No document contents, ID numbers, or signed URLs in logs/analytics/error traces/notifications

---

## 6. OTP PROVIDER

### Decision required from management

No OTP infrastructure exists in the repository. Need:
- SMS provider (Twilio, MSG91, AWS SNS, etc.)
- Sender ID / template registration (India DLT requirements for WhatsApp/SMS)
- Provider account owner and credentials storage

### Proposed implementation (provider-agnostic until approved)

```
lib/tenant-verification-otp.ts
├── requestOtp(phone) → generates OTP, stores with expiry (10 min), rate-limit (3 per hour), sends via provider
├── verifyOtp(phone, otp) → checks expiry, attempt count (max 5), marks verified, returns identity token
├── resendOtp(phone) → cooldown (60 seconds between resends)
```

### Security controls

- OTP never logged
- OTP expiry: 10 minutes
- Attempt limit: 5 incorrect attempts → lockout
- Resend cooldown: 60 seconds
- Rate limit: 3 OTP requests per phone per hour
- Phone enumeration protection: generic error messages ("OTP sent if phone exists")

---

## 7. MIGRATION PLAN

### Migration strategy (additive only)

1. Create `prisma/migrations/2026XXXX_add_tenant_verification/migration.sql`
2. Test on local/staging copy of TiDB
3. Take production backup before applying
4. Apply with `npx prisma migrate deploy`
5. Seed Permission rows (run only with approval)

### Migration contents (additive)

- 6 new tables (TenantApplication, TenantDocument, TenantFamilyMember, TenantVehicle, TenantApprovalHistory, TenantNotificationLog)
- Optional: TenantFlatOwnerMapping (only if approved)
- 1 new column: `SiteConfig.tenantVerificationEnabled` (Boolean, DEFAULT false)
- 4 new enums
- Indexes on status, applicationNumber, flatId, applicantPhone, createdAt
- Foreign keys with ON DELETE CASCADE for child records
- ON DELETE SET NULL for optional parent references

### Rollback plan

- Migration is additive → rollback = drop new tables and column
- Before production: take TiDB Cloud backup
- If issues: drop new tables, remove column, redeploy previous code

---

## 8. SECURITY SUMMARY

| Control | Implementation |
|---------|---------------|
| Authentication | Existing NextAuth for Owner/Admin; OTP-based for Tenant applicants |
| Authorization | `guardPermission()` on all API routes; ownership re-check for tenant endpoints; owner-flat mapping check for owner endpoints |
| Input validation | Zod schemas on all API routes (types, lengths, enums, dates, cross-field) |
| File upload | 5 MB limit, MIME/signature allowlist, server-generated storage keys |
| SQL injection | Prisma parameterized queries |
| Audit trail | `TenantApprovalHistory` + existing `AuditLog` model |
| Public tracking | No public tracking tokens (spec doesn't require) — all access requires auth |
| Secrets | Env vars only (SMTP, OTP provider); never in repo |
| Error handling | Generic error messages to client; full errors logged server-side only |

---

## 9. TENANT FORM WIZARD (8 STEPS — per spec Section 18.3)

| Step | Fields | Mandatory? |
|------|--------|------------|
| 1. Flat & Tenancy | Tower, Flat No. (selector), Owner Name/Contact (auto-filled from mapping), Move-in Date, Tenancy From/To, Permanent Address | Yes (flat selection + dates) |
| 2. Primary Occupant | Full Name, Father's/Spouse's Name, DOB, Mobile, Alternate Mobile, Email, Occupation, Employer, Office Address, Nationality, Marital Status | Yes (name, mobile, email format) |
| 3. Family Members | Name, Relationship, Age, Mobile (repeatable, min 0, max 4+) | Conditional |
| 4. ID & Police | ID Type, ID Last 4 Digits, Police Status, Police Ref/Date (conditional), Previous Address | Yes (ID type + last 4) |
| 5. Vehicles | Vehicle Type, Registration No., Sticker/RFID (repeatable, max 3) | Conditional (zero allowed) |
| 6. Emergency Contact | Name, Relationship, Mobile | Yes |
| 7. Documents | ID proof, photo, police proof, rent agreement, family ID (conditional), vehicle RC (conditional) | Conditional per category |
| 8. Declaration & Review | Declaration text, tenant acceptance/signature, date, full summary, submit | Yes (explicit acceptance) |

### Decisions requiring management confirmation

- Which fields are mandatory vs optional
- Police verification: mandatory before management approval?
- Electronic signature legal method
- File size/type limits
- Retention period
- PDF content and signatory

---

## NEXT STEP

Please review this design document and provide:

1. **Approve the design?** (route tree, permissions, models, workflow, storage, OTP approach)
2. **Storage decision:** MEDIUMBLOB (existing, 5 MB limit) vs external storage (Vercel Blob/S3)?
3. **OTP provider:** Any preferred provider, or should I document options for management selection?
4. **Owner-flat mapping:** Can existing `Connection` model serve as owner mapping, or create `TenantFlatOwnerMapping`?
5. **Mandatory fields:** Which spec Section 18 fields are mandatory vs optional?

**No code will be written, no migration created, nothing deployed until you approve this design.**
