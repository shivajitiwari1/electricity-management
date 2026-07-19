import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import UsersTable from "@/components/admin/users-table";

export default async function UsersPage() {
  const session = await auth();
  if (!session || (session.user as any).role !== "ADMIN") redirect("/admin/dashboard");

  const users = await prisma.user.findMany({
    where: { role: "MANAGER" },
    select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground text-sm">Manage manager accounts for Oasis Venetia Heights</p>
      </div>
      <UsersTable initialUsers={JSON.parse(JSON.stringify(users))} />
    </div>
  );
}
