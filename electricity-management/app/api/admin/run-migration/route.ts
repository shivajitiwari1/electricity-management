import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`Payment\` MODIFY COLUMN \`method\` ENUM('ONLINE','CASH','UPI','NEFT','RTGS','CHEQUE') NOT NULL`
    );
    return NextResponse.json({ success: true, message: "PaymentMethod enum updated" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
