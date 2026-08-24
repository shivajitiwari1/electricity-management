# Multi-Resident Support (Connection ↔ Resident) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Isolation:** This repo has uncommitted work in progress in its main
> working tree (unrelated billing/payments files). Before starting Task 1,
> use the superpowers:using-git-worktrees skill to create an isolated
> worktree for this repo off the current `main` branch, and do all work
> for this plan inside that worktree. Do not touch the dirty main working
> tree.

**Goal:** Let a flat (Connection) have more than one linked Resident
(owner + tenant/family), so the Help Desk app's ticket-creation wizard can
offer a resident picker per flat, without changing any existing
billing/connection behavior.

**Architecture:** One additive Prisma model (`ConnectionResident`, a join
table with a relation type) plus back-relations on `Connection` and
`Resident`. Three new API routes under `/api/connections/[id]/residents`
for list/link/unlink. One new dialog component wired into the existing
Connections admin table for managing the additional residents on a flat.
`Connection.residentId` (today's "primary owner") is untouched — this is
purely additive.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (`@prisma/adapter-mariadb`),
NextAuth v5, zod, bcryptjs, shadcn/ui (Dialog, Select, Badge, Button,
Input, Label), sonner.

**Spec:** [`docs/superpowers/specs/2026-08-24-helpdesk-ticket-system-design.md`](../specs/2026-08-24-helpdesk-ticket-system-design.md)
in the `RealStateTicket-v3` repo, §4 "Electricity DB extension — multi-resident support".

## Global Constraints

- This codebase has **no automated test suite anywhere** (verified: no
  vitest/jest in package.json, zero test files). Do not introduce a test
  framework for this change — that would be an unrelated, unilateral
  restructure. Every task's "test" step is a manual verification against
  the running dev server (`curl` for API routes, browser for UI),
  matching how every other feature in this repo has shipped.
- Follow existing API conventions exactly: `auth()` for the session,
  `guardPermission(session, page, action)` for authorization, zod
  `safeParse` for body validation, `NextResponse.json(...)` for responses.
- Use the `"connections"` permission page for all new routes/UI in this
  plan (no new permission page — this is a sub-feature of connection
  management, and ADMIN always passes `guardPermission` regardless).
- bcrypt cost factor `12` (matches `app/api/residents/route.ts`).
- Never delete or mutate a `User`/`Resident` row from these new routes —
  only create (quick-create path) or remove the `ConnectionResident` join
  row (unlink path). Unlinking a resident must never delete their account.
- `Connection.residentId` / the existing `resident` relation on
  `Connection` are the "primary owner" and are out of scope for every
  task below — don't touch them.

---

### Task 1: Prisma schema + migration for `ConnectionResident`

**Files:**
- Modify: `prisma/schema.prisma`
- Migration: `prisma/migrations/<timestamp>_add_connection_resident/migration.sql` (generated)

**Interfaces:**
- Produces: `model ConnectionResident { id, connectionId, residentId, relationType, isPrimary, createdAt }`, `enum ResidentRelationType { OWNER, TENANT, FAMILY }`, back-relations `Connection.connectionResidents: ConnectionResident[]` and `Resident.connectionLinks: ConnectionResident[]`. Later tasks (2, 3, 4) query/create/delete through these.

- [ ] **Step 1: Add the enum and model to `prisma/schema.prisma`**

Add near the other enums (after `PaymentStatus` is fine, or anywhere at
top level):

```prisma
enum ResidentRelationType {
  OWNER
  TENANT
  FAMILY
}
```

Add the model (anywhere at top level, e.g. right after the `Connection`
model):

```prisma
model ConnectionResident {
  id           String               @id @default(cuid())
  connectionId String
  connection   Connection           @relation(fields: [connectionId], references: [id])
  residentId   String
  resident     Resident             @relation(fields: [residentId], references: [id])
  relationType ResidentRelationType
  isPrimary    Boolean              @default(false)
  createdAt    DateTime             @default(now())

  @@unique([connectionId, residentId])
}
```

- [ ] **Step 2: Add back-relations on the existing models**

In `model Connection { ... }`, add one field alongside the other list
relations (e.g. next to `maintenanceBills`):

```prisma
  connectionResidents ConnectionResident[]
```

In `model Resident { ... }`, add one field alongside `connections`:

```prisma
  connectionLinks ConnectionResident[]
```

- [ ] **Step 3: Generate and run the migration**

Run: `npx prisma migrate dev --name add_connection_resident`
Expected: prompts for nothing (no destructive change warning — this is a
purely additive new table), completes with "Your database is now in sync
with your schema", and creates
`prisma/migrations/<timestamp>_add_connection_resident/migration.sql`
containing a `CREATE TABLE` for `ConnectionResident` and the unique index
on `(connectionId, residentId)`.

- [ ] **Step 4: Verify the table exists**

Run: `npx prisma studio` (or, faster, a one-off script) — confirm the
`ConnectionResident` table appears in Prisma Studio's model list with
columns `id, connectionId, residentId, relationType, isPrimary,
createdAt`. Close Prisma Studio when confirmed.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add ConnectionResident model for multi-resident flats"
```

---

### Task 2: `GET /api/connections/[id]/residents` — list linked residents

**Files:**
- Create: `app/api/connections/[id]/residents/route.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`, `auth` from `@/auth`,
  `guardPermission` from `@/lib/permissions` (all existing, unchanged).
- Produces: `GET` handler returning
  `{ id, relationType, isPrimary, createdAt, resident: { id, phone, user: { id, name, email } } }[]`
  for a given connection. Task 5 (UI) fetches this to render the list.

- [ ] **Step 1: Write the route file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "connections", "canRead" as any);
  if (guard) return guard;

  const { id } = await params;

  const links = await prisma.connectionResident.findMany({
    where: { connectionId: id },
    include: {
      resident: {
        select: {
          id: true,
          phone: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(links);
}
```

Note: `guardPermission`'s `PermissionAction` type only lists `canRead |
canWrite | canDelete` — `"canRead"` is a valid literal already in that
union, the `as any` above is unnecessary; write it as
`guardPermission(session as any, "connections", "canRead")` instead (no cast
needed on the action arg).

- [ ] **Step 2: Verify against the running dev server**

Run: `npm run dev` (if not already running), then in another terminal,
log in as an admin in the browser to get a session cookie, or simpler —
temporarily hit the route while logged in via the browser at
`http://localhost:3000/api/connections/<a-real-connection-id>/residents`
(grab a real id from `npx prisma studio` → `Connection` table).
Expected: `200` with `[]` (no links yet, since Task 1 only added the
table — nothing populates it until Task 3).

- [ ] **Step 3: Commit**

```bash
git add app/api/connections/\[id\]/residents/route.ts
git commit -m "feat: add GET /api/connections/[id]/residents"
```

---

### Task 3: `POST /api/connections/[id]/residents` — link existing or quick-create

**Files:**
- Modify: `app/api/connections/[id]/residents/route.ts`

**Interfaces:**
- Consumes: same as Task 2, plus `bcryptjs` for the quick-create path.
- Produces: `POST` handler accepting
  `{ mode: "existing", residentId: string, relationType: "OWNER"|"TENANT"|"FAMILY" }`
  or
  `{ mode: "new", name: string, email: string, phone?: string, password: string, relationType: "OWNER"|"TENANT"|"FAMILY" }`,
  returns the created `ConnectionResident` (same shape as the GET list
  items) with status 201. Task 5 (UI) posts to this.

- [ ] **Step 1: Add the zod schemas and POST handler**

Add to the same file, below the `GET` export:

```typescript
import { z } from "zod";
import bcryptjs from "bcryptjs";

const linkExistingSchema = z.object({
  mode: z.literal("existing"),
  residentId: z.string().min(1),
  relationType: z.enum(["OWNER", "TENANT", "FAMILY"]),
});

const linkNewSchema = z.object({
  mode: z.literal("new"),
  name: z.string().min(1),
  email: z.email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  relationType: z.enum(["OWNER", "TENANT", "FAMILY"]),
});

const postSchema = z.union([linkExistingSchema, linkNewSchema]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "connections", "canWrite");
  if (guard) return guard;

  const { id: connectionId } = await params;

  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let residentId: string;

  if (parsed.data.mode === "existing") {
    const resident = await prisma.resident.findUnique({ where: { id: parsed.data.residentId } });
    if (!resident) {
      return NextResponse.json({ error: "Resident not found" }, { status: 404 });
    }
    residentId = resident.id;
  } else {
    const { name, email, phone, password, mode: _mode, relationType: _rt, ...rest } = parsed.data;
    void rest;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const hashedPassword = await bcryptjs.hash(password, 12);
    const last = await prisma.resident.findFirst({
      where: { residentNumber: { startsWith: "RES-" } },
      orderBy: { residentNumber: "desc" },
      select: { residentNumber: true },
    });
    const seq = last ? parseInt(last.residentNumber.slice(4), 10) + 1 : 1;
    const residentNumber = `RES-${String(seq).padStart(4, "0")}`;

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, password: hashedPassword, role: "RESIDENT" },
      });
      return tx.resident.create({
        data: { userId: user.id, residentNumber, phone },
      });
    });
    residentId = created.id;
  }

  const existingLink = await prisma.connectionResident.findUnique({
    where: { connectionId_residentId: { connectionId, residentId } },
  });
  if (existingLink) {
    return NextResponse.json({ error: "Resident already linked to this flat" }, { status: 409 });
  }

  const link = await prisma.connectionResident.create({
    data: { connectionId, residentId, relationType: parsed.data.relationType },
    include: {
      resident: {
        select: {
          id: true,
          phone: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json(link, { status: 201 });
}
```

- [ ] **Step 2: Verify the "existing resident" path**

Run: `npm run dev`, then from the browser devtools console (while logged
in as admin on `http://localhost:3000/admin/connections`) or via `curl`
with the session cookie copied from devtools:

```bash
curl -X POST http://localhost:3000/api/connections/<connection-id>/residents \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste session cookie>" \
  -d '{"mode":"existing","residentId":"<another-resident-id>","relationType":"TENANT"}'
```

Expected: `201` with the created link JSON. Re-running the same command
Expected: `409 Resident already linked to this flat`.

- [ ] **Step 3: Verify the "quick-create" path**

```bash
curl -X POST http://localhost:3000/api/connections/<connection-id>/residents \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste session cookie>" \
  -d '{"mode":"new","name":"Test Tenant","email":"test.tenant@example.com","phone":"9999999999","password":"tenant123","relationType":"TENANT"}'
```

Expected: `201` with a new resident's link JSON. Confirm in Prisma Studio
that a new `User` (role `RESIDENT`), `Resident`, and `ConnectionResident`
row were all created.

- [ ] **Step 4: Commit**

```bash
git add app/api/connections/\[id\]/residents/route.ts
git commit -m "feat: add POST /api/connections/[id]/residents (link existing or quick-create)"
```

---

### Task 4: `DELETE /api/connections/[id]/residents/[linkId]` — unlink

**Files:**
- Create: `app/api/connections/[id]/residents/[linkId]/route.ts`

**Interfaces:**
- Consumes: same as Tasks 2/3.
- Produces: `DELETE` handler removing one `ConnectionResident` row by its
  own `id` (never the underlying `User`/`Resident`). Returns `204`. Task 5
  (UI) calls this for the "remove" button.

- [ ] **Step 1: Write the route file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "connections", "canWrite");
  if (guard) return guard;

  const { id: connectionId, linkId } = await params;

  const link = await prisma.connectionResident.findUnique({ where: { id: linkId } });
  if (!link || link.connectionId !== connectionId) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  await prisma.connectionResident.delete({ where: { id: linkId } });

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 2: Verify**

```bash
curl -X DELETE http://localhost:3000/api/connections/<connection-id>/residents/<link-id> \
  -H "Cookie: <paste session cookie>"
```

Expected: `204` empty response. Re-fetch `GET
/api/connections/<connection-id>/residents` (Task 2's route) and confirm
the link no longer appears. In Prisma Studio, confirm the linked `User`
and `Resident` rows still exist untouched — only the
`ConnectionResident` row was removed.

- [ ] **Step 3: Commit**

```bash
git add app/api/connections/\[id\]/residents/\[linkId\]/route.ts
git commit -m "feat: add DELETE /api/connections/[id]/residents/[linkId]"
```

---

### Task 5: Admin UI — "Additional Residents" dialog on the Connections table

**Files:**
- Create: `components/admin/additional-residents-dialog.tsx`
- Modify: `components/admin/connections-table.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/connections/[id]/residents` and `DELETE
  /api/connections/[id]/residents/[linkId]` from Tasks 2–4. Also reuses
  the existing `GET /api/residents?search=` endpoint
  (`app/api/residents/route.ts`, already in the codebase) to search for
  an existing resident to link.
- Produces: a `<AdditionalResidentsDialog connectionId={string}
  flatNo={string} open={boolean} onOpenChange={(open: boolean) => void}
  canWrite={boolean} />` component, and a trigger button added to each row
  of `ConnectionsTable`.

- [ ] **Step 1: Create the dialog component**

```typescript
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

type Link = {
  id: string;
  relationType: "OWNER" | "TENANT" | "FAMILY";
  resident: { id: string; phone: string | null; user: { id: string; name: string; email: string } };
};

type ResidentSearchResult = {
  id: string;
  user: { name: string; email: string };
};

interface Props {
  connectionId: string;
  flatNo: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
}

export default function AdditionalResidentsDialog({ connectionId, flatNo, open, onOpenChange, canWrite }: Props) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [relationType, setRelationType] = useState<"OWNER" | "TENANT" | "FAMILY">("TENANT");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ResidentSearchResult[]>([]);
  const [selectedResidentId, setSelectedResidentId] = useState("");
  const [newForm, setNewForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/connections/${connectionId}/residents`)
      .then((r) => r.json())
      .then(setLinks)
      .finally(() => setLoading(false));
  }, [open, connectionId]);

  useEffect(() => {
    if (mode !== "existing" || search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/residents?search=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then(setSearchResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, mode]);

  async function handleAdd() {
    setIsSubmitting(true);
    try {
      const body =
        mode === "existing"
          ? { mode: "existing", residentId: selectedResidentId, relationType }
          : { mode: "new", ...newForm, relationType };

      const res = await fetch(`/api/connections/${connectionId}/residents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to add resident");
        return;
      }

      const link = await res.json();
      setLinks((prev) => [...prev, link]);
      setSelectedResidentId("");
      setSearch("");
      setNewForm({ name: "", email: "", phone: "", password: "" });
      toast.success("Resident linked to flat");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(linkId: string) {
    const res = await fetch(`/api/connections/${connectionId}/residents/${linkId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to remove resident");
      return;
    }
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    toast.success("Resident removed from flat");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Additional Residents — {flatNo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : links.length === 0 ? (
            <p className="text-sm text-gray-500">No additional residents linked yet.</p>
          ) : (
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.id} className="flex items-center justify-between rounded border p-2">
                  <div>
                    <p className="text-sm font-medium">{link.resident.user.name}</p>
                    <p className="text-xs text-gray-500">{link.resident.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{link.relationType}</Badge>
                    {canWrite && (
                      <Button size="icon" variant="ghost" onClick={() => handleRemove(link.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canWrite && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex gap-2">
                <Button size="sm" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>
                  Link Existing
                </Button>
                <Button size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>
                  Quick Create
                </Button>
              </div>

              <div>
                <Label>Relation</Label>
                <Select value={relationType} onValueChange={(v) => setRelationType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OWNER">Owner</SelectItem>
                    <SelectItem value="TENANT">Tenant</SelectItem>
                    <SelectItem value="FAMILY">Family</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {mode === "existing" ? (
                <div>
                  <Label>Search resident by name/flat</Label>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." />
                  {searchResults.length > 0 && (
                    <ul className="mt-1 max-h-40 overflow-auto rounded border">
                      {searchResults.map((r) => (
                        <li
                          key={r.id}
                          className={`cursor-pointer p-2 text-sm hover:bg-gray-50 ${selectedResidentId === r.id ? "bg-gray-100" : ""}`}
                          onClick={() => setSelectedResidentId(r.id)}
                        >
                          {r.user.name} — {r.user.email}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Input placeholder="Name" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} />
                  <Input placeholder="Email" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} />
                  <Input placeholder="Phone" value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} />
                  <Input placeholder="Password" type="password" value={newForm.password} onChange={(e) => setNewForm({ ...newForm, password: e.target.value })} />
                </div>
              )}

              <Button
                onClick={handleAdd}
                disabled={isSubmitting || (mode === "existing" ? !selectedResidentId : !newForm.name || !newForm.email || !newForm.password)}
              >
                {isSubmitting ? "Adding..." : "Add Resident"}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire the trigger into `connections-table.tsx`**

In `components/admin/connections-table.tsx`:

Add the import near the other component imports:

```typescript
import AdditionalResidentsDialog from "@/components/admin/additional-residents-dialog";
import { Users } from "lucide-react";
```

Add state near the other `useState` calls in `ConnectionsTable`:

```typescript
  const [residentsDialogConnection, setResidentsDialogConnection] = useState<Connection | null>(null);
```

Find the row actions area (near the existing edit `Pencil` button — search
for `<Pencil` in the file to locate it) and add a sibling button:

```tsx
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setResidentsDialogConnection(connection)}
                title="Manage additional residents"
              >
                <Users className="h-4 w-4" />
              </Button>
```

At the end of the component's returned JSX, alongside the existing edit
`<Dialog>`, render the new dialog:

```tsx
      {residentsDialogConnection && (
        <AdditionalResidentsDialog
          connectionId={residentsDialogConnection.id}
          flatNo={residentsDialogConnection.flatNo}
          open={!!residentsDialogConnection}
          onOpenChange={(open) => !open && setResidentsDialogConnection(null)}
          canWrite={canWrite}
        />
      )}
```

- [ ] **Step 3: Manual verification in the browser**

Run: `npm run dev`, log in as ADMIN, go to `/admin/connections`, click the
new "Manage additional residents" icon on any row.
Expected: dialog opens showing "No additional residents linked yet."
Switch to "Link Existing", type 2+ characters of another resident's name,
select them, pick a relation type, click "Add Resident" — expect a
success toast and the new entry to appear in the list. Click "Quick
Create", fill in a new person's details, submit — expect success toast
and the new entry to appear. Click the trash icon on one entry — expect
it to disappear and a success toast. Refresh the page and reopen the
dialog — expect the remaining entries to still be there (confirms
persistence, not just local state).

- [ ] **Step 4: Commit**

```bash
git add components/admin/additional-residents-dialog.tsx components/admin/connections-table.tsx
git commit -m "feat: add Additional Residents management UI to Connections admin page"
```

---

## Self-Review Notes

- **Spec coverage:** §4 of the design spec is fully covered — schema
  (Task 1), API (Tasks 2–4), minimal admin UI (Task 5), primary
  owner (`Connection.residentId`) left untouched throughout.
- This plan does **not** touch the Help Desk app itself — the Help Desk
  app's flat-lookup endpoint (spec §6.1) will read
  `connectionResidents` via the read-only Electricity DB client once this
  plan's migration has run; that's covered by the Help Desk app's own plan.
