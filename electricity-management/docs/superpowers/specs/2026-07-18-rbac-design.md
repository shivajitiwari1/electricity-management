# Role-Based Access Control — Design Spec
**Date:** 2026-07-18  
**Project:** Oasis Venetia Heights — Electricity Management  
**Status:** Approved

---

## 1. Overview

Extend the existing 2-role system (ADMIN, RESIDENT) to 3 roles (ADMIN, MANAGER, RESIDENT/Customer) with a database-driven permission system. Admin can assign read/write/delete permissions per page to the Manager role from a UI. Only Admin can manage permissions.

---

## 2. Roles

| Role | Description |
|------|-------------|
| `ADMIN` | Full access to all pages and actions. Can manage users and permissions. |
| `MANAGER` | Limited operator. Access controlled by Admin via permission matrix. No Resident record. |
| `RESIDENT` | Customer. Accesses their own data via `/resident/*` portal only. Unchanged. |

Manager users are plain `User` rows with `role = MANAGER`. They do not have a linked `Resident` record (already optional in schema).

---

## 3. Data Model Changes

### 3.1 Prisma Schema

**Role enum** — add `MANAGER`:
```prisma
enum Role {
  ADMIN
  MANAGER
  RESIDENT
}
```

**User model** — add `isActive` flag for soft-disable of Manager accounts:
```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String
  role      Role
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  resident  Resident?
  auditLogs AuditLog[]
}
```

**New Permission model:**
```prisma
model Permission {
  id        String   @id @default(cuid())
  role      Role
  page      String
  canRead   Boolean  @default(false)
  canWrite  Boolean  @default(false)
  canDelete Boolean  @default(false)
  updatedAt DateTime @updatedAt

  @@unique([role, page])
}
```

### 3.2 Permission Pages (identifiers)

| Identifier | Admin Page |
|------------|-----------|
| `dashboard` | /admin/dashboard |
| `residents` | /admin/residents |
| `connections` | /admin/connections |
| `meter-readings` | /admin/meter-readings |
| `bills` | /admin/bills |
| `payments` | /admin/payments |
| `reports` | /admin/reports |
| `rates` | /admin/rates |
| `flat-info` | /admin/flats |
| `users` | /admin/users |
| `permissions` | /admin/permissions |

### 3.3 Default Permission Seed

**ADMIN:** All pages — canRead: true, canWrite: true, canDelete: true (seeded but locked in UI).

**MANAGER defaults:**

| Page | Read | Write | Delete |
|------|------|-------|--------|
| dashboard | ✅ | — | — |
| residents | ✅ | ❌ | ❌ |
| connections | ✅ | ❌ | ❌ |
| meter-readings | ✅ | ✅ | ❌ |
| bills | ✅ | ❌ | ❌ |
| payments | ✅ | ✅ | ❌ |
| reports | ✅ | — | — |
| rates | ❌ | ❌ | ❌ |
| flat-info | ❌ | ❌ | ❌ |
| users | ❌ | ❌ | ❌ |
| permissions | ❌ | ❌ | ❌ |

`—` = not applicable (e.g. Dashboard has no write/delete concept; these are always false and not shown as checkboxes).

**RESIDENT:** No entries needed — Customer accesses `/resident/*` which has its own auth logic.

---

## 4. Permission Enforcement (3 Layers)

### Layer 1 — Middleware (route-level access)

`middleware.ts` updated to:
- Allow `MANAGER` into `/admin/*` (currently blocked entirely)
- Redirect MANAGER to `/admin/dashboard` on login
- Block MANAGER from `/admin/users` and `/admin/permissions` (Admin-only pages — hard-coded, not DB-driven, for security)
- RESIDENT access to `/resident/*` unchanged

Middleware does **not** check write/delete — only "is this role allowed in the admin area."

### Layer 2 — API routes (mutation guard)

A `checkPermission(session, page, action)` helper in `lib/permissions.ts`:
- Loads permissions from `unstable_cache` with tag `"permissions"` and 30s TTL
- Returns 403 `{ error: "Forbidden" }` if permission denied
- Called at the top of each mutation handler

API coverage:

| Route | Method | Permission checked |
|-------|--------|--------------------|
| `/api/residents` | POST | residents.canWrite |
| `/api/residents/[id]` | PUT | residents.canWrite |
| `/api/residents/[id]` | DELETE | residents.canDelete |
| `/api/connections/[id]` | PUT | connections.canWrite |
| `/api/connections/[id]` | DELETE | connections.canDelete |
| `/api/meter-readings` | POST | meter-readings.canWrite |
| `/api/meter-readings/[id]` | DELETE | meter-readings.canDelete |
| `/api/bills` | POST | bills.canWrite |
| `/api/bills/[id]` | PUT | bills.canWrite |
| `/api/bills/[id]` | DELETE | bills.canDelete |
| `/api/payments/cash` | POST | payments.canWrite |
| `/api/payments/[id]` | DELETE | payments.canDelete |
| `/api/rates` | POST | rates.canWrite |
| `/api/rates/[id]` | PUT | rates.canWrite |
| `/api/rates/[id]` | DELETE | rates.canDelete |
| `/api/flat-info` | POST | flat-info.canWrite |
| `/api/flat-info/[id]` | PUT | flat-info.canWrite |
| `/api/flat-info/[id]` | DELETE | flat-info.canDelete |
| `/api/users` | POST/PUT/DELETE | Admin only (hard-coded) |
| `/api/permissions` | PUT | Admin only (hard-coded) |

ADMIN always passes all checks (short-circuit: if `role === "ADMIN"` return allowed).

### Layer 3 — UI (sidebar & buttons)

Session JWT includes a `permissions` map fetched at login:
```ts
type PermissionsMap = Record<string, { canRead: boolean; canWrite: boolean; canDelete: boolean }>
```

- Sidebar hides nav items where `canRead === false`
- Add/Edit/Delete action buttons hidden if `canWrite`/`canDelete` is false
- `/admin/users` and `/admin/permissions` links only visible to ADMIN

---

## 5. New Pages

### `/admin/users` — User Management (Admin only)

Lists all `MANAGER` accounts. Columns: Name, Email, Status (Active/Inactive), Created, Actions.

Admin actions:
- **Add Manager** — form: Name, Email, Temporary Password, Phone. Creates `User { role: MANAGER }`. Sends welcome email via existing `sendEmail`.
- **Edit** — update name, email, phone
- **Deactivate / Reactivate** — toggles `isActive`. Deactivated managers are rejected at login.
- **Delete** — hard delete. Blocked if user has AuditLog entries (prevents orphaned logs).

### `/admin/permissions` — Permission Matrix (Admin only)

Visual checkbox grid. Rows = pages, columns = Read / Write / Delete for Manager role.

- ADMIN row shown as read-only (always all checked, not editable)
- CUSTOMER row shown as read-only (portal access, not configurable here)
- Only MANAGER row has interactive checkboxes
- Save button POSTs updated matrix to `/api/permissions`
- On save: `revalidateTag("permissions")` clears permission cache immediately

---

## 6. Auth Changes

### `auth.ts` — authorize() fetches permissions and blocks inactive users

`auth.config.ts` runs in the Edge runtime (middleware) and cannot use Prisma. All DB access happens in `auth.ts` (Node runtime) inside `authorize()`:

```ts
async authorize(credentials) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return null;          // block inactive
  const valid = await bcryptjs.compare(password, user.password);
  if (!valid) return null;

  let permissions = {};
  if (user.role === "MANAGER") {
    const rows = await prisma.permission.findMany({ where: { role: "MANAGER" } });
    permissions = Object.fromEntries(
      rows.map(r => [r.page, { canRead: r.canRead, canWrite: r.canWrite, canDelete: r.canDelete }])
    );
  }

  return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, permissions };
}
```

The returned object flows into `jwt({ token, user })` in `auth.config.ts`. The JWT callback must be updated to propagate the new fields:

```ts
jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.role = (user as any).role;
    token.isActive = (user as any).isActive;
    token.permissions = (user as any).permissions ?? {};
  }
  return token;
},
session({ session, token }) {
  if (session.user) {
    session.user.id = token.id as string;
    (session.user as any).role = token.role;
    (session.user as any).isActive = token.isActive;
    (session.user as any).permissions = token.permissions;
  }
  return session;
},
```

Permissions are embedded at login. If Admin changes Manager's permissions, the Manager must re-login to pick up the new set (JWT refresh on next sign-in). This is the correct trade-off — no per-request DB lookup on the session.

---

## 7. New API Routes

### `GET/POST /api/users`
- GET: list all MANAGER users
- POST: create new Manager user

### `GET/PUT /api/users/[id]`
- GET: single user detail
- PUT: update name/email/phone/isActive
- DELETE: hard delete (blocked if has audit logs)

### `GET /api/permissions`
- Returns current permission matrix for all roles

### `PUT /api/permissions`
- Updates MANAGER permission rows
- Calls `revalidateTag("permissions", {})`
- Admin only

---

## 8. Sidebar Navigation Update

New items added to sidebar (Admin-only):
- **Users** — `/admin/users`
- **Permissions** — `/admin/permissions`

Existing items conditionally rendered based on `session.user.permissions[page].canRead`.

---

## 9. Scope Boundaries

**In scope:**
- MANAGER role with DB-driven permissions
- Admin UI to manage Manager accounts and permissions
- Enforcement at middleware + API + UI layers
- `isActive` flag for Manager soft-disable

**Out of scope:**
- Per-user permissions (only per-role)
- RESIDENT portal changes (unchanged)
- Two-factor authentication
- Audit log page (AuditLog model exists, no UI planned here)
- Per-tower/floor data scoping for Manager
