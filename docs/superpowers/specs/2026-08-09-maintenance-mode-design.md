# Maintenance Mode — Design Spec

**Date:** 2026-08-09
**Project:** Oasis Venetia Heights — Electricity Management

---

## Overview

Admin can toggle the site into maintenance mode from the dashboard. When active, all non-admin users (residents, public visitors) are redirected to a maintenance page with an animated GIF. Admins and managers are never blocked.

---

## Data Layer

**New Prisma model: `SiteConfig`**

```prisma
model SiteConfig {
  id              String  @id @default("singleton")
  maintenanceMode Boolean @default(false)
}
```

Single-row table — always one record with `id = "singleton"`. Seeded on first use via upsert in the API route (no separate seed script needed).

---

## API Routes

### `GET /api/site/status` — Public, no auth

Returns current maintenance state. Called by middleware.

```json
{ "maintenanceMode": false }
```

Reads via `unstable_cache` with 10-second TTL and tag `"site-config"`. Fast; avoids DB hit on every request.

### `POST /api/admin/maintenance` — ADMIN only

Toggles `maintenanceMode` in the `SiteConfig` table, calls `revalidateTag("site-config")`, returns new state.

```json
{ "maintenanceMode": true }
```

Returns 401 if unauthenticated, 403 if non-ADMIN role.

---

## Middleware

File: `electricity-management/middleware.ts` (already exists — small addition)

**Logic added at the top of the auth handler:**

1. If path is `/maintenance` or `/api/site/status` — always allow through (no loop).
2. If user role is `ADMIN` or `MANAGER` — always allow through.
3. Otherwise: check maintenance status via module-level cache (10s TTL). If `maintenanceMode = true`, redirect to `/maintenance`.

**Module-level cache** (avoids a fetch on every request):
```ts
let cachedMaintenance: { value: boolean; expiresAt: number } | null = null;

async function isMaintenanceMode(baseUrl: string): Promise<boolean> {
  const now = Date.now();
  if (cachedMaintenance && now < cachedMaintenance.expiresAt) {
    return cachedMaintenance.value;
  }
  const res = await fetch(`${baseUrl}/api/site/status`);
  const data = await res.json();
  cachedMaintenance = { value: data.maintenanceMode, expiresAt: now + 10_000 };
  return data.maintenanceMode;
}
```

---

## `/maintenance` Page

File: `electricity-management/app/maintenance/page.tsx`

Public page — no auth required, not in the middleware matcher.

**Layout:**
- Centered card on a light gray background
- Animated GIF: a friendly "under construction / gears" animation hosted on Giphy CDN (no dependency)
- Heading: **"Under Maintenance"**
- Subtext: **"We're making improvements to Oasis Venetia Heights. Please check back soon."**
- Footer note: **"For urgent queries, contact the society office."**
- Oasis Venetia Heights branding (name + lightning bolt icon from sidebar)

GIF source: `https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif` (gears spinning, clean, appropriate)

---

## Dashboard Toggle

File: `electricity-management/app/(admin)/admin/dashboard/page.tsx`

**Placement:** New row below the quick-action buttons, visible to ADMIN role only.

**Component:** `MaintenanceToggle` — small client component that:
- Fetches current status on mount from `/api/admin/maintenance` (GET, same endpoint)
- Renders a toggle switch with label "Site Maintenance Mode"
- Red badge when ON ("SITE IS DOWN"), green badge when OFF ("SITE LIVE")
- On toggle: calls `POST /api/admin/maintenance`, updates local state
- Shows a loading spinner during the API call
- Shows confirmation toast on success

**GET on `/api/admin/maintenance`** returns `{ maintenanceMode: boolean }` — reuses same endpoint.

---

## Files Changed

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `SiteConfig` model |
| `prisma/migrations/` | New migration for SiteConfig |
| `app/api/site/status/route.ts` | New — public GET returns maintenance flag |
| `app/api/admin/maintenance/route.ts` | New — ADMIN GET/POST toggle |
| `app/maintenance/page.tsx` | New — public maintenance page with GIF |
| `components/admin/maintenance-toggle.tsx` | New — dashboard toggle client component |
| `app/(admin)/admin/dashboard/page.tsx` | Add MaintenanceToggle (admin only) |
| `middleware.ts` | Add maintenance check + module-level cache |
| `lib/server-cache.ts` | Add `getCachedSiteConfig` helper |

---

## Out of Scope

- Custom maintenance message editable by admin
- Scheduled maintenance windows
- Per-route maintenance (all-or-nothing)
- Email notification to residents when maintenance ends
