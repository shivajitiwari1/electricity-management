import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HelpDeskTicketDetail from "@/components/help-desk/ticket-detail";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Complaint · Oasis Venetia Heights",
};

export default async function ResidentHelpDeskTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "RESIDENT") {
    redirect("/login");
  }

  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
  if (siteConfig?.helpDeskEnabled === false) redirect("/resident/dashboard");

  const { id } = await params;
  if (!id) redirect("/resident/help-desk");

  return (
    <main className="p-4 md:p-6">
      <HelpDeskTicketDetail ticketId={id} role="RESIDENT" />
    </main>
  );
}
