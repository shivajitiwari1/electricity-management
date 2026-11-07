"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const editSchema = z.object({
  tenantName: z.string().min(1, "Tenant name is required"),
  tenantPhone: z.string().min(10, "Phone is required"),
  tenantEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  tenantIdProof: z.string().optional().or(z.literal("")),
  connectionId: z.string().optional(),
  moveInDate: z.string().optional().or(z.literal("")),
  tenancyFrom: z.string().optional().or(z.literal("")),
  tenancyTo: z.string().optional().or(z.literal("")),
  permanentAddress: z.string().optional().or(z.literal("")),
  fatherSpouseName: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  occupation: z.string().optional().or(z.literal("")),
  employer: z.string().optional().or(z.literal("")),
  officeAddress: z.string().optional().or(z.literal("")),
  nationality: z.string().optional().or(z.literal("")),
  maritalStatus: z.string().optional().or(z.literal("")),
  policeStatus: z.string().optional().or(z.literal("")),
  policeRefNumber: z.string().optional().or(z.literal("")),
  policeRefDate: z.string().optional().or(z.literal("")),
  previousAddress: z.string().optional().or(z.literal("")),
  emergencyContactName: z.string().optional().or(z.literal("")),
  emergencyContactRelation: z.string().optional().or(z.literal("")),
  emergencyContactMobile: z.string().optional().or(z.literal("")),
});

type FormData = z.infer<typeof editSchema>;

type Connection = {
  id: string;
  flatNo: string;
  tower: string;
  residentName?: string | null;
};

type Props = {
  application: {
    id: string;
    applicationNumber: string;
    status: string;
    tenantName: string;
    tenantPhone: string;
    tenantEmail: string | null;
    tenantIdProof: string | null;
    moveInDate: Date | null;
    tenancyFrom: Date | null;
    tenancyTo: Date | null;
    permanentAddress: string | null;
    fatherSpouseName: string | null;
    dateOfBirth: Date | null;
    occupation: string | null;
    employer: string | null;
    officeAddress: string | null;
    nationality: string | null;
    maritalStatus: string | null;
    policeStatus: string | null;
    policeRefNumber: string | null;
    policeRefDate: Date | null;
    previousAddress: string | null;
    emergencyContactName: string | null;
    emergencyContactRelation: string | null;
    emergencyContactMobile: string | null;
    connection: { id: string; flatNo: string | null; tower: string | null } | null;
  };
  connections: Connection[];
};

export default function TenantVerificationEditForm({
  application,
  connections,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (d: Date | null) => {
    if (!d) return "";
    return new Date(d).toISOString().split("T")[0];
  };

  const form = useForm<FormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      tenantName: application.tenantName,
      tenantPhone: application.tenantPhone,
      tenantEmail: application.tenantEmail ?? "",
      tenantIdProof: application.tenantIdProof ?? "",
      connectionId: application.connection?.id ?? "",
      moveInDate: formatDate(application.moveInDate),
      tenancyFrom: formatDate(application.tenancyFrom),
      tenancyTo: formatDate(application.tenancyTo),
      permanentAddress: application.permanentAddress ?? "",
      fatherSpouseName: application.fatherSpouseName ?? "",
      dateOfBirth: formatDate(application.dateOfBirth),
      occupation: application.occupation ?? "",
      employer: application.employer ?? "",
      officeAddress: application.officeAddress ?? "",
      nationality: application.nationality ?? "",
      maritalStatus: application.maritalStatus ?? "",
      policeStatus: application.policeStatus ?? "",
      policeRefNumber: application.policeRefNumber ?? "",
      policeRefDate: formatDate(application.policeRefDate),
      previousAddress: application.previousAddress ?? "",
      emergencyContactName: application.emergencyContactName ?? "",
      emergencyContactRelation: application.emergencyContactRelation ?? "",
      emergencyContactMobile: application.emergencyContactMobile ?? "",
    },
  });

  const router = useRouter();

  const onFormSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = { ...data };
      // Date fields: a real date becomes an ISO datetime string; an empty date
      // becomes null (the API accepts null via .nullable()).
      const dateFields: (keyof FormData)[] = [
        "moveInDate", "tenancyFrom", "tenancyTo", "dateOfBirth", "policeRefDate",
      ];
      for (const field of dateFields) {
        if (data[field]) {
          payload[field] = `${data[field]}T00:00:00.000Z`;
        } else {
          payload[field] = null;
        }
      }
      // Other optional string fields are left as-is: an empty string is fine,
      // the API coerces "" to null before writing to the database. Do NOT send
      // null here, because the API zod schema accepts "" / undefined but not
      // null, which would fail validation.

      const res = await fetch(`/api/tenant-verification/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to update application");
      }

      toast.success("Application updated successfully");
      router.push(`/admin/tenant-verification/${application.id}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedConnection = connections.find(
    (c) => c.id === application.connection?.id
  );

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between sm:flex-col sm:gap-2 pb-2">
        <div className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          <Link
            href={`/admin/tenant-verification/${application.id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to Application {application.applicationNumber}
          </Link>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Edit Application</h2>
          <p className="text-xs text-muted-foreground">
            {application.applicationNumber} • Status:{" "}
            <span className="capitalize">{application.status.replace(/_/g, " ").toLowerCase()}</span>
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <Label>Tenant Name</Label>
              <Input {...form.register("tenantName")} />
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
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" placeholder="tenant@example.com" {...form.register("tenantEmail")} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <Label>ID Proof Number</Label>
              <Input placeholder="Aadhaar / Passport last 4" {...form.register("tenantIdProof")} />
            </div>
            <div className="space-y-1">
              <Label>Select Flat</Label>
              <Select
                onValueChange={(id) => form.setValue("connectionId", id as string)}
                defaultValue={application.connection?.id ?? undefined}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      selectedConnection
                        ? `${selectedConnection.tower} — ${selectedConnection.flatNo}`
                        : "Select flat"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tower} — {c.flatNo}
                      {c.residentName && (
                        <span className="ml-2 text-muted-foreground text-xs">({c.residentName})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Move-in Date</Label>
              <Input type="date" {...form.register("moveInDate")} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <Label>Tenancy From</Label>
              <Input type="date" {...form.register("tenancyFrom")} />
            </div>
            <div className="space-y-1">
              <Label>Tenancy To</Label>
              <Input type="date" {...form.register("tenancyTo")} />
            </div>
            <div className="space-y-1">
              <Label>Date of Birth</Label>
              <Input type="date" {...form.register("dateOfBirth")} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <Label>Permanent Address</Label>
              <Input {...form.register("permanentAddress")} />
            </div>
            <div className="space-y-1">
              <Label>Father / Spouse Name</Label>
              <Input {...form.register("fatherSpouseName")} />
            </div>
            <div className="space-y-1">
              <Label>Occupation</Label>
              <Input {...form.register("occupation")} />
            </div>
            <div className="space-y-1">
              <Label>Employer</Label>
              <Input {...form.register("employer")} />
            </div>
            <div className="space-y-1">
              <Label>Office Address</Label>
              <Input {...form.register("officeAddress")} />
            </div>
            <div className="space-y-1">
              <Label>Nationality</Label>
              <Input {...form.register("nationality")} />
            </div>
            <div className="space-y-1">
              <Label>Marital Status</Label>
              <Input {...form.register("maritalStatus")} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <Label>Previous Address</Label>
              <Input {...form.register("previousAddress")} />
            </div>
            <div className="space-y-1">
              <Label>Police Status</Label>
              <Input {...form.register("policeStatus")} />
            </div>
            <div className="space-y-1">
              <Label>Police Ref Number</Label>
              <Input {...form.register("policeRefNumber")} />
            </div>
            <div className="space-y-1">
              <Label>Police Ref Date</Label>
              <Input type="date" {...form.register("policeRefDate")} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <Label>Emergency Contact Name</Label>
              <Input {...form.register("emergencyContactName")} />
            </div>
            <div className="space-y-1">
              <Label>Relation</Label>
              <Input {...form.register("emergencyContactRelation")} />
            </div>
            <div className="space-y-1">
              <Label>Emergency Mobile</Label>
              <Input placeholder="+91 98765 43210" {...form.register("emergencyContactMobile")} />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button type="submit" disabled={isSubmitting} className="w-auto">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              disabled={isSubmitting}
              className="w-auto"
            >
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
