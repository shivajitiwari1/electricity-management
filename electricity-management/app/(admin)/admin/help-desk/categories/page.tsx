import { auth } from "@/auth";
import { redirect } from "next/navigation";
import HelpDeskCategoriesManager from "@/components/admin/help-desk-categories-manager";
import { guardPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Complaint Categories · Oasis Venetia Heights",
};

export default async function HelpDeskCategoriesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as any)?.role as string;
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/admin/dashboard");

  const guard = await guardPermission(session as any, "help-desk", "canRead");
  if (guard) redirect("/admin/dashboard");

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage complaint categories and sub-categories used by the Help Desk.
        </p>
      </div>
      <HelpDeskCategoriesManager />
    </main>
  );
}
