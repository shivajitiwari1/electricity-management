export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateTicketJobCardPdf, type TicketJobCardData } from "@/lib/help-desk-job-card";
import { formatTicketPriority, formatTicketStatus, formatTicketType } from "@/lib/help-desk";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      resident: { include: { user: { select: { name: true } } } },
      connection: { select: { flatNo: true, tower: true } },
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      assignee: { select: { name: true } },
      comments: {
        where: { isInternal: false },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      attachments: { select: { fileName: true } },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const role = (session.user as any).role as string;
  if (role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({
      where: { userId: String((session.user as any).id) },
      select: { id: true },
    });
    if (resident?.id !== ticket.residentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: TicketJobCardData = {
    ticketNumber: ticket.ticketNumber,
    statusLabel: formatTicketStatus(ticket.status),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    description: ticket.description,
    residentName: ticket.resident.user?.name ?? "Resident",
    flatNo: ticket.connection?.flatNo,
    tower: ticket.connection?.tower,
    phone: ticket.resident.phone,
    categoryName: ticket.category.name,
    subcategoryName: ticket.subcategory?.name ?? null,
    priorityLabel: formatTicketPriority(ticket.priority),
    complaintTypeLabel: formatTicketType(ticket.complaintType),
    assigneeName: ticket.assignee?.name ?? null,
    escalationLabel: ticket.escalationLevel > 0 ? `Level ${ticket.escalationLevel}` : "Not Escalated",
    attachments: ticket.attachments,
    comments: ticket.comments.map((comment) => ({
      authorName: comment.author.name,
      body: comment.body,
      createdAt: comment.createdAt,
      isInternal: comment.isInternal,
    })),
  };

  const buffer = await generateTicketJobCardPdf(data);
  const inline = req.nextUrl.searchParams.get("inline") === "1";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=0, no-store",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="job-card-${ticket.ticketNumber}.pdf"`,
    },
  });
}
