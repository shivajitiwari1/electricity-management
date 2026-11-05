export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.tenantDocument.findUnique({
    where: { id },
    select: {
      data: true,
      mimeType: true,
      fileName: true,
      application: { select: { residentId: true, id: true } },
    },
  });

  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const role = (session.user as any).role as string;
  const userId = String((session.user as any).id ?? "");

  if (role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!resident || resident.id !== document.application.residentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buffer = Buffer.from(document.data as any);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=0, no-store",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
    },
  });
}
