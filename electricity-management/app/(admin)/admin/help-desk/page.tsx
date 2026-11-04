import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminHelpDeskList from "@/components/admin/help-desk-list";
import HelpDeskModuleToggle from "@/components/admin/help-desk-toggle";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Open Tickets · Oasis Venetia Heights",
};

export default async function AdminHelpDeskPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as any)?.role as string;
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/admin/dashboard");

  const guard = await guardPermission(session as any, "help-desk", "canRead");
  if (guard) redirect("/admin/dashboard");

  const siteConfig = await prisma.siteConfig.findUnique({
    where: { id: "singleton" },
    select: { helpDeskEnabled: true },
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Help Desk</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage resident complaints, track status and view job cards.
        </p>
      </div>
      <HelpDeskModuleToggle initialEnabled={siteConfig?.helpDeskEnabled ?? false} />
      <AdminHelpDeskList />
    </main>
  );
}
