import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import TenantVerificationList from "@/components/admin/tenant-verification-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ResidentTenantVerificationPage() {
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

  let applications: any[] = [];
  let dbError: string | null = null;
  if (resident) {
    try {
      applications = await prisma.tenantApplication.findMany({
        where: { residentId: resident.id },
        include: {
          connection: { select: { flatNo: true, tower: true } },
          _count: { select: { documents: true, family: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    } catch (error: any) {
      dbError =
        error?.code === "P2021"
          ? "The Tenant Verification database tables are not yet created. Please contact the society office."
          : `Could not load applications: ${error?.message ?? "unknown error"}`;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tenant Verification</h1>
          <p className="text-muted-foreground">
            Submit and track tenant verification applications for your flats.
          </p>
        </div>
        {!dbError && (
          <Link href="/tenant-verification/new">
            <Button>New Application</Button>
          </Link>
        )}
      </div>

      {dbError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Tenant Verification is not fully set up yet</p>
          <p className="mt-1">{dbError}</p>
        </div>
      ) : (
        <TenantVerificationList applications={applications} />
      )}
    </div>
  );
}
