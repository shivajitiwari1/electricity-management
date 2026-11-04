export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardHelpDeskEnabled } from "@/lib/help-desk-config";
import { nextHelpDeskTicketNumber, serializeTicket, ticketInclude } from "@/lib/help-desk";
import { computeSlaDueAt, resolveTicketAssignee } from "@/lib/help-desk-assignment";
import { z } from "zod";
import type { TicketStatus } from "@prisma/client";

const createTicketSchema = z.object({
  residentId: z.string().min(1).optional(),
  connectionId: z.string().min(1).optional(),
  categoryId: z.string().min(1),
  subcategoryId: z.string().min(1).nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  complaintType: z.enum(["PERSONAL", "PUBLIC"]).default("PERSONAL"),
  description: z.string().trim().min(1).max(2000),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role as string;
  const userId = String((session.user as any).id ?? "");

  const where: any = {};

  if (role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!resident) return NextResponse.json({ tickets: [] });
    where.residentId = resident.id;
  } else if (role === "ADMIN" || role === "MANAGER") {
    const guard = await guardPermission(session as any, "help-desk", "canRead");
    if (guard) return guard;
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const statusParam = url.searchParams.get("status")?.trim();

  if (search) {
    where.OR = [
      { ticketNumber: { contains: search } },
      { description: { contains: search } },
      { connection: { flatNo: { contains: search } } },
      { connection: { tower: { contains: search } } },
      { resident: { user: { name: { contains: search } } } },
    ];
  }

  if (statusParam) {
    const statuses = statusParam
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    if (statuses.length > 0) {
      where.status = { in: statuses as any };
    }
  }

  const tickets = await prisma.ticket.findMany({
    where,
    include: ticketInclude as any,
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const serialized = tickets.map((ticket: any) => {
    if (role === "RESIDENT") {
      ticket.comments = ticket.comments.filter((comment: any) => !comment.isInternal);
    }
    return serializeTicket(ticket);
  });

  return NextResponse.json({ tickets: serialized });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardHelpDeskEnabled();
  if (disabled) return disabled;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const user = session.user as { id: string; role?: string };
  const role = user.role;

  const ownResidentId = await prisma.resident.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (role === "RESIDENT") {
    if (!ownResidentId) {
      return NextResponse.json({ error: "Resident profile not found" }, { status: 404 });
    }
    data.residentId = ownResidentId.id;
  } else {
    if (!data.residentId) {
      return NextResponse.json({ error: "Select Resident is required" }, { status: 400 });
    }
    const guard = await guardPermission(session as any, "help-desk", "canWrite");
    if (guard) return guard;
  }

  const resident = await prisma.resident.findUnique({
    where: { id: data.residentId },
    select: { id: true },
  });
  if (!resident) return NextResponse.json({ error: "Resident not found" }, { status: 404 });

  const category = await prisma.ticketCategory.findUnique({
    where: { id: data.categoryId },
    select: { id: true },
  });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const subcategoryId = data.subcategoryId ?? null;
  if (subcategoryId) {
    const sub = await prisma.ticketSubcategory.findUnique({
      where: { id: subcategoryId },
      select: { id: true, categoryId: true },
    });
    if (!sub || sub.categoryId !== data.categoryId) {
      return NextResponse.json({ error: "Subcategory does not belong to category" }, { status: 400 });
    }
  }

  const connections = await prisma.connection.findMany({
    where: { residentId: data.residentId },
    select: { id: true, flatNo: true, tower: true, status: true },
    orderBy: { flatNo: "asc" },
  });

  let connectionId = data.connectionId ?? null;
  if (!connectionId) {
    if (connections.length === 1) connectionId = connections[0].id;
    else if (connections.length > 1) {
      return NextResponse.json({ error: "Select a location for the ticket" }, { status: 400 });
    } else {
      return NextResponse.json({ error: "Resident has no registered location" }, { status: 400 });
    }
  } else {
    const owned = connections.find((connection) => connection.id === connectionId);
    if (!owned) {
      return NextResponse.json({ error: "Location does not belong to the selected resident" }, { status: 400 });
    }
  }

  let assigneeId = data.assigneeId ?? null;
  if (!assigneeId) {
    assigneeId = await resolveTicketAssignee(data.categoryId, subcategoryId);
  } else {
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true },
    });
    if (!assignee) return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
  }

  const slaDueAt = await computeSlaDueAt(data.categoryId, data.priority);

  const ticket = await prisma.$transaction(async (tx) => {
    const ticketNumber = await nextHelpDeskTicketNumber();
    const created = await tx.ticket.create({
      data: {
        ticketNumber,
        residentId: data.residentId!,
        connectionId,
        categoryId: data.categoryId,
        subcategoryId,
        assigneeId,
        createdById: user.id,
        description: data.description,
        priority: data.priority as any,
        complaintType: data.complaintType as any,
        status: "OPEN" as TicketStatus,
        slaDueAt,
      },
      include: ticketInclude as any,
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entity: "Ticket",
        entityId: created.id,
        meta: { ticketNumber, categoryId: data.categoryId, priority: data.priority },
      },
    });

    return created;
  });

  return NextResponse.json({ ticket: serializeTicket(ticket as any) }, { status: 201 });
}
