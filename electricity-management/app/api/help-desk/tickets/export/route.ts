export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { formatTicketPriority, formatTicketStatus, formatTicketType } from "@/lib/help-desk";
import ExcelJS from "exceljs";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await guardPermission(session as any, "help-desk", "canRead");
  if (guard) return guard;

  const tickets = await prisma.ticket.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10_000,
    include: {
      resident: { include: { user: { select: { name: true, email: true } } } },
      connection: { select: { flatNo: true, tower: true } },
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      assignee: { select: { name: true } },
      _count: { select: { comments: true, attachments: true } },
    },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Oasis Venetia Heights";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Help Desk");
  sheet.columns = [
    { header: "Ticket No", key: "ticketNumber", width: 14 },
    { header: "Resident", key: "resident", width: 28 },
    { header: "Flat / Location", key: "location", width: 18 },
    { header: "Category", key: "category", width: 24 },
    { header: "Subcategory", key: "subcategory", width: 20 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Status", key: "status", width: 16 },
    { header: "Type", key: "type", width: 14 },
    { header: "Assignee", key: "assignee", width: 26 },
    { header: "Created", key: "createdAt", width: 20 },
    { header: "Last Updated", key: "updatedAt", width: 20 },
    { header: "Comments", key: "comments", width: 12 },
    { header: "Attachments", key: "attachments", width: 12 },
    { header: "Description", key: "description", width: 60 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };

  for (const ticket of tickets) {
    sheet.addRow({
      ticketNumber: ticket.ticketNumber,
      resident: ticket.resident.user?.name ?? "—",
      location: [ticket.connection?.tower, ticket.connection?.flatNo].filter(Boolean).join("-"),
      category: ticket.category.name,
      subcategory: ticket.subcategory?.name ?? "—",
      priority: formatTicketPriority(ticket.priority),
      status: formatTicketStatus(ticket.status),
      type: formatTicketType(ticket.complaintType),
      assignee: ticket.assignee?.name ?? "Unassigned",
      createdAt: ticket.createdAt.toLocaleString("en-IN"),
      updatedAt: ticket.updatedAt.toLocaleString("en-IN"),
      comments: ticket._count.comments,
      attachments: ticket._count.attachments,
      description: ticket.description,
    });
  }

  sheet.autoFilter = { from: "A1", to: "N1" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const arrayBuffer = (await workbook.xlsx.writeBuffer()) as unknown;
  const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
  const filename = `help-desk-tickets-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
