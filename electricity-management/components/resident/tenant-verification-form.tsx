"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const formSchema = z.object({
  tenantName: z.string().min(1, "Tenant name is required"),
  tenantPhone: z.string().min(1, "Phone is required"),
  tenantEmail: z.string().email().optional().or(z.literal("")),
  tenantIdProof: z.string().min(1, "ID proof number is required"),
  connectionId: z.string().min(1, "Select a flat"),
  moveInDate: z.string().optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

type Props = {
  connections: Array<{ id: string; flatNo: string; tower: string }>;
};

export default function TenantVerificationForm({
  connections,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tenantName: "",
      tenantPhone: "",
      tenantEmail: "",
      tenantIdProof: "",
      connectionId: "",
      moveInDate: "",
    },
  });

  const onFormSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        tenantName: data.tenantName,
        tenantPhone: data.tenantPhone,
        tenantIdProof: data.tenantIdProof,
        connectionId: data.connectionId,
      };
      if (data.tenantEmail) payload.tenantEmail = data.tenantEmail;
      if (data.moveInDate) {
        // HTML date input yields YYYY-MM-DD; store as UTC midnight
        payload.moveInDate = `${data.moveInDate}T00:00:00.000Z`;
      }

      const res = await fetch("/api/tenant-verification/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to submit application");
      }

      toast.success("Application submitted successfully");
      form.reset();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>New Tenant Verification Application</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Tenant Name</Label>
              <Input
                placeholder="Full name of tenant"
                {...form.register("tenantName")}
              />
              {form.formState.errors.tenantName && (
                <p className="text-xs text-destructive">{form.formState.errors.tenantName.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input placeholder="+91 98765 43210" {...form.register("tenantPhone")} />
              {form.formState.errors.tenantPhone && (
                <p className="text-xs text-destructive">{form.formState.errors.tenantPhone.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Email (optional)</Label>
              <Input type="email" placeholder="tenant@example.com" {...form.register("tenantEmail")} />
            </div>
            <div className="space-y-1">
              <Label>ID Proof Number (Aadhaar / Passport)</Label>
              <Input {...form.register("tenantIdProof")} />
              {form.formState.errors.tenantIdProof && (
                <p className="text-xs text-destructive">{form.formState.errors.tenantIdProof.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Select Flat</Label>
            <Select
              onValueChange={(value) => form.setValue("connectionId", String(value))}
              {...form.register("connectionId")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a flat" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tower} - {c.flatNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.connectionId && (
              <p className="text-xs text-destructive">{form.formState.errors.connectionId.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Expected Move-in Date (optional)</Label>
            <Input type="date" {...form.register("moveInDate")} />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Submitting..." : "Submit Application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
