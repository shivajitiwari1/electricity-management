import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

let cachedMaintenance: { value: boolean; expiresAt: number } | null = null;

async function isMaintenanceMode(origin: string): Promise<boolean> {
  const now = Date.now();
  if (cachedMaintenance && now < cachedMaintenance.expiresAt) {
    return cachedMaintenance.value;
  }
  try {
    const res = await fetch(`${origin}/api/site/status`);
    const data = await res.json();
    cachedMaintenance = { value: data.maintenanceMode, expiresAt: now + 10_000 };
    return data.maintenanceMode;
  } catch {
    // On fetch failure, don't block the site
    return false;
  }
}

const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const role = (req.auth?.user as any)?.role as string | undefined;
  const isLoggedIn = !!req.auth;

  // Always allow maintenance page, login page, and status API through (avoid redirect loops)
  if (
    pathname === "/maintenance" ||
    pathname === "/login" ||
    pathname.startsWith("/api/site/status")
  ) {
    return NextResponse.next();
  }

  // ADMIN and MANAGER bypass maintenance gate
  if (role !== "ADMIN" && role !== "MANAGER") {
    const inMaintenance = await isMaintenanceMode(req.nextUrl.origin);
    if (inMaintenance) {
      return NextResponse.redirect(new URL("/maintenance", req.url));
    }
  }

  // Redirect logged-in users away from login
  if (pathname === "/login" && isLoggedIn) {
    if (role === "ADMIN" || role === "MANAGER") {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
    return NextResponse.redirect(new URL("/resident/dashboard", req.url));
  }

  // Admin-only pages — hard-coded, not DB-driven
  if (
    pathname.startsWith("/admin/users") ||
    pathname.startsWith("/admin/permissions") ||
    pathname.startsWith("/api/users") ||
    pathname.startsWith("/api/permissions")
  ) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  // Admin area — ADMIN and MANAGER allowed
  } else if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/residents") ||
    pathname.startsWith("/api/connections") ||
    pathname.startsWith("/api/meter-readings") ||
    pathname.startsWith("/api/reports") ||
    pathname.startsWith("/api/rates") ||
    pathname.startsWith("/api/flat-info")
  ) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "ADMIN" && role !== "MANAGER") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // Resident routes — RESIDENT only
  if (pathname.startsWith("/resident") || pathname.startsWith("/api/razorpay")) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "RESIDENT") return NextResponse.redirect(new URL("/login", req.url));
  }

  // Shared API routes (bills, payments, pdf)
  if (
    pathname.startsWith("/api/bills") ||
    pathname.startsWith("/api/payments") ||
    pathname.startsWith("/api/pdf")
  ) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/resident/:path*",
    "/pay/:path*",
    "/api/residents/:path*",
    "/api/connections/:path*",
    "/api/meter-readings/:path*",
    "/api/bills/:path*",
    "/api/payments/:path*",
    "/api/razorpay/:path*",
    "/api/pdf/:path*",
    "/api/reports/:path*",
    "/api/rates/:path*",
    "/api/flat-info/:path*",
    "/api/users/:path*",
    "/api/permissions/:path*",
    "/login",
  ],
};
