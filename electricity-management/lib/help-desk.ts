import { prisma } from "@/lib/prisma";
import { DEFAULT_HELP_DESK_CATEGORIES } from "@/lib/help-desk-categories";
import { formatTicketPriority, formatTicketStatus, formatTicketType } from "@/lib/help-desk-format";

export { DEFAULT_HELP_DESK_CATEGORIES, formatTicketPriority, formatTicketStatus, formatTicketType };
export const HELP_DESK_PAGE_ID = "help-desk";

export const ticketInclude = {
  resident: { include: { user: { select: { id: true, name: true, email: true } } } },
  connection: { select: { id: true, flatNo: true, tower: true } },
  category: { select: { id: true, name: true } },
  subcategory: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true, role: true } },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      author: { select: { id: true, name: true, email: true, role: true } },
    },
  },
  attachments: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      uploadedById: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  },
  _count: { select: { comments: true, attachments: true } },
} as const;

type PrismaTicket = Awaited<ReturnType<typeof prisma.ticket.findUnique>>;

/**
 * Finds the highest existing ticket number prefixed with OV- and increments it.
 * Callers should retry on a unique-constraint violation if there is a race.
 */
export async function nextHelpDeskTicketNumber() {
  const latest = await prisma.ticket.findFirst({
    where: { ticketNumber: { startsWith: "OV-" } },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });

  const latestNumber = latest ? Number(latest.ticketNumber.replace(/\D/g, "")) : 0;
  const next = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;
  return `OV-${String(next).padStart(3, "0")}`;
}

/** Serialize a Prisma ticket payload into JSON-safe data for client components. */
export function serializeTicket(ticket: {
  id: string;
  ticketNumber: string;
  description: string;
  priority: string;
  status: string;
  complaintType: string;
  escalationLevel: number;
  slaDueAt: Date | null;
  lastEscalatedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  resident: {
    id: string;
    user: { id: string; name: string; email: string; phone?: string | null } | null;
  };
  connection: { id: string; flatNo: string; tower: string } | null;
  category: { id: string; name: string };
  subcategory: { id: string; name: string } | null;
  assignee: { id: string; name: string; email: string; role: string } | null;
  createdBy: { id: string; name: string; email: string; role: string };
  comments: Array<{
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: Date;
    author: { id: string; name: string; email: string; role: string };
  }>;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    uploadedById: string | null;
    uploadedBy: { id: string; name: string; email: string } | null;
  }>;
}) {
  return {
    ...ticket,
    resident: {
      ...ticket.resident,
      user: ticket.resident.user,
      residentName: ticket.resident.user?.name ?? "—",
      flatNo: ticket.connection?.flatNo ?? null,
    },
    slaDueAt: ticket.slaDueAt?.toISOString() ?? null,
    lastEscalatedAt: ticket.lastEscalatedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    comments: ticket.comments.map((comment) => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
    })),
    attachments: ticket.attachments.map((attachment) => ({
      ...attachment,
      createdAt: attachment.createdAt.toISOString(),
    })),
  };
}
