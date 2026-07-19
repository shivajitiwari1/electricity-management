import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PermissionsMatrix from "@/components/admin/permissions-matrix";

export default async function PermissionsPage() {
  const session = await auth();
  if (!session || (session.user as any).role !== "ADMIN") redirect("/admin/dashboard");

  const permissions = await prisma.permission.findMany({
    orderBy: [{ role: "asc" }, { page: "asc" }],
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Permissions</h1>
        <p className="text-muted-foreground text-sm">
          Control what the Manager role can read, write, and delete. Changes take effect on Manager's next login.
        </p>
      </div>
      <PermissionsMatrix initialPermissions={JSON.parse(JSON.stringify(permissions))} />
    </div>
  );
}
