"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Plug, Gauge, FileText,
  CreditCard, BarChart3, Settings, LogOut, Menu,
  Zap, Building2, ShieldCheck, UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import type { PermissionsMap } from "@/lib/permissions";

const NAV_ITEMS = [
  { href: "/admin/dashboard",      label: "Dashboard",     icon: LayoutDashboard, pageId: "dashboard" },
  { href: "/admin/residents",      label: "Residents",     icon: Users,           pageId: "residents" },
  { href: "/admin/connections",    label: "Connections",   icon: Plug,            pageId: "connections" },
  { href: "/admin/meter-readings", label: "Meter Readings",icon: Gauge,           pageId: "meter-readings" },
  { href: "/admin/bills",          label: "Bills",         icon: FileText,        pageId: "bills" },
  { href: "/admin/payments",       label: "Payments",      icon: CreditCard,      pageId: "payments" },
  { href: "/admin/reports",        label: "Reports",       icon: BarChart3,       pageId: "reports" },
  { href: "/admin/rates",          label: "Rates",         icon: Settings,        pageId: "rates" },
  { href: "/admin/flats",          label: "Flat Info",     icon: Building2,       pageId: "flat-info" },
];

const ADMIN_ONLY_ITEMS = [
  { href: "/admin/users",          label: "Users",         icon: UserCog,         pageId: "users" },
  { href: "/admin/permissions",    label: "Permissions",   icon: ShieldCheck,     pageId: "permissions" },
];

interface Props {
  user: { name?: string | null; email?: string | null };
  role: string;
  permissions: PermissionsMap;
}

function NavLinks({ pathname, role, permissions, onNavigate }: {
  pathname: string;
  role: string;
  permissions: PermissionsMap;
  onNavigate?: () => void;
}) {
  const isAdmin = role === "ADMIN";

  const visibleItems = NAV_ITEMS.filter(({ pageId }) => {
    if (isAdmin) return true;
    return permissions[pageId]?.canRead === true;
  });

  const allItems = isAdmin ? [...visibleItems, ...ADMIN_ONLY_ITEMS] : visibleItems;

  return (
    <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
      {allItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ user, role, permissions, onNavigate }: Props & { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <Zap className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight">Oasis Venetia Heights</p>
            <p className="text-xs text-muted-foreground">{role === "ADMIN" ? "Admin Panel" : "Manager Panel"}</p>
          </div>
        </div>
      </div>

      <NavLinks pathname={pathname} role={role} permissions={permissions} onNavigate={onNavigate} />

      <Separator />

      <div className="px-3 py-3 space-y-1">
        <div className="flex items-center justify-between px-1 py-1">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export default function SidebarNav({ user, role, permissions }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center justify-between px-4 bg-card border-b border-border shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground">Oasis Venetia Heights</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 border-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent user={user} role={role} permissions={permissions} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="hidden md:flex w-64 h-full shrink-0 flex-col">
        <SidebarContent user={user} role={role} permissions={permissions} />
      </div>
    </>
  );
}
