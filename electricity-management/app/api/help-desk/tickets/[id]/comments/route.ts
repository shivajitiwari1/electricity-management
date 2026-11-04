export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardHelpDeskEnabled } from "@/lib/help-desk-config";
import { ticketInclude, serializeTicket } from "@/lib/help-desk";
import { z } from "zod";

const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  isInternal: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  const role = (session.user as any).role as string;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, residentId: true, status: true, categoryId: true },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  let isInternal = parsed.data.isInternal;
  if (role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({
      where: { userId: (session.user as any).id },
      select: { id: true },
    });
    if (resident?.id !== ticket.residentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Residents always post public replies.
    isInternal = false;
  } else if (role === "ADMIN" || role === "MANAGER") {
    const guard = await guardPermission(session as any, "help-desk", "canWrite");
    if (guard) return guard;
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketComment.create({
      data: {
        ticketId: id,
        authorId: String((session.user as any).id),
        body: parsed.data.body,
        isInternal,
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // Keep ticket ordering fresh for admin list views.
    await tx.ticket.update({ where: { id }, data: { updatedAt: new Date() } });

    await tx.auditLog.create({
      data: {
        userId: String((session.user as any).id),
        action: "COMMENT",
        entity: "Ticket",
        entityId: id,
        meta: { isInternal },
      },
    });

    return created;
  });

  const include = ticketInclude as any;
  const ticketAfter = await prisma.ticket.findUnique({
    where: { id },
    include,
  });

  if ((session.user as any).role === "RESIDENT") {
    if (ticketAfter) {
      (ticketAfter as any).comments = (ticketAfter as any).comments.filter((c: any) => !c.isInternal);
    }
  }

  return NextResponse.json({
    comment: {
      ...comment,
      createdAt: comment.createdAt.toISOString(),
    },
    ticket: ticketAfter ? serializeTicket(ticketAfter as any) : null,
  });
}
