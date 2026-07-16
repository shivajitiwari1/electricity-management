import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateResidentSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.email().optional(),
  // connection fields
  connectionId: z.string().optional(),
  tower: z.string().min(1).optional(),
  floor: z.string().min(1).optional(),
  flatNo: z.string().min(1).optional(),
  unitType: z.string().min(1).optional(),
  unitArea: z.number().positive().optional(),
  sanctionedLoad: z.number().positive().optional(),
  meterNo: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const resident = await prisma.resident.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      },
      connections: {
        include: {
          meterReadings: { orderBy: { readingDate: "desc" } },
          bills: { orderBy: { billDate: "desc" }, include: { payment: true } },
        },
      },
    },
  });

  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  return NextResponse.json(resident);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateResidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, phone, email, connectionId, tower, floor, flatNo, unitType, unitArea, sanctionedLoad, meterNo } = parsed.data;

  const resident = await prisma.resident.findUnique({
    where: { id },
    include: { user: true, connections: true },
  });

  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  // Check email uniqueness if being changed
  if (email && email !== resident.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  // Check flatNo uniqueness if being changed
  if (flatNo) {
    const connId = connectionId ?? resident.connections[0]?.id;
    const existingFlat = await prisma.connection.findUnique({ where: { flatNo } });
    if (existingFlat && existingFlat.id !== connId) {
      return NextResponse.json({ error: "Flat number already in use" }, { status: 409 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (name !== undefined || email !== undefined) {
      await tx.user.update({
        where: { id: resident.userId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(email !== undefined ? { email } : {}),
        },
      });
    }

    if (phone !== undefined) {
      await tx.resident.update({ where: { id }, data: { phone } });
    }

    // Update connection fields if any provided
    const hasConnUpdate = tower !== undefined || floor !== undefined || flatNo !== undefined ||
      unitType !== undefined || unitArea !== undefined || sanctionedLoad !== undefined || meterNo !== undefined;
    if (hasConnUpdate) {
      const connId = connectionId ?? resident.connections[0]?.id;
      if (connId) {
        await tx.connection.update({
          where: { id: connId },
          data: {
            ...(tower !== undefined ? { tower } : {}),
            ...(floor !== undefined ? { floor } : {}),
            ...(flatNo !== undefined ? { flatNo } : {}),
            ...(unitType !== undefined ? { unitType } : {}),
            ...(unitArea !== undefined ? { unitArea } : {}),
            ...(sanctionedLoad !== undefined ? { sanctionedLoad } : {}),
            ...(meterNo !== undefined ? { meterNo: meterNo || null } : {}),
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Resident",
        entityId: id,
        meta: { name, phone, email, tower, floor, flatNo, unitType, unitArea, sanctionedLoad, meterNo },
      },
    });

    return tx.resident.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
        connections: true,
      },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const resident = await prisma.resident.findUnique({
    where: { id },
    include: { connections: true },
  });

  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // Soft-delete: deactivate all connections
    await tx.connection.updateMany({
      where: { residentId: id },
      data: { status: "INACTIVE" },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DEACTIVATE",
        entity: "Resident",
        entityId: id,
        meta: {
          connectionIds: resident.connections.map((c) => c.id),
          residentNumber: resident.residentNumber,
        },
      },
    });
  });

  return NextResponse.json({ success: true });
}
