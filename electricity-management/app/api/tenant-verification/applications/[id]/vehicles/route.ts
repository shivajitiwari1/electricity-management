export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardTenantVerificationEnabled } from "@/lib/tenant-verification-config";
import { z } from "zod";

const vehicleSchema = z.object({
  vehicleType: z.string().optional().or(z.literal("")).optional(),
  registrationNo: z.string().optional().or(z.literal("")).optional(),
  stickerRfidNo: z.string().optional().or(z.literal("")).optional(),
});

const updateVehicleSchema = z.object({
  id: z.string(),
  vehicleType: z.string().optional().or(z.literal("")).optional(),
  registrationNo: z.string().optional().or(z.literal("")).optional(),
  stickerRfidNo: z.string().optional().or(z.literal("")).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const { id } = await params;

  const vehicles = await prisma.tenantVehicle.findMany({
    where: { applicationId: id },
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      vehicleType: true,
      registrationNo: true,
      stickerRfidNo: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ vehicles });
}

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
    select: { id: true, status: true, residentId: true, tenantEmail: true, tenantPhone: true },
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

  if (application.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only draft applications can be edited" },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = vehicleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { vehicleType, registrationNo, stickerRfidNo } = parsed.data;

  const vehicle = await prisma.tenantVehicle.create({
    data: {
      applicationId: id,
      vehicleType: vehicleType || null,
      registrationNo: registrationNo || null,
      stickerRfidNo: stickerRfidNo || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "CREATE",
      entity: "TenantVehicle",
      entityId: vehicle.id,
      meta: { applicationId: id, vehicleType, registrationNo },
    },
  });

  return NextResponse.json({ vehicle }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const { id } = await params;
  const userId = String((session.user as any).id ?? "");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateVehicleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id: vehicleId, vehicleType, registrationNo, stickerRfidNo } = parsed.data;

  const vehicle = await prisma.tenantVehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      applicationId: true,
      application: {
        select: {
          id: true,
          status: true,
          residentId: true,
          tenantEmail: true,
          tenantPhone: true,
        },
      },
    },
  });

  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const phoneParam = url.searchParams.get("phone");
  const userEmail = (session.user as any).email as string | undefined;

  const ownsApplication =
    vehicle.application.residentId === userId ||
    vehicle.application.tenantEmail === userEmail ||
    vehicle.application.tenantPhone === phoneParam;

  if (!ownsApplication) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (vehicle.application.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only draft applications can be edited" },
      { status: 409 }
    );
  }

  const updated = await prisma.tenantVehicle.update({
    where: { id: vehicleId },
    data: {
      vehicleType: vehicleType ?? null,
      registrationNo: registrationNo ?? null,
      stickerRfidNo: stickerRfidNo ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "UPDATE",
      entity: "TenantVehicle",
      entityId: vehicleId,
      meta: { applicationId: id, vehicleType, registrationNo },
    },
  });

  return NextResponse.json({ vehicle: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const { id } = await params;
  const userId = String((session.user as any).id ?? "");

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");
  const phoneParam = url.searchParams.get("phone");

  if (!vehicleId) {
    return NextResponse.json({ error: "vehicleId is required" }, { status: 400 });
  }

  const vehicle = await prisma.tenantVehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      applicationId: true,
      application: {
        select: {
          id: true,
          status: true,
          residentId: true,
          tenantEmail: true,
          tenantPhone: true,
        },
      },
    },
  });

  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userEmail = (session.user as any).email as string | undefined;

  const ownsApplication =
    vehicle.application.residentId === userId ||
    vehicle.application.tenantEmail === userEmail ||
    vehicle.application.tenantPhone === phoneParam;

  if (!ownsApplication) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (vehicle.application.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only draft applications can be edited" },
      { status: 409 }
    );
  }

  await prisma.tenantVehicle.delete({
    where: { id: vehicleId },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "DELETE",
      entity: "TenantVehicle",
      entityId: vehicleId,
      meta: { applicationId: id },
    },
  });

  return NextResponse.json({ success: true });
}
