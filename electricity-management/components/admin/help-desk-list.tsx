"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import {
  formatTicketPriority,
  formatTicketStatus,
  formatTicketType,
  statusBadgeClass,
  priorityBadgeClass,
} from "@/lib/help-desk-format";
import { Check, ChevronsUpDown, Download, LifeBuoy, MessageSquare, Plus, Search, X } from "lucide-react";

type Category = {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
};

type OptionSet = {
  categories?: Category[];
  residents?: Array<{
    id: string;
    name: string;
    email: string;
    connections: Array<{ id: string; flatNo: string; tower: string }>;
  }>;
  staff?: Array<{ id: string; name: string; email: string; role: string }>;
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

export default function AdminHelpDeskList() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [options, setOptions] = useState<OptionSet>({});
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);

  const [residentId, setResidentId] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [complaintType, setComplaintType] = useState("PERSONAL");
  const [assigneeId, setAssigneeId] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  // Searchable dropdown state
  const [residentOpen, setResidentOpen] = useState(false);
  const [residentSearch, setResidentSearch] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");

  async function load() {
    const [ticketsRes, optionsRes] = await Promise.all([
      fetch("/api/help-desk/tickets", { cache: "no-store" }),
      fetch("/api/help-desk/form-options", { cache: "no-store" }),
    ]);

    const ticketsData = (await ticketsRes.json().catch(() => ({}))) as { tickets?: unknown[]; error?: string };
    if (!ticketsRes.ok) throw new Error(ticketsData.error ?? "Could not load tickets");
    setTickets(ticketsData.tickets ?? []);

    const optionsData = (await optionsRes.json().catch(() => ({}))) as OptionSet & { error?: string };
    if (!optionsRes.ok) throw new Error(optionsData.error ?? "Could not load form options");
    setOptions(optionsData);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load Help Desk");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        ticket.assignee?.name,
        ticket.resident?.user?.name ?? ticket.resident?.name,
      ]
        .filter(Boolean)
        .some((value: unknown) => String(value).toLowerCase().includes(query));
    });
  }, [tickets, activeTab, search]);

  const selectedResident = options.residents?.find((resident) => resident.id === residentId);
  const selectedCategory = options.categories?.find((category) => category.id === categoryId);
  const selectedConnection = selectedResident?.connections.find((c) => c.id === connectionId);

  const filteredResidents = options.residents?.filter((resident) => {
    const q = residentSearch.toLowerCase();
    return !q || resident.name.toLowerCase().includes(q) || resident.email.toLowerCase().includes(q);
  }) ?? [];

  const filteredConnections = selectedResident?.connections.filter((c) => {
    const q = locationSearch.toLowerCase();
    return !q || c.tower.toLowerCase().includes(q) || c.flatNo.toLowerCase().includes(q);
  }) ?? [];

  async function submitComplaint() {
    if (!residentId) return toast.error("Select a resident");
    if (!connectionId) return toast.error("Select a location");
    if (!categoryId) return toast.error("Select a category");
    if (!description.trim()) return toast.error("Describe the complaint");

    setCreating(true);
    try {
      const res = await fetch("/api/help-desk/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residentId,
          connectionId,
          categoryId,
          subcategoryId: subcategoryId || null,
          assigneeId: assigneeId || null,
          priority,
          complaintType,
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create complaint");

      const ticketId = data?.ticket?.id as string | undefined;
      if (ticketId && files && files.length > 0) {
        const form = new FormData();
        for (const file of Array.from(files)) form.append("files", file);
        const upload = await fetch(`/api/help-desk/tickets/${ticketId}/attachments`, {
          method: "POST",
          body: form,
        });
        if (!upload.ok) toast.error("Complaint created, but images failed to upload");
      }

      toast.success(`Complaint ${data?.ticket?.ticketNumber ?? "created"} logged`);
      setShowNew(false);
      setResidentId("");
      setConnectionId("");
      setResidentSearch("");
      setLocationSearch("");
      setCategoryId("");
      setSubcategoryId("");
      setPriority("MEDIUM");
      setComplaintType("PERSONAL");
      setAssigneeId("");
      setDescription("");
      setFiles(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create complaint");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <a href="/api/help-desk/tickets/export" className={`${buttonVariants({ variant: "outline" })} gap-2`}>
          <Download className="h-4 w-4" /> Download
        </a>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Complaint
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
            {tab.label} {tab.value === "ALL" ? tickets.length : counts.get(tab.value) ?? 0}
          </button>
        ))}
      </div>

      <div className="relative w-full md:w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search resident, flat or ticket…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Loading tickets…</CardContent></Card>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <LifeBuoy className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium">No complaints match the filter.</p>
            <Button onClick={() => setShowNew(true)} className="gap-2">
              <Plus className="h-4 w-4" /> New Complaint
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visible.map((ticket) => (
            <div key={ticket.id} className="border rounded-xl p-4 bg-card">
              <div className="grid md:grid-cols-[1fr_auto] gap-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-lg text-primary">{ticket.ticketNumber}</p>
                      <p className="text-base font-medium">{ticket.resident?.user?.name ?? ticket.resident?.name ?? "—"}</p>
                      <p className="text-sm text-muted-foreground">{ticket.connection?.tower}-{ticket.connection?.flatNo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusBadgeClass(ticket.status)}>{formatTicketStatus(ticket.status)}</Badge>
                      <Badge variant="outline" className={priorityBadgeClass(ticket.priority)}>
                        {formatTicketPriority(ticket.priority)}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm">{ticket.description}</p>
                  <div className="mt-2 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                    <span>{ticket.category?.name ?? "Other"}</span>
                    <span>{formatTicketType(ticket.complaintType)}</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {ticket.comments?.length ?? 0} comment(s)</span>
                    <span>{new Date(ticket.updatedAt).toLocaleString("en-IN")}</span>
                  </div>
                </div>
                <div className="flex items-center md:items-end gap-2 md:flex-col">
                  <a
                    href={`/api/help-desk/tickets/${ticket.id}/job-card`}
                    target="_blank"
                    rel="noreferrer"
                    className={`${buttonVariants({ variant: "outline", size: "icon" })}`}
                    title="Job card PDF"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <Link href={`/admin/help-desk/${ticket.id}`} className={`${buttonVariants({ variant: "default" })} gap-2`}>
                    Open
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end md:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-2xl rounded-xl shadow-lg max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Log New Complaint</h2>
              <button onClick={() => { setShowNew(false); setResidentSearch(""); setLocationSearch(""); }} className="rounded-md p-1 hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-sm font-medium">Select Resident *</label>
                  <Popover open={residentOpen} onOpenChange={(o) => { setResidentOpen(o); if (!o) setResidentSearch(""); }}>
                    <PopoverTrigger className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-normal whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {selectedResident ? selectedResident.name : <span className="text-muted-foreground">Select resident</span>}
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Search resident…" value={residentSearch} onValueChange={setResidentSearch} />
                        <CommandList className="max-h-64">
                          <CommandEmpty>No residents found</CommandEmpty>
                          <CommandGroup heading={`${filteredResidents.length} resident${filteredResidents.length !== 1 ? "s" : ""}`}>
                            {filteredResidents.map((resident) => (
                              <CommandItem
                                key={resident.id}
                                value={resident.id}
                                onSelect={() => {
                                  setResidentId(resident.id);
                                  setConnectionId("");
                                  setResidentSearch("");
                                  setResidentOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${residentId === resident.id ? "opacity-100" : "opacity-0"}`} />
                                <span className="font-medium">{resident.name}</span>
                                <span className="ml-2 text-muted-foreground text-xs">{resident.email}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-sm font-medium">Complaint Location *</label>
                  <Popover open={locationOpen} onOpenChange={(o) => { setLocationOpen(o); if (!o) setLocationSearch(""); }}>
                    <PopoverTrigger className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-normal whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" disabled={!residentId}>
                      {selectedConnection ? `${selectedConnection.tower}-${selectedConnection.flatNo}` : <span className="text-muted-foreground">Select location</span>}
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Search flat or resident…" value={locationSearch} onValueChange={setLocationSearch} />
                        <CommandList className="max-h-64">
                          <CommandEmpty>No locations found</CommandEmpty>
                          <CommandGroup heading={`${filteredConnections.length} location${filteredConnections.length !== 1 ? "s" : ""}`}>
                            {filteredConnections.map((connection) => (
                              <CommandItem
                                key={connection.id}
                                value={connection.id}
                                disabled={!residentId}
                                onSelect={() => {
                                  setConnectionId(connection.id);
                                  setLocationSearch("");
                                  setLocationOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${connectionId === connection.id ? "opacity-100" : "opacity-0"}`} />
                                <span className="font-medium">{connection.tower}-{connection.flatNo}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Priority *</label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={priority} onChange={(event) => setPriority(event.target.value)}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Complaint Visibility *</label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={complaintType} onChange={(event) => setComplaintType(event.target.value)}>
                    <option value="PERSONAL">Personal</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Complaint Category *</label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setSubcategoryId(""); }}>
                    <option value="">Select category</option>
                    {options.categories?.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Sub Category</label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)}>
                    <option value="">None</option>
                    {selectedCategory?.subcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-sm font-medium">Assignee (Optional)</label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                    <option value="">Unassigned</option>
                    {options.staff?.map((staff) => (
                      <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description *</label>
                <Textarea rows={4} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Type complaint description here…" />
                <p className="text-xs text-muted-foreground text-right">{description.length}/2000</p>
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer rounded-md border border-dashed px-3 py-2 hover:bg-accent">
                  Attach image(s)
                  <Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(event) => setFiles(event.target.files)} />
                </label>
                <span className="text-xs text-muted-foreground">{files?.length ?? 0} selected</span>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={submitComplaint} disabled={creating} className="gap-2">
                  {creating ? "Logging…" : "Log Complaint"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
