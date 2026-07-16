import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SidebarNav from "@/components/admin/sidebar-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "ADMIN") redirect("/login");

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav user={session.user} />
      <main className="flex-1 overflow-auto p-4 md:p-6 pt-[72px] md:pt-6">
        {children}
      </main>
    </div>
  );
}
