import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = (req.auth?.user as any)?.role as string | undefined;
  const isLoggedIn = !!req.auth;

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
  }

  // Admin area — ADMIN and MANAGER allowed
  if (
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
