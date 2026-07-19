import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcryptjs from "bcryptjs";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;
        if (!user.isActive) return null;

        const valid = await bcryptjs.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;

        let permissions: Record<string, { canRead: boolean; canWrite: boolean; canDelete: boolean }> = {};
        if (user.role === "MANAGER") {
          const rows = await prisma.permission.findMany({ where: { role: "MANAGER" } });
          permissions = Object.fromEntries(
            rows.map((r) => [r.page, { canRead: r.canRead, canWrite: r.canWrite, canDelete: r.canDelete }])
          );
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          permissions,
        };
      },
    }),
  ],
});
