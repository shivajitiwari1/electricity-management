import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MaintenanceBillsTable from "@/components/admin/maintenance-bills-table";
import type { MaintenanceBillRow } from "@/components/admin/maintenance-bills-table";

export const dynamic = "force-dynamic";

export default async function MaintenanceBillsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user as any)?.role as string;
  if (role !== "ADMIN") redirect("/admin/dashboard");

  const canWrite = true;
  const canDelete = true;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [year, mon] = currentMonth.split("-").map(Number);
  const dateFilter = { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) };

  const bills = await prisma.maintenanceBill.findMany({
    where: { billDate: dateFilter },
    include: {
      connection: {
        include: { resident: { include: { user: { select: { name: true } } } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const initialData: MaintenanceBillRow[] = bills.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    flatNo: b.connection.flatNo,
    tower: b.connection.tower,
    residentName: b.connection.resident?.user?.name ?? "—",
    unitArea: b.unitArea,
    amount: b.amount.toString(),
    previousDue: (b.previousDue ?? 0).toString(),
    paidAmount: b.paidAmount.toString(),
    interestCharge: b.interestCharge.toString(),
    dueDate: b.dueDate.toISOString(),
    billDate: b.billDate.toISOString(),
    billingPeriodStart: b.billingPeriodStart.toISOString(),
    billingPeriodEnd: b.billingPeriodEnd.toISOString(),
    ratePerSqFt: b.ratePerSqFt.toString(),
    status: b.status,
  }));

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Maintenance Bills</h1>
        <p className="text-muted-foreground">Society maintenance charges for all flats</p>
      </div>
      <MaintenanceBillsTable initialData={initialData} canWrite={canWrite} canDelete={canDelete} />
    </main>
  );
}
