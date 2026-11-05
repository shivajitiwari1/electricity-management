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
  const userId = String((session.user as any).id ?? "");

  const document = await prisma.tenantDocument.findUnique({
    where: { id },
    select: {
      data: true,
      mimeType: true,
      fileName: true,
      application: {
        select: {
          residentId: true,
          tenantEmail: true,
          tenantPhone: true,
        },
      },
    },
  });

  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const url = new URL(_req.url);
  const phoneParam = url.searchParams.get("phone");
  const userEmail = (session.user as any).email as string | undefined;

  const ownsApplication =
    document.application.residentId === userId ||
    document.application.tenantEmail === userEmail ||
    document.application.tenantPhone === phoneParam;

  if (!ownsApplication) {
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
