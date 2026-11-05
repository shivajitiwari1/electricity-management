export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
  documentType: z.enum([
    "ID_PROOF",
    "ADDRESS_PROOF",
    "RENT_AGREEMENT",
    "NOC",
    "PHOTO",
    "VEHICLE_RC",
    "OTHER",
  ]),
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
  const userId = String((session.user as any).id ?? "");

  // Check ownership
  const application = await prisma.tenantApplication.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      residentId: true,
      tenantEmail: true,
      tenantPhone: true,
    },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const phoneParam = url.searchParams.get("phone");
  const userEmail = (session.user as any).email as string | undefined;

  const ownsApplication =
    application.residentId === userId ||
    application.tenantEmail === userEmail ||
    application.tenantPhone === phoneParam;

  if (!ownsApplication) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only PENDING applications can have documents uploaded
  if (application.status !== "PENDING") {
    return NextResponse.json(
      { error: "Documents can only be uploaded for draft applications" },
      { status: 409 }
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const documentType = formData.get("documentType") as string | null;

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

  // Generate server-side storage key (never trust client filename)
  const storageKey = `tenant-verification/${application.id}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const document = await prisma.tenantDocument.create({
    data: {
      applicationId: id,
      documentType: documentType as any,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: buffer.length,
      data: buffer,
      verified: false,
      uploadedBy: userId || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "CREATE",
      entity: "TenantDocument",
      entityId: document.id,
      meta: { applicationId: id, documentType, fileName: file.name, sizeBytes: buffer.length },
    },
  });

  return NextResponse.json({
    document: {
      id: document.id,
      documentType: document.documentType,
      fileName: document.fileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      verified: document.verified,
      createdAt: document.createdAt,
    },
  }, { status: 201 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const { id } = await params;
  const userId = String((session.user as any).id ?? "");

  const application = await prisma.tenantApplication.findUnique({
    where: { id },
    select: {
      id: true,
      residentId: true,
      tenantEmail: true,
      tenantPhone: true,
    },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(_req.url);
  const phoneParam = url.searchParams.get("phone");
  const userEmail = (session.user as any).email as string | undefined;

  const ownsApplication =
    application.residentId === userId ||
    application.tenantEmail === userEmail ||
    application.tenantPhone === phoneParam;

  if (!ownsApplication) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.tenantDocument.findMany({
    where: { applicationId: id },
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      documentType: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      verified: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ documents });
}
