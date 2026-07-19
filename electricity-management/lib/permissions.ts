import { NextResponse } from "next/server";

export type PermissionsMap = Record<string, {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}>;

export type PermissionAction = "canRead" | "canWrite" | "canDelete";

export async function guardPermission(
  session: { user: { role?: string; permissions?: PermissionsMap } } | null,
  page: string,
  action: PermissionAction
): Promise<NextResponse | null> {
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role as string;

  if (role === "ADMIN") return null;

  if (role === "RESIDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // MANAGER: check permissions embedded in JWT at login
  const permissions = (session.user as any).permissions as PermissionsMap ?? {};
  const pagePerm = permissions[page];

  if (!pagePerm || !pagePerm[action]) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
