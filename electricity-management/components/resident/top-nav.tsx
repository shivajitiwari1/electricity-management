"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Home, FileText, CreditCard, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/resident/dashboard", label: "Dashboard", icon: Home },
  { href: "/resident/bills", label: "Bills", icon: FileText },
  { href: "/resident/payments", label: "Payments", icon: CreditCard },
  { href: "/resident/profile", label: "Profile", icon: User },
];

interface Props {
  user: { name?: string | null; email?: string | null };
}

export default function ResidentNav({ user }: Props) {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b shadow-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Logo / Title */}
        <div className="flex items-center gap-6">
          <span className="font-bold text-blue-800 text-base leading-tight whitespace-nowrap">
            Oasis Venetia Heights
          </span>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  pathname === href || pathname.startsWith(href + "/")
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* User info + Sign Out */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 hidden sm:block truncate max-w-[140px]">
            {user.name}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4 mr-1" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="sm:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
