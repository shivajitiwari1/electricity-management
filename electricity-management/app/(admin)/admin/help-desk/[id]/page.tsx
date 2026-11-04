import { auth } from "@/auth";
import { redirect } from "next/navigation";
import HelpDeskTicketDetail from "@/components/help-desk/ticket-detail";
import { guardPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Complaint Detail · Oasis Venetia Heights",
};

export default async function AdminHelpDeskTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as any)?.role as string;
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/admin/dashboard");

  const guard = await guardPermission(session as any, "help-desk", "canRead");
  if (guard) redirect("/admin/dashboard");

  const { id } = await params;
  if (!id) redirect("/admin/help-desk");

  return (
    <main className="p-4 md:p-6">
      <HelpDeskTicketDetail ticketId={id} role={role === "ADMIN" ? "ADMIN" : "MANAGER"} />
    </main>
  );
}
