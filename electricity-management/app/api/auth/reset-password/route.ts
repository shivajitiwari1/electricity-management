import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyResetToken } from "@/lib/reset-token";
import bcryptjs from "bcryptjs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, password } = body as { token?: string; password?: string };
  if (!token || !password) {
    return NextResponse.json({ error: "Token and password required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const result = verifyResetToken(token);
  if (!result) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: result.userId } });
  if (!user || user.role !== "RESIDENT") {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const hashed = await bcryptjs.hash(password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

  return NextResponse.json({ success: true });
}
