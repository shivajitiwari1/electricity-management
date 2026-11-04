import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HelpDeskNewTicketForm from "@/components/resident/help-desk-new-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Log New Complaint · Oasis Venetia Heights",
};

export default async function ResidentHelpDeskNewPage() {
  const session = await auth();
  if (!session || (session.user as any).role !== "RESIDENT") redirect("/login");

  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
  if (siteConfig?.helpDeskEnabled === false) redirect("/resident/dashboard");

  return (
    <main className="p-4 md:p-6">
      <HelpDeskNewTicketForm />
    </main>
  );
}
