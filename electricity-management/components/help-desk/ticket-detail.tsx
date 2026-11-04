"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  formatTicketPriority,
  formatTicketStatus,
  formatTicketType,
  statusBadgeClass,
  priorityBadgeClass,
} from "@/lib/help-desk-format";
import {
  ArrowLeft,
  Download,
  FileText,
  MessageSquare,
  Paperclip,
  Send,
} from "lucide-react";

type Role = "ADMIN" | "MANAGER" | "RESIDENT";

type FormOptions = {
  role?: Role;
  categories?: Array<{
    id: string;
    name: string;
    subcategories: Array<{ id: string; name: string }>;
  }>;
  staff?: Array<{ id: string; name: string; email: string; role: string }>;
  residents?: Array<{
    id: string;
    name: string;
    connections: Array<{ id: string; flatNo: string; tower: string; status?: string }>;
  }>;
  resident?: {
    id: string;
    name: string;
    connections: Array<{ id: string; flatNo: string; tower: string }>;
  } | null;
};

export default function HelpDeskTicketDetail({
  ticketId,
  role,
}: {
  ticketId: string;
  role: Role;
}) {
  const isStaff = role === "ADMIN" || role === "MANAGER";
  const backHref = isStaff ? "/admin/help-desk" : "/resident/help-desk";

  const [ticket, setTicket] = useState<any>(null);
  const [options, setOptions] = useState<FormOptions>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadTicket() {
    const res = await fetch(`/api/help-desk/tickets/${ticketId}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load ticket");
    setTicket(data.ticket);
  }

  async function loadOptions() {
    if (!isStaff) return;
    const res = await fetch("/api/help-desk/form-options", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return; // keep page usable even if options fail to load
    setOptions(data);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([loadTicket(), loadOptions()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load ticket");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  async function patchFields(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/help-desk/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update ticket");
      setTicket(data.ticket);
      toast.success("Ticket updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update ticket");
    } finally {
      setSaving(false);
    }
  }

  async function submitComment() {
    if (!comment.trim()) {
      toast.error("Write a comment first");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/help-desk/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment.trim(), isInternal: isStaff && isInternal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add comment");
      setComment("");
      setIsInternal(false);
      setTicket(data.ticket);
      toast.success("Comment added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add comment");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAttachment(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      for (const file of Array.from(files)) {
        form.append("files", file);
      }
      const res = await fetch(`/api/help-desk/tickets/${ticketId}/attachments`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not upload attachments");
      toast.success(`${data.attachments?.length ?? 0} attachment(s) uploaded`);
      await loadTicket();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload attachments");
    } finally {
      setUploading(false);
    }
  }

  const categories = options.categories ?? [];
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === ticket?.categoryId),
    [categories, ticket?.categoryId]
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center text-muted-foreground">
        Loading ticket…
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <p className="font-medium">Ticket not found</p>
        <Link href={backHref} className={`${buttonVariants({ variant: "default" })} mt-4`}>Back</Link>
      </div>
    );
  }

  function statusLabel(s: string): string {
    return formatTicketStatus(s);
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to tickets
        </Link>
        <a
          href={`/api/help-desk/tickets/${ticketId}/job-card`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <Download className="h-4 w-4" /> Job Card
        </a>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Complaint {ticket.ticketNumber}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {ticket.category?.name ?? "Other"} · {ticket.connection?.tower} - {ticket.connection?.flatNo}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge className={statusBadgeClass(ticket.status)}>{statusLabel(ticket.status)}</Badge>
                <Badge variant="outline" className={priorityBadgeClass(ticket.priority)}>
                  {formatTicketPriority(ticket.priority)}
                </Badge>
                <Badge variant="outline">{formatTicketType(ticket.complaintType)}</Badge>
                {ticket.subcategory && <Badge variant="outline">{ticket.subcategory.name}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Raised by {ticket.createdBy?.name ?? "—"} · {new Date(ticket.createdAt).toLocaleString("en-IN")}
              </p>
            </div>

            {isStaff && (
              <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs min-w-[260px]">
                <label className="space-y-1">
                  <span className="text-muted-foreground">Status</span>
                  <select
                    value={ticket.status}
                    onChange={(e) => patchFields({ status: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-2"
                    disabled={saving}
                  >
                    <option value="OPEN">Ticket Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                    <option value="AUTO_CLOSED">Auto Closed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="NOT_AN_ISSUE">Not an Issue</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Priority</span>
                  <select
                    value={ticket.priority}
                    onChange={(e) => patchFields({ priority: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-2"
                    disabled={saving}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Assignee</span>
                  <select
                    value={ticket.assigneeId ?? ""}
                    onChange={(e) => patchFields({ assigneeId: e.target.value || null })}
                    className="w-full h-9 rounded-md border border-input bg-background px-2"
                    disabled={saving}
                  >
                    <option value="">Unassigned</option>
                    {options.staff?.map((staff) => (
                      <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Complaint Type</span>
                  <select
                    value={ticket.complaintType}
                    onChange={(e) => patchFields({ complaintType: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-2"
                    disabled={saving}
                  >
                    <option value="PERSONAL">Personal</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Location</span>
                  <select
                    value={ticket.connectionId ?? ""}
                    onChange={(e) => patchFields({ connectionId: e.target.value || null })}
                    className="w-full h-9 rounded-md border border-input bg-background px-2"
                    disabled={saving}
                  >
                    <option value="">No location</option>
                    {options.residents
                      ?.flatMap((r) =>
                        r.connections.map((connection) => ({
                          ...connection,
                          label: `${connection.tower}-${connection.flatNo}`,
                        }))
                      )
                      .map((connection) => (
                        <option key={connection.id} value={connection.id}>
                          {connection.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Cat / Subcat</span>
                  <select
                    value={ticket.subcategoryId ? `${ticket.categoryId}:${ticket.subcategoryId}` : ticket.categoryId}
                    onChange={(e) => {
                      const [categoryId, subcategoryId] = e.target.value.split(":");
                      patchFields({ categoryId, subcategoryId: subcategoryId ?? null });
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-2"
                    disabled={saving}
                  >
                    {categories.map((category) => (
                      <optgroup key={category.id} label={category.name}>
                        <option value={category.id}>{category.name}</option>
                        {category.subcategories.map((subcategory) => (
                          <option key={subcategory.id} value={`${category.id}:${subcategory.id}`}>
                            {subcategory.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Description</h3>
            <p className="mt-2 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer rounded-md border border-dashed px-3 py-2 hover:bg-accent">
              <Paperclip className="h-4 w-4" />
              {uploading ? "Uploading…" : "Attach image(s)"}
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(event) => uploadAttachment(event.target.files)}
                disabled={uploading || saving}
              />
            </label>
            {ticket.attachments?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ticket.attachments.map((attachment: any) => (
                  <a
                    key={attachment.id}
                    href={`/api/help-desk/attachments/${attachment.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs border rounded-md px-2 py-1.5 hover:bg-accent"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span className="max-w-[160px] truncate">{attachment.fileName}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.comments?.length > 0 ? (
            <div className="space-y-3">
              {ticket.comments.map((item: any) => (
                <div key={item.id} className={`rounded-lg border p-3 ${item.isInternal ? "bg-yellow-50/50 border-yellow-200" : ""}`}>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{item.author?.name ?? "—"}</span>
                    <span>{new Date(item.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                  {item.isInternal && (
                    <Badge variant="outline" className="mt-2 text-[11px] border-yellow-300 text-yellow-800">Internal</Badge>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-sm">{item.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No comments yet. Write one below.
            </p>
          )}

          <div className="space-y-2">
            <Textarea
              placeholder="Type your comment here…"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              maxLength={2000}
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{comment.length}/2000</span>
                {isStaff && (
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(event) => setIsInternal(event.target.checked)}
                    />
                    Internal (staff-only)
                  </label>
                )}
              </div>
              <Button onClick={submitComment} disabled={saving || !comment.trim()} className="gap-2">
                <Send className="h-4 w-4" />
                {isStaff ? (isInternal ? "Add internal note" : "Reply") : "Reply"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
