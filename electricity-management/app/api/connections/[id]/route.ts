import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { guardPermission } from "@/lib/permissions";

const updateConnectionSchema = z.object({
  meterNo: z.string().optional(),
  sanctionedLoad: z.number().positive().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const connection = await prisma.connection.findUnique({
    where: { id },
    include: {
      resident: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      meterReadings: { orderBy: { readingDate: "desc" } },
      bills: {
        orderBy: { billDate: "desc" },
        include: { payments: { orderBy: { paymentDate: "desc" }, take: 1 } },
      },
    },
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  return NextResponse.json(connection);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "connections", "canWrite");
  if (guard) return guard;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { meterNo, sanctionedLoad, status } = parsed.data;

  const existing = await prisma.connection.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const connection = await tx.connection.update({
      where: { id },
      data: {
        ...(meterNo !== undefined ? { meterNo } : {}),
        ...(sanctionedLoad !== undefined ? { sanctionedLoad } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      include: {
        resident: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "UPDATE",
        entity: "Connection",
        entityId: id,
        meta: { meterNo, sanctionedLoad, status },
      },
    });

    return connection;
  });

  revalidateTag("connections", {});
  revalidateTag("residents", {});
  return NextResponse.json(updated);
}
