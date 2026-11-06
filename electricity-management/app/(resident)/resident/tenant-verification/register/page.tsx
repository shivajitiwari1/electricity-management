export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ApplicationWizard from "@/components/tenant-verification/application-wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnforcedChannels } from "@/lib/tenant-verification-config";

export default async function TenantVerificationRegisterPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any).role as string;
  if (role !== "RESIDENT") {
    redirect("/login");
  }

  // Get connections (flats) for this resident
  const userId = String((session.user as any).id ?? "");
  const resident = await prisma.resident.findUnique({
    where: { userId },
    select: {
      id: true,
      phone: true,
      tenantPhone: true,
      connections: {
        select: {
          id: true,
          flatNo: true,
          tower: true,
        },
        orderBy: { flatNo: "asc" },
      },
    },
  });

  const connections = resident?.connections || [];
  const phone = resident?.phone || resident?.tenantPhone || "";

  // Only require verification for channels the admin enabled *and* that can deliver.
  let verificationChannels = { email: false, phone: false };
  try {
    verificationChannels = await getEnforcedChannels();
  } catch {
    verificationChannels = { email: false, phone: false };
  }

  if (connections.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>No Flats Available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No flats are registered under your name. Please contact the society office to
              register your flat before applying for tenant verification.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">New Application</h1>
        <p className="text-muted-foreground">
          Complete the tenant verification application. You can save your progress and return later.
        </p>
      </div>

      <ApplicationWizard
        connections={connections}
        phone={phone}
        verificationChannels={verificationChannels}
      />
    </div>
  );
}
