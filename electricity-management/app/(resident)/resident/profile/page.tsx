import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormCardSkeleton } from "@/components/ui/page-skeleton";
import { User, Home, Zap, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value ?? "—"}</span>
    </div>
  );
}

async function ResidentProfileData() {
  const session = await auth();
  if (!session) redirect("/login");

  const resident = await prisma.resident.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { name: true, email: true } }, connections: true },
  });

  if (!resident) redirect("/login");

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InfoRow label="Full Name" value={resident.user.name} />
            <InfoRow label="Email" value={resident.user.email} />
            <InfoRow label="Phone" value={resident.phone} />
            <InfoRow label="Resident Number" value={resident.residentNumber} />
          </div>
        </CardContent>
      </Card>

      {resident.connections.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-gray-400 text-sm">No active connections found.</CardContent></Card>
      ) : (
        resident.connections.map((conn, index) => (
          <Card key={conn.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Home className="h-4 w-4 text-blue-600" />
                Connection {resident.connections.length > 1 ? `#${index + 1}` : "Details"}
                <span className="ml-auto">
                  <Badge className={conn.status === "ACTIVE" ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-gray-100 text-gray-700 hover:bg-gray-100"}>
                    {conn.status}
                  </Badge>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Home className="h-4 w-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Flat Details</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    <InfoRow label="Flat No" value={conn.flatNo} />
                    <InfoRow label="Tower" value={`Tower ${conn.tower}`} />
                    <InfoRow label="Floor" value={conn.floor} />
                    <InfoRow label="Unit Type" value={conn.unitType} />
                    <InfoRow label="Unit Area" value={`${conn.unitArea} sq.ft`} />
                  </div>
                </div>
                <div className="sm:col-span-2 border-t pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Electrical Connection</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    <InfoRow label="Meter No" value={conn.meterNo} />
                    <InfoRow label="Sanctioned Load" value={`${Number(conn.sanctionedLoad)} kW`} />
                    <InfoRow label="Connected Since" value={new Date(conn.connectedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
        <Mail className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Need to update your details?</p>
          <p className="mt-0.5 text-blue-600">Profile and connection information is managed by the admin. Please contact the Oasis Venetia Heights management office for any changes.</p>
        </div>
      </div>
    </>
  );
}

export default function ResidentProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Your account and connection details (managed by admin)</p>
      </div>
      <Suspense fallback={<FormCardSkeleton fields={4} />}>
        <ResidentProfileData />
      </Suspense>
    </div>
  );
}
