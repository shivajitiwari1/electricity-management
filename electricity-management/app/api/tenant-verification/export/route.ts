export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardTenantVerificationEnabled } from "@/lib/tenant-verification-config";
import { formatStatus } from "@/lib/tenant-verification-format";
import ExcelJS from "exceljs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const role = (session.user as any).role as string;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const guard = await guardPermission(
    session as any,
    "tenant-verification",
    "canRead"
  );
  if (guard) return guard;

  const applications = await prisma.tenantApplication.findMany({
    include: {
      resident: { include: { user: { select: { name: true, email: true } } } },
      connection: { select: { flatNo: true, tower: true } },
      _count: { select: { documents: true, family: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Oasis Venetia Heights";
  workbook.title = "Tenant Verification Report";

  const sheet = workbook.addWorksheet("Tenant Applications");
  sheet.columns = [
    { header: "Application Number", key: "applicationNumber", width: 22 },
    { header: "Tenant Name", key: "tenantName", width: 25 },
    { header: "Phone", key: "tenantPhone", width: 18 },
    { header: "Email", key: "tenantEmail", width: 25 },
    { header: "Flat No.", key: "flatNo", width: 12 },
    { header: "Tower", key: "tower", width: 10 },
    { header: "Owner Name", key: "ownerName", width: 25 },
    { header: "Status", key: "status", width: 22 },
    { header: "Documents", key: "documents", width: 12 },
    { header: "Family Members", key: "family", width: 12 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];

  for (const app of applications) {
    sheet.addRow({
      applicationNumber: app.applicationNumber,
      tenantName: app.tenantName,
      tenantPhone: app.tenantPhone,
      tenantEmail: app.tenantEmail ?? "",
      flatNo: app.connection?.flatNo ?? "",
      tower: app.connection?.tower ?? "",
      ownerName: app.resident?.user?.name ?? "",
      status: formatStatus(app.status as any),
      documents: app._count.documents,
      family: app._count.family,
      createdAt: app.createdAt.toISOString(),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tenant-verification-${date}.xlsx"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
