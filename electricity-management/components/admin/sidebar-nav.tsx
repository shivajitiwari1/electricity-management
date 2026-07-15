"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Plug,
  Gauge,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/residents", label: "Residents", icon: Users },
  { href: "/admin/connections", label: "Connections", icon: Plug },
  { href: "/admin/meter-readings", label: "Meter Readings", icon: Gauge },
  { href: "/admin/bills", label: "Bills", icon: FileText },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/rates", label: "Rates", icon: Settings },
];

interface Props {
  user: { name?: string | null; email?: string | null };
}

export default function SidebarNav({ user }: Props) {
  const pathname = usePathname();

  return (
    <div className="w-60 bg-white border-r flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="font-bold text-lg leading-tight text-blue-800">Oasis Venetia Heights</h1>
        <p className="text-xs text-gray-500 mt-1">Admin Panel</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <p className="text-sm font-medium truncate">{user.name}</p>
        <p className="text-xs text-gray-500 truncate">{user.email}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
