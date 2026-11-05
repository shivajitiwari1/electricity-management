export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TenantVerificationLandingPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any).role as string;
  if (role !== "RESIDENT") {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tenant Verification</h1>
        <p className="text-muted-foreground">
          Apply for tenant verification for your flat at Oasis Venetia Heights. Submit your
          documents, complete police verification, and get management approval.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Who should apply</CardTitle>
            <CardDescription>
              Any tenant renting a flat in Oasis Venetia Heights must complete verification before
              occupancy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              • Tenants applying for new tenancy<br />
              • Existing tenants renewing agreement<br />
              • Family members/co-occupants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Required documents</CardTitle>
            <CardDescription>
              Prepare these before starting your application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              • ID proof (Aadhaar/Passport/Voter ID)<br />
              • Recent passport-size photograph<br />
              • Rent agreement / lease deed<br />
              • Police verification acknowledgement<br />
              • Emergency contact details
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Process</CardTitle>
            <CardDescription>
              Steps from application to approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              1. Submit application online<br />
              2. Flat owner reviews & approves<br />
              3. Management conducts final review<br />
              4. Receive approved certificate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Link href="/resident/tenant-verification/register" className="flex items-center">
          <Button size="lg" className="w-full md:w-auto">
            Start Application
          </Button>
        </Link>
      </div>
    </div>
  );
}
