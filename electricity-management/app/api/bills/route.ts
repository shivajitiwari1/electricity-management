import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { calculateBill, generateBillNumber } from "@/lib/billing";
import { selectCarriedForwardBills } from "@/lib/carry-forward";
import { sendEmail } from "@/lib/email";
import { billGeneratedEmail } from "@/lib/email-templates";
import { generatePaymentToken } from "@/lib/payment-token";
import { generateBillPdf, BillData } from "@/lib/pdf";
import { generateUpiQrDataUrl } from "@/lib/qr";

const generateBillSchema = z.object({
  meterReadingId: z.string().min(1),
  billDate: z.string().min(1),
  billingPeriodStart: z.string().min(1),
  billingPeriodEnd: z.string().min(1),
  previousDues: z.number().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tower = searchParams.get("tower");
  const flatNo = searchParams.get("flatNo");
  const month = searchParams.get("month"); // YYYY-MM
  const status = searchParams.get("status");

  const validStatuses = ["PENDING", "PAID", "OVERDUE", "PARTIAL", "CARRIED_FORWARD"];
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
      ...(status ? { status: status as "PENDING" | "PAID" | "OVERDUE" | "PARTIAL" | "CARRIED_FORWARD" } : {}),
      ...(dateFilter ? { billDate: dateFilter } : {}),
      ...(flatNo || tower
        ? {
            connection: {
              ...(flatNo ? { flatNo } : {}),
              ...(tower ? { tower } : {}),
            },
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
      payments: true,
    },
    orderBy: { billDate: "desc" },
  });

  return NextResponse.json(bills);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "bills", "canWrite");
  if (guard) return guard;

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

  // Duplicate guard: same connection + same billing period
  const existingPeriodBill = await prisma.bill.findFirst({
    where: {
      connectionId: meterReading.connectionId,
      billingPeriodStart: new Date(billingPeriodStart),
      billingPeriodEnd: new Date(billingPeriodEnd),
    },
  });
  if (existingPeriodBill) {
    return NextResponse.json(
      { error: `A bill already exists for this flat and billing period (${existingPeriodBill.billNumber})` },
      { status: 409 }
    );
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

  // Generate a unique bill number - append suffix if base number already exists
  const baseBillNumber = generateBillNumber(meterReading.connection.flatNo, billDateObj);
  const existingCount = await prisma.bill.count({
    where: { billNumber: { startsWith: baseBillNumber } },
  });
  const billNumber = existingCount === 0 ? baseBillNumber : `${baseBillNumber}-${existingCount + 1}`;

  const billResult = await prisma.$transaction(async (tx) => {
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

    // The carried-forward amount is now part of this bill's total, so the older
    // bills it covers must stop being separately payable — otherwise the same
    // dues are counted twice in every pending / overdue / outstanding figure.
    let carriedForwardBillIds: string[] = [];
    if (prevDues.greaterThan(0)) {
      const openOlderBills = await tx.bill.findMany({
        where: {
          connectionId: meterReading.connectionId,
          id: { not: newBill.id },
          status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
          billDate: { lt: billDateObj },
        },
        select: { id: true, totalAmount: true, paidAmount: true },
        orderBy: { billDate: "asc" },
      });

      carriedForwardBillIds = selectCarriedForwardBills(
        prevDues.toNumber(),
        openOlderBills.map((b) => ({
          id: b.id,
          balance: b.totalAmount.minus(b.paidAmount).toNumber(),
        }))
      );

      if (carriedForwardBillIds.length > 0) {
        await tx.bill.updateMany({
          where: { id: { in: carriedForwardBillIds } },
          data: { status: "CARRIED_FORWARD", carriedForwardToId: newBill.id },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "CREATE",
        entity: "Bill",
        entityId: newBill.id,
        meta: {
          billNumber,
          connectionId: meterReading.connectionId,
          meterReadingId,
          totalAmount: calculation.totalAmount.toNumber(),
          previousDues: prevDues.toNumber(),
          carriedForwardBillIds,
        },
      },
    });

    return newBill;
  }).catch((err: unknown) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { __error: "A bill already exists for this flat and billing period." } as const;
    }
    console.error("Bill creation error:", err);
    return { __error: "Failed to create bill" } as const;
  });

  if ("__error" in billResult) {
    return NextResponse.json({ error: billResult.__error }, { status: 409 });
  }

  const bill = billResult;

  // Send email with PDF attachment - don't fail bill creation if email fails
  try {
    const residentEmail = bill.connection.resident.user.email;
    const residentName = bill.connection.resident.user.name ?? "Resident";
    const payToken = generatePaymentToken(bill.id);
    const payUrl = `${process.env.NEXTAUTH_URL}/pay/${payToken}`;

    const fmtDate = (d: string) =>
      new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    const html = billGeneratedEmail({
      residentName,
      flatNo: bill.connection.flatNo,
      billNumber: bill.billNumber,
      billingPeriod: `${fmtDate(billingPeriodStart)} - ${fmtDate(billingPeriodEnd)}`,
      totalAmount: calculation.totalAmount.toFixed(2),
      dueDate: calculation.dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      payUrl,
    });

    // Build PDF bill data for attachment
    const billData: BillData = {
      flatNo: bill.connection.flatNo,
      residentName,
      billDate: bill.billDate,
      dueDate: bill.dueDate,
      billingPeriodStart: bill.billingPeriodStart,
      billingPeriodEnd: bill.billingPeriodEnd,
      sanctionedLoad: bill.connection.sanctionedLoad.toNumber(),
      unitArea: bill.connection.unitArea,
      ncplPrevious: meterReading.ncplPrevious.toNumber(),
      ncplCurrent: meterReading.ncplCurrent.toNumber(),
      ncplUnits: bill.ncplUnits.toNumber(),
      dgPrevious: meterReading.dgPrevious.toNumber(),
      dgCurrent: meterReading.dgCurrent.toNumber(),
      dgUnits: meterReading.dgUnits.toNumber(),
      ratePerUnit: bill.ratePerUnit.toNumber(),
      ncplCharge: bill.ncplCharge.toNumber(),
      dgCharge: bill.dgCharge.toNumber(),
      fixedCharge: bill.fixedCharge.toNumber(),
      previousDues: bill.previousDues.toNumber(),
      totalAmount: bill.totalAmount.toNumber(),
      billNumber: bill.billNumber,
    };

    const [pdfBuffer, qrDataUrl] = await Promise.all([
      generateBillPdf(billData),
      generateUpiQrDataUrl(calculation.totalAmount.toNumber()),
    ]);

    const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ""), "base64");

    await sendEmail(residentEmail, `Electricity Bill - ${bill.billNumber}`, html, [
      {
        filename: `bill-${bill.billNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
      {
        filename: "qr.png",
        content: qrBuffer,
        contentType: "image/png",
        cid: "upi-qr",
      },
    ]);
  } catch (emailErr) {
    console.error("Failed to send bill email:", emailErr);
  }

  revalidateTag("bills", {});
  revalidateTag("dashboard", {});
  revalidateTag("payments", {});
  revalidateTag("reports", {});
  revalidateTag("meter-readings", {});
  return NextResponse.json(bill, { status: 201 });
}
