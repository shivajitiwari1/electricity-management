"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Plug, Gauge, FileText,
  CreditCard, BarChart3, Settings, LogOut, Menu,
  Zap, Building2, ShieldCheck, UserCog, User, Wrench,
  ChevronDown, ChevronRight, Calendar, DollarSign, CalendarClock,
  LifeBuoy, ListChecks, Tag, Shield, Search, X, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const MAINTENANCE_SUB_ITEMS = [
  { href: "/admin/maintenance",          label: "Bills",    icon: FileText,   adminOnly: false },
  { href: "/admin/maintenance/rates",    label: "Rates",    icon: Settings,   adminOnly: true  },
  { href: "/admin/maintenance/payments", label: "Payments", icon: DollarSign, adminOnly: false },
  { href: "/admin/maintenance/advance",  label: "Advance Payments", icon: CalendarClock, adminOnly: false },
  { href: "/admin/maintenance/reports",  label: "Reports",  icon: BarChart3,  adminOnly: false },
];

const HELP_DESK_SUB_ITEMS = [
  { href: "/admin/help-desk",                label: "Open Tickets",     icon: ListChecks, adminOnly: false },
  { href: "/admin/help-desk/categories",     label: "Categories",       icon: Tag,        adminOnly: false },
  { href: "/admin/help-desk/escalation",     label: "Escalation Matrix",icon: Shield,     adminOnly: false },
  { href: "/admin/help-desk/assignment-rules", label: "Assignment Rules", icon: UserCog,   adminOnly: false },
];

const TENANT_VERIFICATION_SUB_ITEMS = [
  { href: "/admin/tenant-verification",               label: "Applications",     icon: User,        adminOnly: false, writeOnly: false },
  { href: "/admin/tenant-verification/new",           label: "Register Tenant",  icon: UserPlus,    adminOnly: false, writeOnly: true },
  { href: "/admin/tenant-verification/settings",      label: "Settings",         icon: Settings,    adminOnly: true,  writeOnly: false },
];

const ADMIN_ONLY_ITEMS = [
  { href: "/admin/users",          label: "Users",         icon: UserCog,         pageId: "users" },
  { href: "/admin/permissions",    label: "Permissions",   icon: ShieldCheck,     pageId: "permissions" },
];

interface Props {
  user: { name?: string | null; email?: string | null };
  role: string;
  permissions: PermissionsMap;
  helpDeskEnabled: boolean;
  tenantVerificationEnabled: boolean;
}

function NavLinks({ pathname, role, permissions, userEmail, helpDeskEnabled, tenantVerificationEnabled, onNavigate }: {
  pathname: string;
  role: string;
  permissions: PermissionsMap;
  userEmail?: string | null;
  helpDeskEnabled: boolean;
  tenantVerificationEnabled: boolean;
  onNavigate?: () => void;
}) {
  const isAdmin = role === "ADMIN";
  const isSuperAdmin = userEmail === "admin@oasis.local";
  const isMaintActive = pathname.startsWith("/admin/maintenance");
  const isHelpDeskActive = pathname.startsWith("/admin/help-desk");
  const isTenantVerificationActive = pathname.startsWith("/admin/tenant-verification");
  const [maintOpen, setMaintOpen] = useState(isMaintActive);
  const [helpDeskOpen, setHelpDeskOpen] = useState(isHelpDeskActive);
  const [tenantVerificationOpen, setTenantVerificationOpen] = useState(isTenantVerificationActive);
  const [query, setQuery] = useState("");

  const showMaintenance = isAdmin || permissions["maintenance"]?.canRead === true;
  const showHelpDesk = helpDeskEnabled
    ? (isAdmin || permissions["help-desk"]?.canRead === true)
    : isSuperAdmin;

  const showTenantVerification = tenantVerificationEnabled
    ? (isAdmin || permissions["tenant-verification"]?.canRead === true)
    : isSuperAdmin;

  const search = query.trim().toLowerCase();
  const isSearching = search.length > 0;

  const searchable = (label: string, href: string) =>
    label.toLowerCase().includes(search) || href.toLowerCase().includes(search);

  const visibleItems = NAV_ITEMS.filter(({ pageId }) => {
    if (isAdmin) return true;
    return permissions[pageId]?.canRead === true;
  });

  const visibleItemsFiltered = isSearching
    ? visibleItems.filter((item) => searchable(item.label, item.href))
    : visibleItems;

  const maintenanceItems = MAINTENANCE_SUB_ITEMS.filter(({ adminOnly }) => !adminOnly || isAdmin);
  const helpDeskItems = HELP_DESK_SUB_ITEMS.filter(({ adminOnly }) => !adminOnly || isAdmin);
  const tenantVerificationItems = TENANT_VERIFICATION_SUB_ITEMS.filter(
    ({ adminOnly, writeOnly }) =>
      (!adminOnly || isAdmin) &&
      (!writeOnly || isAdmin || permissions["tenant-verification"]?.canWrite === true)
  );
  const adminItems = isAdmin ? ADMIN_ONLY_ITEMS : [];

  const groupMatches = (groupLabel: string) => groupLabel.toLowerCase().includes(search);

  const filteredMaintenance =
    isSearching && !groupMatches("Maintenance")
      ? maintenanceItems.filter((item) => searchable(item.label, item.href))
      : maintenanceItems;

  const filteredHelpDesk =
    isSearching && !groupMatches("Help Desk")
      ? helpDeskItems.filter((item) => searchable(item.label, item.href))
      : helpDeskItems;

  const filteredTenantVerification =
    isSearching && !groupMatches("Tenant Verification")
      ? tenantVerificationItems.filter((item) => searchable(item.label, item.href))
      : tenantVerificationItems;

  const filteredAdmin = isSearching
    ? adminItems.filter((item) => searchable(item.label, item.href))
    : adminItems;

  const showMaintenanceGroup =
    showMaintenance && (!isSearching || groupMatches("Maintenance") || filteredMaintenance.length > 0);
  const showHelpDeskGroup =
    showHelpDesk && (!isSearching || groupMatches("Help Desk") || filteredHelpDesk.length > 0);
  const showTenantVerificationGroup =
    showTenantVerification &&
    (!isSearching || groupMatches("Tenant Verification") || filteredTenantVerification.length > 0);
  const showAdminGroup = !isSearching || filteredAdmin.length > 0;

  const noResults =
    isSearching &&
    visibleItemsFiltered.length === 0 &&
    !showMaintenanceGroup &&
    !showHelpDeskGroup &&
    !showTenantVerificationGroup &&
    !showAdminGroup;

  const maintExpanded = isSearching ? true : maintOpen;
  const helpDeskExpanded = isSearching ? true : helpDeskOpen;
  const tenantVerificationExpanded = isSearching ? true : tenantVerificationOpen;

  return (
    <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
      {/* Menu search */}
      <div className="relative pb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search menu…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9 pr-9 h-9"
          autoComplete="off"
          aria-label="Search menu"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {noResults ? (
        <p className="px-3 py-6 text-sm text-muted-foreground text-center">
          No menu item matches “{query.trim()}”.
        </p>
      ) : (
        <>
      {visibleItemsFiltered.map(({ href, label, icon: Icon }) => {
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

      {/* Maintenance expandable group */}
      {showMaintenanceGroup && (
        <div>
          <button
            onClick={() => setMaintOpen((o) => !o)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              isMaintActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Wrench className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Maintenance</span>
            {maintExpanded
              ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          </button>
          {maintExpanded && (
            <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-3">
              {filteredMaintenance.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/admin/maintenance" && pathname.startsWith(href + "/"));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Help Desk expandable group */}
      {showHelpDeskGroup && (
        <div>
          <button
            onClick={() => setHelpDeskOpen((o) => !o)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              isHelpDeskActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <LifeBuoy className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Help Desk</span>
            {helpDeskExpanded
              ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          </button>
          {helpDeskExpanded && (
            <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-3">
              {filteredHelpDesk.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/admin/help-desk" && pathname.startsWith(href + "/"));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tenant Verification expandable group */}
      {showTenantVerificationGroup && (
        <div>
          <button
            onClick={() => setTenantVerificationOpen((o) => !o)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              isTenantVerificationActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <User className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Tenant Verification</span>
            {tenantVerificationExpanded
              ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          </button>
          {tenantVerificationExpanded && (
            <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-3">
              {filteredTenantVerification.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/admin/tenant-verification" && pathname.startsWith(href + "/"));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Admin-only items */}
      {showAdminGroup && filteredAdmin.map(({ href, label, icon: Icon }) => {
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
        </>
      )}
    </nav>
  );
}

function SidebarContent({ user, role, permissions, helpDeskEnabled, tenantVerificationEnabled, onNavigate }: Props & { onNavigate?: () => void; helpDeskEnabled: boolean; tenantVerificationEnabled: boolean }) {
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

      <NavLinks pathname={pathname} role={role} permissions={permissions} userEmail={user.email} helpDeskEnabled={helpDeskEnabled} tenantVerificationEnabled={tenantVerificationEnabled} onNavigate={onNavigate} />

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

export default function SidebarNav({ user, role, permissions, helpDeskEnabled, tenantVerificationEnabled }: Props) {
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
            <SheetContent side="left" className="w-full p-0 border-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent user={user} role={role} permissions={permissions} helpDeskEnabled={helpDeskEnabled} tenantVerificationEnabled={tenantVerificationEnabled} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="hidden md:flex w-64 h-full shrink-0 flex-col">
        <SidebarContent user={user} role={role} permissions={permissions} helpDeskEnabled={helpDeskEnabled} tenantVerificationEnabled={tenantVerificationEnabled} />
      </div>
    </>
  );
}
