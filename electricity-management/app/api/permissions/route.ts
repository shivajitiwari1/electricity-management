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

  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ role: "asc" }, { page: "asc" }],
    });

    return NextResponse.json(permissions);
  } catch (error: any) {
    console.error("Permissions GET error:", error?.message ?? error);
    return NextResponse.json(
      { error: "Failed to load permissions" },
      { status: 500 }
    );
  }
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

  try {
    await prisma.$transaction(async (tx) => {
      for (const { page, canRead, canWrite, canDelete } of parsed.data.permissions) {
        await tx.permission.update({
          where: { role_page: { role: "MANAGER", page } },
          data: { canRead, canWrite, canDelete },
        });
      }
    }, { maxWait: 10000, timeout: 30000 });
  } catch (error: any) {
    console.error("Permissions PUT error:", error);
    const detail = String(error?.message ?? (typeof error === "string" ? error : "Unknown error")).slice(0, 2000);
    return NextResponse.json(
      { error: `Failed to save permissions: ${detail}` },
      { status: 500 }
    );
  }

  revalidateTag("permissions", "max");
  return NextResponse.json({ success: true });
}
