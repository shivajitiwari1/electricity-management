export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardTenantVerificationEnabled } from "@/lib/tenant-verification-config";
import { generateTenantVerificationCertificatePdf } from "@/lib/tenant-verification-pdf";

export async function GET(
  _req: NextRequest,
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
    include: {
      resident: { include: { user: true } },
      connection: { select: { flatNo: true, tower: true } },
    },
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
      "canRead"
    );
    if (guard) return guard;
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pdfData = {
    applicationNumber: application.applicationNumber,
    status: application.status,
    tenantName: application.tenantName,
    tenantPhone: application.tenantPhone,
    tenantEmail: application.tenantEmail ?? undefined,
    flatNo: application.connection?.flatNo ?? null,
    tower: application.connection?.tower ?? null,
    ownerName: application.resident?.user?.name ?? null,
    applicationDate: application.createdAt,
    approvedAt: application.managementApprovedAt ?? application.ownerApprovedAt ?? null,
    remarks: null,
  };

  const buffer = await generateTenantVerificationCertificatePdf(pdfData);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=0, no-store",
      "Content-Disposition": `inline; filename="TV-${application.applicationNumber}.pdf"`,
    },
  });
}
