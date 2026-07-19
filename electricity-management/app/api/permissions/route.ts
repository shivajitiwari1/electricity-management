import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { revalidateTag } from "next/cache";

const permissionEntrySchema = z.object({
  page: z.string(),
  canRead: z.boolean(),
  canWrite: z.boolean(),
  canDelete: z.boolean(),
});

const updatePermissionsSchema = z.object({
  permissions: z.array(permissionEntrySchema),
});

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permissions = await prisma.permission.findMany({
    orderBy: [{ role: "asc" }, { page: "asc" }],
  });

  return NextResponse.json(permissions);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updatePermissionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    parsed.data.permissions.map(({ page, canRead, canWrite, canDelete }) =>
      prisma.permission.update({
        where: { role_page: { role: "MANAGER", page } },
        data: { canRead, canWrite, canDelete },
      })
    )
  );

  revalidateTag("permissions", {});
  return NextResponse.json({ success: true });
}
