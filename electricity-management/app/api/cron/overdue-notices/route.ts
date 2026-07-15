import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { overdueNoticeEmail } from "@/lib/email-templates";

export async function GET(req: NextRequest) {
  // Cron secret check — no JWT auth
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all PENDING bills whose dueDate has passed
  const overdueBills = await prisma.bill.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now },
    },
    include: {
      connection: {
        include: {
          resident: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  let processed = 0;

  for (const bill of overdueBills) {
    try {
      // Mark bill as OVERDUE
      await prisma.bill.update({
        where: { id: bill.id },
        data: { status: "OVERDUE" },
      });

      // Send overdue notice email — best effort
      try {
        const residentEmail = bill.connection.resident.user.email;
        const residentName = bill.connection.resident.user.name ?? "Resident";
        const payUrl = `${process.env.NEXTAUTH_URL}/resident/bills/${bill.id}/pay`;

        const html = overdueNoticeEmail({
          residentName,
          flatNo: bill.connection.flatNo,
          billNumber: bill.billNumber,
          totalAmount: bill.totalAmount.toFixed(2),
          dueDate: bill.dueDate.toDateString(),
          payUrl,
        });

        await sendEmail(residentEmail, `Overdue Notice - ${bill.billNumber}`, html);
      } catch (emailErr) {
        console.error(`[cron:overdue-notices] Email failed for bill ${bill.billNumber}:`, emailErr);
      }

      processed++;
    } catch (err) {
      console.error(`[cron:overdue-notices] Error processing bill ${bill.id}:`, err);
    }
  }

  return NextResponse.json({ success: true, processed });
}
