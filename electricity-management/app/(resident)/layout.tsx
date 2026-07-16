import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ResidentNav from "@/components/resident/top-nav";

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "RESIDENT") redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <ResidentNav user={session.user} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
