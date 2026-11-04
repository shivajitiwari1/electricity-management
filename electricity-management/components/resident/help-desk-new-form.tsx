"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Paperclip, Send } from "lucide-react";

type Category = {
  id: string;
  name: string;
  sortOrder: number;
  subcategories: { id: string; name: string; sortOrder: number }[];
};

type Options = {
  role?: string;
  categories: Category[];
  resident?: {
    id: string;
    name: string;
    connections: { id: string; flatNo: string; tower: string }[];
  } | null;
};

export default function HelpDeskNewTicketForm() {
  const router = useRouter();
  const [options, setOptions] = useState<Options>({ categories: [], resident: null });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [connectionId, setConnectionId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [complaintType, setComplaintType] = useState("PERSONAL");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/help-desk/form-options", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { categories?: unknown[]; resident?: unknown; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not load form options");
        if (cancelled) return;
        const nextOptions = {
          categories: (data.categories ?? []) as { id: string; name: string; sortOrder: number; subcategories: { id: string; name: string; sortOrder: number }[] }[],
          resident: (data.resident ?? null) as { id: string; name: string; connections: { id: string; flatNo: string; tower: string }[] } | null,
        };
        setOptions(nextOptions);
        const connections = nextOptions.resident?.connections ?? [];
        if (connections.length > 0) setConnectionId(connections[0].id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load categories");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCategory = useMemo(
    () => options.categories.find((category) => category.id === categoryId),
    [options.categories, categoryId]
  );

  const connections = options.resident?.connections ?? [];

  async function submit() {
    if (!categoryId) {
      toast.error("Select a category");
      return;
    }
    if (!connectionId && connections.length > 0) {
      toast.error("Select a location");
      return;
    }
    if (!description.trim()) {
      toast.error("Describe the complaint");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/help-desk/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: connectionId || undefined,
          categoryId,
          subcategoryId: subcategoryId || null,
          priority,
          complaintType,
          description: description.trim(),
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error ?? "Could not create complaint");

      const ticketId: string | undefined = created?.ticket?.id;
      if (ticketId && files && files.length > 0) {
        const form = new FormData();
        for (const file of Array.from(files)) {
          form.append("files", file);
        }
        const uploadRes = await fetch(`/api/help-desk/tickets/${ticketId}/attachments`, {
          method: "POST",
          body: form,
        });
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          toast.error(uploadData.error ?? "Ticket created, but image upload failed");
        }
      }

      toast.success(`Complaint ${created?.ticket?.ticketNumber ?? "created"} logged`);
      router.push(ticketId ? `/resident/help-desk/${ticketId}` : "/resident/help-desk");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create complaint");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => router.push("/resident/help-desk")}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Complaints
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Log New Complaint</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Tell us what is wrong. The society team will be notified immediately.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading categories…</p>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="location">Complaint Location *</Label>
                  {connections.length > 0 ? (
                    <select
                      id="location"
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={connectionId}
                      onChange={(event) => setConnectionId(event.target.value)}
                      required
                    >
                      {connections.map((connection) => (
                        <option key={connection.id} value={connection.id}>
                          {connection.tower} - {connection.flatNo}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-muted-foreground">No registered flat found on your account.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Complaint Category *</Label>
                  <select
                    id="category"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={categoryId}
                    onChange={(event) => {
                      setCategoryId(event.target.value);
                      setSubcategoryId("");
                    }}
                    required
                  >
                    <option value="">Select category</option>
                    {options.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subcategory">Sub-category</Label>
                  <select
                    id="subcategory"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={subcategoryId}
                    onChange={(event) => setSubcategoryId(event.target.value)}
                    disabled={!selectedCategory || selectedCategory.subcategories.length === 0}
                  >
                    <option value="">None</option>
                    {selectedCategory?.subcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
                  <select
                    id="priority"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visibility">Complaint Visibility *</Label>
                  <select
                    id="visibility"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={complaintType}
                    onChange={(event) => setComplaintType(event.target.value)}
                  >
                    <option value="PERSONAL">Personal</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Type complaint description here…"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  rows={6}
                />
                <div className="flex justify-end text-xs text-muted-foreground">
                  {description.length}/2000
                </div>
              </div>

              <div className="space-y-2">
                <Label>Attach images</Label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer rounded-md border border-dashed px-3 py-2 hover:bg-accent">
                    <Paperclip className="h-4 w-4" />
                    Select image(s)
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={(event) => setFiles(event.target.files)}
                    />
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {files?.length ? `${files.length} file(s) selected` : "JPG, PNG, WebP or GIF · max 5MB each"}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={submit} disabled={submitting} className="gap-2">
                  <Send className="h-4 w-4" />
                  {submitting ? "Logging…" : "Log Complaint"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
