import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EscalationMatrixManager from "@/components/admin/help-desk-escalation-manager";
import { guardPermission } from "@/lib/permissions";
import type { PermissionsMap } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Escalation Matrix · Oasis Venetia Heights",
};

export default async function HelpDeskEscalationPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as any)?.role as string;
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/admin/dashboard");

  const guard = await guardPermission(session as any, "help-desk", "canRead");
  if (guard) redirect("/admin/dashboard");

  const permissions = ((session.user as any)?.permissions as PermissionsMap | undefined) ?? {};
  const canDelete = role === "ADMIN" || permissions["help-desk"]?.canDelete === true;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Escalation Matrix</h1>
        <p className="text-sm text-gray-500 mt-1">
          Route tickets to the right person when a category and priority is not answered in time.
        </p>
      </div>
      <EscalationMatrixManager canDelete={canDelete} />
    </main>
  );
}
