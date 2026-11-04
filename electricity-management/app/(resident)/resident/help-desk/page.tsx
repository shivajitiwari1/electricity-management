"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatTicketPriority, formatTicketStatus, formatTicketType, statusBadgeClass, priorityBadgeClass } from "@/lib/help-desk-format";
import { LifeBuoy, MessageSquare, Plus, Search } from "lucide-react";

type TicketListItem = {
  id: string;
  ticketNumber: string;
  category: { name: string };
  subcategory: { name: string } | null;
  priority: string;
  status: string;
  complaintType: string;
  description: string;
  updatedAt: string;
  resident: { name?: string } | any;
  connection: { flatNo: string; tower: string } | null;
  assignee: { name: string } | null;
  comments: { id: string }[];
  attachments: { id: string }[];
};

const TABS = [
  { label: "All", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "On Hold", value: "ON_HOLD" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Closed", value: "CLOSED" },
  { label: "Auto Closed", value: "AUTO_CLOSED" },
  { label: "Cancelled", value: "CANCELLED" },
] as const;

export default function ResidentHelpDeskPage() {
  const router = useRouter();
  const [helpDeskEnabled, setHelpDeskEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/help-desk/config", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          if (!res.ok || data.helpDeskEnabled === false) {
            setHelpDeskEnabled(false);
            router.push("/resident/dashboard");
          }
        }
      } catch {
        if (!cancelled) {
          setHelpDeskEnabled(false);
          router.push("/resident/dashboard");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!helpDeskEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/help-desk/tickets", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load complaints");
        if (!cancelled) setTickets(data.tickets ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load complaints");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [helpDeskEnabled]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tickets) map.set(t.status, (map.get(t.status) ?? 0) + 1);
    return map;
  }, [tickets]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesTab = activeTab === "ALL" || ticket.status === activeTab;
      if (!matchesTab) return false;
      if (!query) return true;
      return [
        ticket.ticketNumber,
        ticket.description,
        ticket.category?.name,
        ticket.subcategory?.name,
        ticket.connection?.flatNo,
        ticket.connection?.tower,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [tickets, activeTab, search]);

  if (!helpDeskEnabled) return null;

  return (
    <main className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Help Desk</h1>
          <p className="text-sm text-gray-500 mt-1">
            Raise tickets and track complaint status.
          </p>
        </div>
        <Link href="/resident/help-desk/new" className={`${buttonVariants({ variant: "default" })} gap-2`}>
          <Plus className="h-4 w-4" /> New Complaint
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-base">My Tickets</CardTitle>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search ticket or flat…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-6">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  activeTab === tab.value
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}{" "}
                {tab.value === "ALL" ? tickets.length : counts.get(tab.value) ?? 0}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-10">Loading your tickets…</p>
          ) : visible.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <LifeBuoy className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">No tickets found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Raise a complaint and we will get back to you.
                </p>
              </div>
              <Link href="/resident/help-desk/new" className={`${buttonVariants({ variant: "default" })} gap-2`}>
                <Plus className="h-4 w-4" /> New Complaint
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/resident/help-desk/${ticket.id}`}
                  className="block"
                >
                  <div className="border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{ticket.ticketNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {ticket.category?.name ?? "Other"} · {ticket.connection?.tower}-{ticket.connection?.flatNo}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={statusBadgeClass(ticket.status)}>
                          {formatTicketStatus(ticket.status)}
                        </Badge>
                        <Badge variant="outline" className={priorityBadgeClass(ticket.priority)}>
                          {formatTicketPriority(ticket.priority)}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm mt-3 line-clamp-2">{ticket.description}</p>
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" /> {ticket.comments?.length ?? 0}
                        </span>
                        <span>{formatTicketType(ticket.complaintType)}</span>
                      </div>
                      <span>{new Date(ticket.updatedAt).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
