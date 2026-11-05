export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardTenantVerificationEnabled } from "@/lib/tenant-verification-config";
import { z } from "zod";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const uploadDocumentSchema = z.object({
  documentType: z.nativeEnum(require("@prisma/client").VerificationDocumentType),
  uploadedBy: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const { id } = await params;
  const role = (session.user as any).role as string;
  const userId = String((session.user as any).id ?? "");

  const application = await prisma.tenantApplication.findUnique({
    where: { id },
    select: { id: true, residentId: true, status: true },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!resident || resident.id !== application.residentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (role === "ADMIN" || role === "MANAGER") {
    const guard = await guardPermission(
      session as any,
      "tenant-verification",
      "canWrite"
    );
    if (guard) return guard;
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const documentType = formData.get("documentType") as string | null;
  const uploadedBy = formData.get("uploadedBy") as string | null;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (!documentType) {
    return NextResponse.json({ error: "documentType is required" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `File type ${file.type} not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Max 5 MB" }, { status: 400 });
  }

  const buffer = Buffer.from(arrayBuffer);

  const document = await prisma.tenantDocument.create({
    data: {
      applicationId: id,
      documentType: documentType as any,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: buffer.length,
      data: buffer,
      verified: false,
      verifiedBy: null,
      verifiedAt: null,
      uploadedBy: uploadedBy ?? userId ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "DOCUMENT_UPLOAD",
      entity: "TenantDocument",
      entityId: document.id,
      meta: { applicationId: id, documentType, fileName: file.name },
    },
  });

  return NextResponse.json({ document }, { status: 201 });
}
