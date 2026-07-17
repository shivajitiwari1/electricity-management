import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcryptjs from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: "admin@oasis.local" },
      select: { id: true, email: true, password: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ status: "error", message: "Admin user not found in DB" });
    }

    const passwordValid = await bcryptjs.compare("Admin@123", user.password);

    return NextResponse.json({
      status: "ok",
      userFound: true,
      email: user.email,
      role: user.role,
      passwordValid,
      passwordHashPrefix: user.password.substring(0, 10) + "...",
    });
  } catch (err) {
    return NextResponse.json({
      status: "error",
      message: String(err),
    });
  }
}
