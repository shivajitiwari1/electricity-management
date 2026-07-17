import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateResetToken } from "@/lib/reset-token";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email } = body as { email?: string };
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "RESIDENT") {
    return NextResponse.json({ error: "No account found with this email address" }, { status: 404 });
  }

  try {
    const token = generateResetToken(user.id);
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password/${token}`;
    const html = passwordResetEmail({
      residentName: user.name ?? "Resident",
      resetUrl,
    });
    await sendEmail(email, "Reset Your Password — Oasis Venetia Heights", html);
  } catch (err) {
    console.error("Reset email failed:", err);
    return NextResponse.json({ error: "Failed to send reset email. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
