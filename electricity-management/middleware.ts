import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = (req.auth?.user as any)?.role;
  const isLoggedIn = !!req.auth;

  // Redirect logged-in users away from login
  if (pathname === "/login" && isLoggedIn) {
    if (role === "ADMIN") return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    return NextResponse.redirect(new URL("/resident/dashboard", req.url));
  }

  // Protect admin routes
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/residents") ||
    pathname.startsWith("/api/connections") ||
    pathname.startsWith("/api/meter-readings") ||
    pathname.startsWith("/api/reports") ||
    pathname.startsWith("/api/rates")
  ) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/login", req.url));
  }

  // Protect resident routes
  if (pathname.startsWith("/resident") || pathname.startsWith("/api/razorpay")) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "RESIDENT") return NextResponse.redirect(new URL("/login", req.url));
  }

  // Protect shared API routes (bills, payments, pdf — both ADMIN and RESIDENT can access)
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
    "/login",
  ],
};
