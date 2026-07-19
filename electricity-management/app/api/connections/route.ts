import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tower = searchParams.get("tower");
  const status = searchParams.get("status");

  const validTowers = ["A", "B", "C", "V"];
  const validStatuses = ["ACTIVE", "INACTIVE"];

  if (tower && !validTowers.includes(tower)) {
    return NextResponse.json({ error: "Invalid tower filter" }, { status: 400 });
  }

  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const connections = await prisma.connection.findMany({
    where: {
      ...(tower ? { tower } : {}),
      ...(status ? { status: status as "ACTIVE" | "INACTIVE" } : {}),
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
    orderBy: [{ tower: "asc" }, { floor: "asc" }, { flatNo: "asc" }],
  });

  return NextResponse.json(connections);
}
