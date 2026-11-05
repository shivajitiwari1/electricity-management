import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import TenantVerificationForm from "@/components/resident/tenant-verification-form";

export const dynamic = "force-dynamic";

export default async function ResidentNewTenantVerificationPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any).role as string;
  if (role !== "RESIDENT") {
    redirect("/login");
  }

  const userId = String((session.user as any).id ?? "");
  const resident = await prisma.resident.findUnique({
    where: { userId },
    select: { id: true },
  });

  const connections = await prisma.connection.findMany({
    where: { residentId: resident?.id ?? "" },
    select: { id: true, flatNo: true, tower: true },
    orderBy: { flatNo: "asc" },
  });

  if (connections.length === 0) {
    redirect("/resident/dashboard");
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">New Application</h1>
      <p className="text-muted-foreground mb-6">
        Submit a tenant verification application for one of your flats.
      </p>
      <TenantVerificationForm connections={connections} />
    </div>
  );
}
