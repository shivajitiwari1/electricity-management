export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardHelpDeskEnabled } from "@/lib/help-desk-config";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const SIGNATURES: Record<string, (buf: Buffer) => boolean> = {
  "image/jpeg": (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  "image/png": (buf) =>
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a,
  "image/webp": (buf) =>
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP",
  "image/gif": (buf) => buf.length > 6 && buf.toString("ascii", 0, 6).startsWith("GIF8"),
};

function isAllowedMime(mime: string) {
  return Object.prototype.hasOwnProperty.call(SIGNATURES, mime);
}

function signatureMatches(mime: string, buf: Buffer) {
  return SIGNATURES[mime]?.(buf) ?? false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardHelpDeskEnabled();
  if (disabled) return disabled;

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, residentId: true },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const role = (session.user as any).role as string;
  const userId = String((session.user as any).id ?? "");

  if (role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (resident?.id !== ticket.residentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (role === "ADMIN" || role === "MANAGER") {
    const guard = await guardPermission(session as any, "help-desk", "canWrite");
    if (guard) return guard;
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const files = formData
    .getAll("files")
    .filter((item): item is File => typeof item === "object" && "arrayBuffer" in (item as File));

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const prepared: { fileName: string; mimeType: string; sizeBytes: number; buffer: Buffer }[] = [];
  for (const file of files) {
    if (!isAllowedMime(file.type)) {
      return NextResponse.json(
        { error: `Unsupported attachment type: ${file.type}` },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `Attachment too large (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB)` },
        { status: 400 }
      );
    }
    if (!signatureMatches(file.type, buffer)) {
      return NextResponse.json(
        { error: "Attachment content does not match its type" },
        { status: 400 }
      );
    }
    prepared.push({ fileName: file.name || "attachment", mimeType: file.type, sizeBytes: buffer.length, buffer });
  }

  const attachments = await prisma.$transaction(async (tx) => {
    const created: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: Date;
      uploadedById: string | null;
    }> = [];
    for (const item of prepared) {
      const saved = await tx.ticketAttachment.create({
        data: {
          ticketId: id,
          uploadedById: userId,
          fileName: item.fileName,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          data: new Uint8Array(item.buffer),
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          uploadedById: true,
        },
      });
      created.push(saved);
    }

    await tx.ticket.update({ where: { id }, data: { updatedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        userId,
        action: "ATTACHMENT_UPLOAD",
        entity: "Ticket",
        entityId: id,
        meta: { count: prepared.length },
      },
    });

    return created;
  });

  return NextResponse.json(
    {
      attachments: attachments.map((attachment) => ({
        ...attachment,
        createdAt: attachment.createdAt.toISOString(),
      })),
    },
    { status: 201 }
  );
}
