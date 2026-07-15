import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import { calculateBill, generateBillNumber } from "@/lib/billing";
import { sendEmail } from "@/lib/email";
import { billGeneratedEmail } from "@/lib/email-templates";

const generateBillSchema = z.object({
  meterReadingId: z.string().min(1),
  billDate: z.string().min(1),
  billingPeriodStart: z.string().min(1),
  billingPeriodEnd: z.string().min(1),
  previousDues: z.number().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tower = searchParams.get("tower");
  const month = searchParams.get("month"); // YYYY-MM
  const status = searchParams.get("status");

  const validStatuses = ["PENDING", "PAID", "OVERDUE"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  // Build date range filter for month
  let dateFilter: { gte?: Date; lt?: Date } | undefined;
  if (month) {
    const [year, mon] = month.split("-").map(Number);
    if (!year || !mon || mon < 1 || mon > 12) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
    }
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);
    dateFilter = { gte: start, lt: end };
  }

  const bills = await prisma.bill.findMany({
    where: {
      ...(status ? { status: status as "PENDING" | "PAID" | "OVERDUE" } : {}),
      ...(dateFilter ? { billDate: dateFilter } : {}),
      ...(tower
        ? {
            connection: { tower },
          }
        : {}),
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
      meterReading: true,
      payment: true,
    },
    orderBy: { billDate: "desc" },
  });

  return NextResponse.json(bills);
}

export async function POST(req: NextRequest) {
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

  const parsed = generateBillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { meterReadingId, billDate, billingPeriodStart, billingPeriodEnd, previousDues } =
    parsed.data;

  // Duplicate guard
  const existingBill = await prisma.bill.findUnique({
    where: { meterReadingId },
  });
  if (existingBill) {
    return NextResponse.json(
      { error: "A bill already exists for this meter reading" },
      { status: 409 }
    );
  }

  // Fetch meter reading with connection
  const meterReading = await prisma.meterReading.findUnique({
    where: { id: meterReadingId },
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

  if (!meterReading) {
    return NextResponse.json({ error: "Meter reading not found" }, { status: 404 });
  }

  // Fetch latest rate
  const rate = await prisma.rate.findFirst({
    orderBy: { effectiveFrom: "desc" },
  });

  if (!rate) {
    return NextResponse.json({ error: "No rate configuration found" }, { status: 422 });
  }

  const billDateObj = new Date(billDate);
  const prevDues = new Decimal(previousDues ?? 0);

  const calculation = calculateBill({
    ncplUnits: meterReading.ncplUnits,
    ratePerUnit: rate.ncplPerUnit,
    dgCharge: rate.dgFixed,
    fixedPerKw: rate.fixedPerKw,
    sanctionedLoad: meterReading.connection.sanctionedLoad,
    previousDues: prevDues,
    billDate: billDateObj,
  });

  const billNumber = generateBillNumber(meterReading.connection.flatNo, billDateObj);

  const bill = await prisma.$transaction(async (tx) => {
    const newBill = await tx.bill.create({
      data: {
        connectionId: meterReading.connectionId,
        meterReadingId,
        billNumber,
        billDate: billDateObj,
        dueDate: calculation.dueDate,
        billingPeriodStart: new Date(billingPeriodStart),
        billingPeriodEnd: new Date(billingPeriodEnd),
        ncplUnits: meterReading.ncplUnits,
        ratePerUnit: rate.ncplPerUnit,
        ncplCharge: calculation.ncplCharge,
        dgCharge: calculation.dgCharge,
        fixedCharge: calculation.fixedCharge,
        previousDues: prevDues,
        totalAmount: calculation.totalAmount,
        status: "PENDING",
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
        meterReading: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "Bill",
        entityId: newBill.id,
        meta: {
          billNumber,
          connectionId: meterReading.connectionId,
          meterReadingId,
          totalAmount: calculation.totalAmount.toNumber(),
        },
      },
    });

    return newBill;
  });

  // Send email — don't fail bill creation if email fails
  try {
    const residentEmail = bill.connection.resident.user.email;
    const residentName = bill.connection.resident.user.name ?? "Resident";
    const payUrl = `${process.env.NEXTAUTH_URL}/resident/bills/${bill.id}/pay`;

    const html = billGeneratedEmail({
      residentName,
      flatNo: bill.connection.flatNo,
      billNumber: bill.billNumber,
      billingPeriod: `${billingPeriodStart} to ${billingPeriodEnd}`,
      totalAmount: calculation.totalAmount.toFixed(2),
      dueDate: calculation.dueDate.toDateString(),
      payUrl,
    });

    await sendEmail(residentEmail, `Electricity Bill - ${bill.billNumber}`, html);
  } catch (emailErr) {
    console.error("Failed to send bill email:", emailErr);
  }

  return NextResponse.json(bill, { status: 201 });
}
