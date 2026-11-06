"use client";

import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight, ChevronLeft, X, AlertCircle, Plus, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import PhoneVerification from "@/components/tenant-verification/phone-verification";
import EmailVerification from "@/components/tenant-verification/email-verification";

// Step 1: Flat & Tenancy
const step1Schema = z.object({
  flatId: z.string().min(1, "Select a flat"),
  moveInDate: z.string().min(1, "Move-in date is required"),
  tenancyFrom: z.string().min(1, "Tenancy from date is required"),
  tenancyTo: z.string().min(1, "Tenancy to date is required"),
  permanentAddress: z.string().min(1, "Permanent address is required"),
});

// Step 2: Primary Occupant
const step2Schema = z.object({
  tenantName: z.string().min(1, "Full name is required"),
  fatherSpouseName: z.string().min(1, "Father's/Spouse's name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  tenantPhone: z.string().min(10, "Valid phone number is required"),
  alternateMobile: z.string().optional().or(z.literal("")),
  tenantEmail: z.string().min(1, "Email is required").email("Enter a valid email address"),
  occupation: z.string().min(1, "Occupation is required"),
  employer: z.string().min(1, "Employer is required"),
  officeAddress: z.string().min(1, "Office address is required"),
  nationality: z.string().min(1, "Nationality is required"),
  maritalStatus: z.string().min(1, "Marital status is required"),
});

// Step 3: Family Members
const familyMemberSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  relation: z.string().min(1, "Relationship is required"),
  // z.coerce turns "" into 0 — treat "no age" as null.
  age: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce.number().optional().nullable()
  ),
  idProof: z.string().optional().or(z.literal("")),
});

const step3Schema = z.object({
  familyMembers: z.array(familyMemberSchema).optional(),
});

// Step 4: Identity & Police Verification
const step4Schema = z.object({
  idProofType: z.string().min(1, "Select ID proof type"),
  idProofLast4: z.string().min(4, "Enter last 4 digits of ID proof"),
  policeStatus: z.string().min(1, "Select police verification status"),
  policeRefNumber: z.string().optional().or(z.literal("")),
  policeRefDate: z.string().optional().or(z.literal("")),
  previousAddress: z.string().optional().or(z.literal("")),
});

// Step 5: Vehicle Details
const vehicleSchema = z.object({
  vehicleType: z.string().optional().or(z.literal("")),
  registrationNo: z.string().optional().or(z.literal("")),
  stickerRfidNo: z.string().optional().or(z.literal("")),
});

const step5Schema = z.object({
  vehicles: z.array(vehicleSchema).optional(),
});

// Step 6: Emergency Contact
const step6Schema = z.object({
  emergencyContactName: z.string().min(1, "Emergency contact name is required"),
  emergencyContactRelation: z.string().min(1, "Relationship is required"),
  emergencyContactMobile: z.string().min(10, "Valid phone number is required"),
});

// Step 7: Documents
const step7Schema = z.object({
  hasDocuments: z.boolean(),
});

// Step 8: Declaration
const step8Schema = z.object({
  consentAccepted: z.boolean().refine((v) => v === true, {
    message: "You must accept the declaration to proceed",
  }),
});

const combinedSchema = z.object({
  step1: step1Schema,
  step2: step2Schema,
  step3: step3Schema,
  step4: step4Schema,
  step5: step5Schema,
  step6: step6Schema,
  step7: step7Schema,
  step8: step8Schema,
});

type FormData = z.infer<typeof combinedSchema>;

const STEPS = [
  { id: "step1", label: "Flat & Tenancy" },
  { id: "step2", label: "Primary Occupant" },
  { id: "step3", label: "Family Members" },
  { id: "step4", label: "Identity & Police" },
  { id: "step5", label: "Vehicle Details" },
  { id: "step6", label: "Emergency Contact" },
  { id: "step7", label: "Documents" },
  { id: "step8", label: "Declaration" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const NATIONALITY_OPTIONS = [
  "Indian",
  "Nepali",
  "Bhutanese",
  "Bangladeshi",
  "Sri Lankan",
  "Pakistani",
  "Afghan",
  "American",
  "British",
  "Canadian",
  "Australian",
  "Other",
] as const;

const STEP_SCHEMAS: Record<StepId, z.ZodType> = {
  step1: step1Schema,
  step2: step2Schema,
  step3: step3Schema,
  step4: step4Schema,
  step5: step5Schema,
  step6: step6Schema,
  step7: step7Schema,
  step8: step8Schema,
};

export default function ApplicationWizard({
  connections,
  phone,
  verificationChannels = { email: false, phone: false },
}: {
  connections: Array<{ id: string; flatNo: string; tower: string; residentName?: string | null }>;
  phone?: string;
  /**
   * Which contact details the admin requires the tenant to verify.
   * A channel only appears here once the matching provider is configured.
   */
  verificationChannels?: { email: boolean; phone: boolean };
}) {
  const [currentStep, setCurrentStep] = useState<StepId>("step1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Array<{
    id: string;
    type: string;
    fileName: string;
    size: number;
  }>>([]);
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(combinedSchema) as any,
    mode: "onChange",
    defaultValues: {
      step1: {
        flatId: "",
        moveInDate: "",
        tenancyFrom: "",
        tenancyTo: "",
        permanentAddress: "",
      },
      step2: {
        tenantName: "",
        fatherSpouseName: "",
        dateOfBirth: "",
        tenantPhone: phone || "",
        alternateMobile: "",
        tenantEmail: "",
        occupation: "",
        employer: "",
        officeAddress: "",
        nationality: "",
        maritalStatus: "",
      },
      step3: {
        familyMembers: [],
      },
      step4: {
        idProofType: "",
        idProofLast4: "",
        policeStatus: "",
        policeRefNumber: "",
        policeRefDate: "",
        previousAddress: "",
      },
      step5: {
        vehicles: [],
      },
      step6: {
        emergencyContactName: "",
        emergencyContactRelation: "",
        emergencyContactMobile: "",
      },
      step7: {
        hasDocuments: false,
      },
      step8: {
        consentAccepted: false,
      },
    },
  });

  const {
    fields: familyMemberFields,
    append: appendFamilyMember,
    remove: removeFamilyMember,
  } = useFieldArray({
    control: form.control,
    name: "step3.familyMembers",
  });

  const {
    fields: vehicleFields,
    append: appendVehicle,
  } = useFieldArray({
    control: form.control,
    name: "step5.vehicles",
  });

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const tenantPhone = form.watch("step2.tenantPhone");
  const tenantEmail = form.watch("step2.tenantEmail");
  const needsVerification = verificationChannels.email || verificationChannels.phone;

  const nextStep = async () => {
    if (currentStepIndex >= STEPS.length - 1) return;

    const stepData = form.getValues(currentStep);
    const result = STEP_SCHEMAS[currentStep].safeParse(stepData);

    if (!result.success) {
      form.clearErrors(currentStep);
      for (const issue of result.error.issues) {
        const fieldPath = issue.path.length > 0 ? `${currentStep}.${issue.path.join(".")}` : currentStep;
        form.setError(fieldPath as any, {
          type: issue.code,
          message: issue.message,
        });
      }
      toast.error("Please fill all required fields before proceeding.");
      return;
    }

    form.clearErrors(currentStep);
    setCurrentStep(STEPS[currentStepIndex + 1].id);
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(`File type ${file.type} not allowed. Allowed: JPG, PNG, WEBP, PDF`);
      return;
    }

    if (file.size > MAX_SIZE) {
      toast.error("File too large. Max 5 MB.");
      return;
    }

    const newDoc = {
      id: crypto.randomUUID(),
      type: docType,
      fileName: file.name,
      size: file.size,
      file,
    };

    setUploadedDocs((prev) => [...prev, newDoc]);
    form.setValue("step7.hasDocuments", true);
    toast.success(`${file.name} uploaded`);
    e.target.value = "";
  };

  const removeDoc = (docId: string) => {
    setUploadedDocs((prev) => {
      const updated = prev.filter((d) => d.id !== docId);
      if (updated.length === 0) {
        form.setValue("step7.hasDocuments", false);
      }
      return updated;
    });
    toast.success("Document removed");
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        ...data.step1,
        ...data.step2,
        ...data.step3,
        ...data.step4,
        ...data.step5,
        ...data.step6,
        ...data.step7,
        ...data.step8,
      };

      // HTML date inputs yield YYYY-MM-DD; the API expects ISO datetimes.
      for (const key of ["moveInDate", "tenancyFrom", "tenancyTo", "dateOfBirth", "policeRefDate"]) {
        const value = payload[key];
        if (typeof value === "string" && value) {
          payload[key] = `${value}T00:00:00.000Z`;
        } else {
          delete payload[key];
        }
      }

      const res = await fetch("/api/tenant-verification/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create application");
      }

      const json = await res.json();
      toast.success("Application created successfully!");
      router.push(`/resident/tenant-verification/applications/${json.application.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create application");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Step {currentStepIndex + 1} of {STEPS.length}
          </span>
          <Badge variant="secondary">{formatStatus(currentStep)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center gap-1">
              {index < currentStepIndex && (
                <Check className="h-3 w-3 text-emerald-600" />
              )}
              {index === currentStepIndex && (
                <div className="h-3 w-3 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                  {currentStepIndex + 1}
                </div>
              )}
              {index > currentStepIndex && (
                <div className="h-3 w-3 rounded-full border border-muted" />
              )}
              {index < STEPS.length - 1 && (
                <div className={`h-1 w-4 ${index < currentStepIndex ? "bg-emerald-600" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>{STEPS.find((s) => s.id === currentStep)?.label}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {currentStep === "step1" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Select Flat *</Label>
                    <Select
                      onValueChange={(value) =>
                        form.setValue("step1.flatId", String(value), { shouldValidate: true })
                      }
                      {...form.register("step1.flatId")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(() => {
                            const flatId = form.getValues("step1.flatId");
                            if (!flatId) return "Choose a flat";
                            const selected = connections.find((c) => c.id === flatId);
                            return selected ? `${selected.tower}-${selected.flatNo}` : "Choose a flat";
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key="" value="" disabled>
                          Choose a flat
                        </SelectItem>
                        {connections.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.tower} - {c.flatNo}{c.residentName ? ` (${c.residentName})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.step1?.flatId && (
                      <p className="text-xs text-destructive">{form.formState.errors.step1.flatId.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Move-in Date *</Label>
                    <Input type="date" {...form.register("step1.moveInDate")} />
                    {form.formState.errors.step1?.moveInDate && (
                      <p className="text-xs text-destructive">{form.formState.errors.step1.moveInDate.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Tenancy From *</Label>
                    <Input type="date" {...form.register("step1.tenancyFrom")} />
                    {form.formState.errors.step1?.tenancyFrom && (
                      <p className="text-xs text-destructive">{form.formState.errors.step1.tenancyFrom.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Tenancy To *</Label>
                    <Input type="date" {...form.register("step1.tenancyTo")} />
                    {form.formState.errors.step1?.tenancyTo && (
                      <p className="text-xs text-destructive">{form.formState.errors.step1.tenancyTo.message}</p>
                    )}
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Permanent Address *</Label>
                    <Input
                      placeholder="Your permanent home address"
                      {...form.register("step1.permanentAddress")}
                    />
                    {form.formState.errors.step1?.permanentAddress && (
                      <p className="text-xs text-destructive">{form.formState.errors.step1.permanentAddress.message}</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {currentStep === "step2" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Full Name (as per ID) *</Label>
                    <Input {...form.register("step2.tenantName")} />
                    {form.formState.errors.step2?.tenantName && (
                      <p className="text-xs text-destructive">{form.formState.errors.step2.tenantName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Father's / Spouse's Name *</Label>
                    <Input {...form.register("step2.fatherSpouseName")} />
                    {form.formState.errors.step2?.fatherSpouseName && (
                      <p className="text-xs text-destructive">{form.formState.errors.step2.fatherSpouseName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Date of Birth *</Label>
                    <Input type="date" {...form.register("step2.dateOfBirth")} />
                    {form.formState.errors.step2?.dateOfBirth && (
                      <p className="text-xs text-destructive">{form.formState.errors.step2.dateOfBirth.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Mobile Number *</Label>
                    <Input placeholder="+91 98765 43210" {...form.register("step2.tenantPhone")} />
                    {form.formState.errors.step2?.tenantPhone && (
                      <p className="text-xs text-destructive">{form.formState.errors.step2.tenantPhone.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Alternate Mobile</Label>
                    <Input placeholder="+91 98765 43210" {...form.register("step2.alternateMobile")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email *</Label>
                    <Input type="email" placeholder="tenant@example.com" {...form.register("step2.tenantEmail")} />
                    {form.formState.errors.step2?.tenantEmail && (
                      <p className="text-xs text-destructive">{form.formState.errors.step2.tenantEmail.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Occupation *</Label>
                    <Input {...form.register("step2.occupation")} />
                    {form.formState.errors.step2?.occupation && (
                      <p className="text-xs text-destructive">{form.formState.errors.step2.occupation.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Employer / Company *</Label>
                    <Input {...form.register("step2.employer")} />
                    {form.formState.errors.step2?.employer && (
                      <p className="text-xs text-destructive">{form.formState.errors.step2.employer.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Nationality *</Label>
                    <Select
                      onValueChange={(value) =>
                        form.setValue("step2.nationality", String(value), { shouldValidate: true })
                      }
                      {...form.register("step2.nationality")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {form.getValues("step2.nationality") || "Select nationality"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="" disabled>
                          Select nationality
                        </SelectItem>
                        {NATIONALITY_OPTIONS.map((nationality) => (
                          <SelectItem key={nationality} value={nationality}>
                            {nationality}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.step2?.nationality && (
                      <p className="text-xs text-destructive">{form.formState.errors.step2.nationality.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Marital Status *</Label>
                    <Select
                      onValueChange={(value) =>
                        form.setValue("step2.maritalStatus", String(value), { shouldValidate: true })
                      }
                      {...form.register("step2.maritalStatus")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(() => {
                            const val = form.getValues("step2.maritalStatus");
                            const labels: Record<string, string> = {
                              Single: "Single",
                              Married: "Married",
                              Divorced: "Divorced",
                              Widowed: "Widowed",
                              Other: "Other",
                            };
                            return val ? labels[val] || val : "Select marital status";
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Single">Single</SelectItem>
                          <SelectItem value="Married">Married</SelectItem>
                          <SelectItem value="Divorced">Divorced</SelectItem>
                          <SelectItem value="Widowed">Widowed</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.step2?.maritalStatus && (
                        <p className="text-xs text-destructive">{form.formState.errors.step2.maritalStatus.message}</p>
                      )}
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Office Address *</Label>
                    <Input {...form.register("step2.officeAddress")} />
                    {form.formState.errors.step2?.officeAddress && (
                      <p className="text-xs text-destructive">{form.formState.errors.step2.officeAddress.message}</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {currentStep === "step3" && (
              <>
                <div className="space-y-1">
                  <Label>Family Members / Co-occupants</Label>
                  <p className="text-xs text-muted-foreground">
                    Add each family member. Leave blank if there are no additional occupants.
                  </p>
                </div>
                <div className="space-y-3">
                  {familyMemberFields.length > 0 ? (
                    <>
                      {familyMemberFields.map((member, idx) => (
                        <div key={member.id} className="rounded border border-border bg-muted/50 p-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs">Full Name</Label>
                              <Input {...form.register(`step3.familyMembers.${idx}.fullName`)} />
                              {form.formState.errors.step3?.familyMembers?.[idx]?.fullName?.message && (
                                <p className="text-xs text-destructive">
                                  {form.formState.errors.step3.familyMembers[idx]?.fullName?.message}
                                </p>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs">Relationship</Label>
                              <Input {...form.register(`step3.familyMembers.${idx}.relation`)} />
                              {form.formState.errors.step3?.familyMembers?.[idx]?.relation?.message && (
                                <p className="text-xs text-destructive">
                                  {form.formState.errors.step3.familyMembers[idx]?.relation?.message}
                                </p>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs">Age</Label>
                              <Input type="number" {...form.register(`step3.familyMembers.${idx}.age`)} />
                            </div>
                            <div>
                              <Label className="text-xs">ID Proof</Label>
                              <Input {...form.register(`step3.familyMembers.${idx}.idProof`)} />
                            </div>
                          </div>
                          <div className="mt-2 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => removeFamilyMember(idx)}
                            >
                              <X className="h-4 w-4 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No family members added.</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    appendFamilyMember({ fullName: "", relation: "", age: null, idProof: "" })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Family Member
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Maximum 4 family members. Add more only if management approves.
                </p>
              </>
            )}

            {currentStep === "step4" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>ID Proof Type *</Label>
                    <Select
                      onValueChange={(value) =>
                        form.setValue("step4.idProofType", String(value), { shouldValidate: true })
                      }
                      {...form.register("step4.idProofType")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(() => {
                            const val = form.getValues("step4.idProofType");
                            const labels: Record<string, string> = {
                              AADHAAR: "Aadhaar",
                              PASSPORT: "Passport",
                              VOTER_ID: "Voter ID",
                              DRIVING_LICENCE: "Driving Licence",
                              OTHER: "Other",
                            };
                            return val ? labels[val] || val : "Select ID type";
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key="" value="" disabled>
                          Select ID type
                        </SelectItem>
                        <SelectItem value="AADHAAR">Aadhaar</SelectItem>
                        <SelectItem value="PASSPORT">Passport</SelectItem>
                        <SelectItem value="VOTER_ID">Voter ID</SelectItem>
                        <SelectItem value="DRIVING_LICENCE">Driving Licence</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.step4?.idProofType && (
                      <p className="text-xs text-destructive">{form.formState.errors.step4.idProofType.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>ID Proof Number (Last 4 digits) *</Label>
                    <Input placeholder="XXXX" maxLength={4} {...form.register("step4.idProofLast4")} />
                    {form.formState.errors.step4?.idProofLast4 && (
                      <p className="text-xs text-destructive">{form.formState.errors.step4.idProofLast4.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Police Verification Status *</Label>
                    <Select
                      onValueChange={(value) =>
                        form.setValue("step4.policeStatus", String(value), { shouldValidate: true })
                      }
                      {...form.register("step4.policeStatus")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(() => {
                            const val = form.getValues("step4.policeStatus");
                            const labels: Record<string, string> = {
                              COMPLETED: "Completed",
                              APPLIED_IN_PROCESS: "Applied / In Process",
                              NOT_YET_APPLIED: "Not Yet Applied",
                            };
                            return val ? labels[val] || val : "Select status";
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key="" value="" disabled>
                          Select status
                        </SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="APPLIED_IN_PROCESS">Applied / In Process</SelectItem>
                        <SelectItem value="NOT_YET_APPLIED">Not Yet Applied</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.step4?.policeStatus && (
                      <p className="text-xs text-destructive">{form.formState.errors.step4.policeStatus.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Reference Number</Label>
                    <Input {...form.register("step4.policeRefNumber")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Reference Date</Label>
                    <Input type="date" {...form.register("step4.policeRefDate")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Previous Address</Label>
                    <Input placeholder="Your previous residential address" {...form.register("step4.previousAddress")} />
                  </div>
                  <p className="text-xs text-muted-foreground md:col-span-2">
                    ID number field shows last 4 digits preferred. Do not submit full Aadhaar unless
                    required by management policy.
                  </p>
                </div>
              </>
            )}

            {currentStep === "step5" && (
              <>
                <div className="space-y-1">
                  <Label>Vehicle Details</Label>
                  <p className="text-xs text-muted-foreground">
                    Declare vehicles for parking. Leave blank if no vehicle.
                  </p>
                </div>
                <div className="space-y-3">
                  {vehicleFields.map((vehicle, idx) => (
                    <div key={vehicle.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/50 rounded border border-border">
                      <div>
                        <Label className="text-xs">Vehicle Type</Label>
                        <Input {...form.register(`step5.vehicles.${idx}.vehicleType`)} />
                      </div>
                      <div>
                        <Label className="text-xs">Registration No.</Label>
                        <Input {...form.register(`step5.vehicles.${idx}.registrationNo`)} />
                      </div>
                      <div>
                        <Label className="text-xs">Sticker / RFID No.</Label>
                        <Input {...form.register(`step5.vehicles.${idx}.stickerRfidNo`)} />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    appendVehicle({ vehicleType: "", registrationNo: "", stickerRfidNo: "" })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Vehicle
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Maximum 3 vehicles. Sticker/RFID may be assigned later by management.
                </p>
              </>
            )}

            {currentStep === "step6" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Emergency Contact Name *</Label>
                    <Input {...form.register("step6.emergencyContactName")} />
                    {form.formState.errors.step6?.emergencyContactName && (
                      <p className="text-xs text-destructive">{form.formState.errors.step6.emergencyContactName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Relationship *</Label>
                    <Input {...form.register("step6.emergencyContactRelation")} />
                    {form.formState.errors.step6?.emergencyContactRelation && (
                      <p className="text-xs text-destructive">{form.formState.errors.step6.emergencyContactRelation.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Mobile Number *</Label>
                    <Input placeholder="+91 98765 43210" {...form.register("step6.emergencyContactMobile")} />
                    {form.formState.errors.step6?.emergencyContactMobile && (
                      <p className="text-xs text-destructive">{form.formState.errors.step6.emergencyContactMobile.message}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  This is an emergency contact and not necessarily a family member.
                </p>
              </>
            )}

            {currentStep === "step7" && (
              <>
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Upload documents after submission</p>
                        <p className="text-sm text-muted-foreground">
                          First submit this application (click Next below). Then return to your
                          application detail page to upload documents:
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded border border-border">
                      <div className="flex-1">
                        <p className="text-sm font-medium">ID Proof</p>
                        <p className="text-xs text-muted-foreground">Aadhaar, Passport, Voter ID, or Driving Licence</p>
                      </div>
                      <Badge variant="secondary">Required</Badge>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded border border-border">
                      <div className="flex-1">
                        <p className="text-sm font-medium">Passport-size Photograph</p>
                        <p className="text-xs text-muted-foreground">Recent color photograph</p>
                      </div>
                      <Badge variant="secondary">Required</Badge>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded border border-border">
                      <div className="flex-1">
                        <p className="text-sm font-medium">Rent Agreement / Lease Deed</p>
                        <p className="text-xs text-muted-foreground">Signed rent agreement</p>
                      </div>
                      <Badge variant="secondary">Required</Badge>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded border border-border">
                      <div className="flex-1">
                        <p className="text-sm font-medium">Police Verification</p>
                        <p className="text-xs text-muted-foreground">Acknowledgement or report</p>
                      </div>
                      <Badge variant="secondary">Conditional</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="text-sm text-amber-600">
                      Document upload will be available after application creation.
                    </span>
                  </div>
                </div>
              </>
            )}

            {currentStep === "step8" && (
              <>
                {needsVerification && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Contact Verification</p>
                      <p className="text-xs text-muted-foreground">
                        {verificationChannels.email && verificationChannels.phone
                          ? "Verify both your mobile number and email address before submitting."
                          : verificationChannels.email
                            ? "Verify your email address before submitting."
                            : "Verify your mobile number before submitting."}
                      </p>
                    </div>
                    {verificationChannels.phone && (
                      <PhoneVerification key={`phone-${tenantPhone}`} phone={tenantPhone} />
                    )}
                    {verificationChannels.email && (
                      <EmailVerification key={`email-${tenantEmail}`} email={tenantEmail} />
                    )}
                  </div>
                )}
                <div className="space-y-4">
                  <div className="bg-muted/50 p-4 rounded border border-border">
                    <p className="text-sm font-medium">Declaration &amp; Undertaking</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      I hereby declare that the information provided in this application is true and
                      correct to the best of my knowledge. I understand that any false information
                      may lead to rejection of my application or termination of tenancy.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      I consent to the use of my personal data for verification purposes by Oasis
                      Venetia Heights management.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      {...form.register("step8.consentAccepted")}
                      className="w-4 h-4 rounded border border-input bg-background text-primary"
                    />
                    <label className="text-sm text-muted-foreground cursor-pointer">
                      I accept the declaration and consent to data processing
                    </label>
                    {form.formState.errors.step8?.consentAccepted && (
                      <p className="text-xs text-destructive mt-1">
                        {form.formState.errors.step8.consentAccepted.message}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-between items-center pt-6 border-t">
              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={isSubmitting}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                )}
                {currentStepIndex < STEPS.length - 1 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={isSubmitting}
                    className="ml-2"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-primary text-primary-foreground"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Application"}
                  </Button>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {form.formState.isValid ? "All steps valid" : "Review incomplete fields"}
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function formatStatus(stepId: StepId): string {
  const map: Record<StepId, string> = {
    step1: "Flat Selection",
    step2: "Occupant Details",
    step3: "Family Members",
    step4: "Identity & Police",
    step5: "Vehicles",
    step6: "Emergency Contact",
    step7: "Documents",
    step8: "Declaration",
  };
  return map[stepId];
}


