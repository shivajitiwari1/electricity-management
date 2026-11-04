export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardHelpDeskEnabled } from "@/lib/help-desk-config";
import { serializeTicket, ticketInclude } from "@/lib/help-desk";
import { z } from "zod";

const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED", "AUTO_CLOSED", "CANCELLED", "NOT_AN_ISSUE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  complaintType: z.enum(["PERSONAL", "PUBLIC"]).optional(),
  categoryId: z.string().min(1).optional(),
  subcategoryId: z.string().min(1).nullable().optional(),
  connectionId: z.string().min(1).nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
});

const TERMINAL_STATUSES = new Set(["RESOLVED", "CLOSED", "AUTO_CLOSED", "CANCELLED", "NOT_AN_ISSUE"]);

async function canAccess(session: { user: { id?: string; role?: string } } | null, ticket: { id: string; residentId: string }) {
  if (!session?.user?.id) return false;
  if (session.user.role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    return resident?.id === ticket.residentId;
  }
  return session.user.role === "ADMIN" || session.user.role === "MANAGER";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: ticketInclude as any,
  });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  if (!(await canAccess(session as any, ticket as any))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "MANAGER") {
    // Residents must not see staff-only comments.
    (ticket as any).comments = (ticket as any).comments.filter((comment: any) => !comment.isInternal);
  }

  return NextResponse.json({ ticket: serializeTicket(ticket as any) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardHelpDeskEnabled();
  if (disabled) return disabled;

  const role = (session.user as any).role as string;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const guard = await guardPermission(session as any, "help-desk", "canWrite");
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { resident: { select: { id: true } }, connection: { select: { id: true } } },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  if (data.categoryId) {
    const category = await prisma.ticketCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  if (data.subcategoryId) {
    const sub = await prisma.ticketSubcategory.findUnique({
      where: { id: data.subcategoryId },
      select: { id: true, categoryId: true },
    });
    const categoryId = data.categoryId ?? ticket.categoryId;
    if (!sub || sub.categoryId !== categoryId) {
      return NextResponse.json({ error: "Subcategory does not belong to category" }, { status: 400 });
    }
  }
  if (data.connectionId) {
    const connection = await prisma.connection.findUnique({
      where: { id: data.connectionId },
      select: { residentId: true },
    });
    if (!connection || connection.residentId !== ticket.residentId) {
      return NextResponse.json({ error: "Location does not belong to this resident" }, { status: 400 });
    }
  }
  if (data.assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: data.assigneeId }, select: { id: true } });
    if (!assignee) return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
  }

  const nextTerminal = data.status ? TERMINAL_STATUSES.has(data.status) : undefined;
  const wasTerminal = TERMINAL_STATUSES.has(ticket.status);
  const closedAt =
    nextTerminal === true
      ? new Date()
      : nextTerminal === false
        ? null
        : data.status
          ? TERMINAL_STATUSES.has(data.status)
            ? ticket.closedAt ?? new Date()
            : null
          : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status as any } : {}),
        ...(data.priority !== undefined ? { priority: data.priority as any } : {}),
        ...(data.complaintType !== undefined ? { complaintType: data.complaintType as any } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.subcategoryId !== undefined ? { subcategoryId: data.subcategoryId } : {}),
        ...(data.connectionId !== undefined ? { connectionId: data.connectionId } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
        ...(closedAt !== undefined ? { closedAt } : {}),
        updatedAt: new Date(),
      },
      include: ticketInclude as any,
    });

    await tx.auditLog.create({
      data: {
        userId: userIdFrom(session),
        action: "UPDATE",
        entity: "Ticket",
        entityId: id,
        meta: data,
      },
    });

    return updated;
  });

  if (nextTerminal === true && !wasTerminal) {
    // Reserved for future "ticket closed" notification.
  }

  return NextResponse.json({ ticket: serializeTicket(updated as any) });
}

function userIdFrom(session: { user: { id?: string } }) {
  return String(session.user.id ?? "");
}
