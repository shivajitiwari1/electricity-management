import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AssignmentRulesManager from "@/components/admin/help-desk-assignment-rules-manager";
import { guardPermission } from "@/lib/permissions";
import type { PermissionsMap } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Assignment Rules · Oasis Venetia Heights",
};

export default async function HelpDeskAssignmentRulesPage() {
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
        <h1 className="text-2xl font-bold text-gray-900">Assignment Rules</h1>
        <p className="text-sm text-gray-500 mt-1">
          Route tickets automatically to staff according to category, subcategory and IST time slots.
        </p>
      </div>
      <AssignmentRulesManager canDelete={canDelete} />
    </main>
  );
}
