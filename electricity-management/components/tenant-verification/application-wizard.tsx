"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight, ChevronLeft, X, AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
  tenantEmail: z.string().email().optional().or(z.literal("")),
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
  age: z.coerce.number().optional().nullable(),
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

export default function ApplicationWizard({
  connections,
  phone,
}: {
  connections: Array<{ id: string; flatNo: string; tower: string; residentName?: string | null }>;
  phone?: string;
}) {
  const [currentStep, setCurrentStep] = useState<StepId>("step1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(combinedSchema) as any,
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
        tenantPhone: "",
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

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const isStepValid = (stepId: StepId) => {
    const stepErrors = form.formState.errors;
    const stepFields = STEPS.find((s) => s.id === stepId)!;
    // Simple validation - check if any errors exist for this step
    return true; // Form validation happens on submit
  };

  const goToStep = (stepId: StepId) => {
    setCurrentStep(stepId);
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      // Prepare payload for API
      const payload = {
        ...data.step1,
        ...data.step2,
        ...data.step3,
        ...data.step4,
        ...data.step5,
        ...data.step6,
        ...data.step7,
        ...data.step8,
      };

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

  const completedSteps = new Set<string>();
  // In a real implementation, track completed steps based on form validation

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Tracker */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Step {currentStepIndex + 1} of {STEPS.length}
          </span>
          <Badge variant="secondary">
            {formatStatus(currentStep)}
          </Badge>
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

      <Card>
        <CardHeader>
          <CardTitle>{STEPS.find((s) => s.id === currentStep)?.label}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Flat & Tenancy */}
            {currentStep === "step1" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Select Flat *</Label>
                    <Select
                      onValueChange={(value) => form.setValue("step1.flatId", String(value))}
                      {...form.register("step1.flatId")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a flat" />
                      </SelectTrigger>
                      <SelectContent>
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
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
                <div className="space-y-1">
                  <Label>Permanent Address *</Label>
                  <Input
                    placeholder="Your permanent home address"
                    {...form.register("step1.permanentAddress")}
                  />
                  {form.formState.errors.step1?.permanentAddress && (
                    <p className="text-xs text-destructive">{form.formState.errors.step1.permanentAddress.message}</p>
                  )}
                </div>
              </>
            )}

            {/* Step 2: Primary Occupant */}
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
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Alternate Mobile</Label>
                    <Input placeholder="+91 98765 43210" {...form.register("step2.alternateMobile")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input type="email" placeholder="tenant@example.com" {...form.register("step2.tenantEmail")} />
                    {form.formState.errors.step2?.tenantEmail && (
                      <p className="text-xs text-destructive">{form.formState.errors.step2.tenantEmail.message}</p>
                    )}
                  </div>
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
                  <Label>Office Address *</Label>
                  <Input {...form.register("step2.officeAddress")} />
                  {form.formState.errors.step2?.officeAddress && (
                    <p className="text-xs text-destructive">{form.formState.errors.step2.officeAddress.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Nationality *</Label>
                    <Input {...form.register("step2.nationality")} />
                    {form.formState.errors.step2?.nationality && (
                      <p className="text-xs text-destructive">{form.formState.errors.step2.nationality.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Marital Status *</Label>
                    <Select
                      onValueChange={(value) => form.setValue("step2.maritalStatus", String(value))}
                      {...form.register("step2.maritalStatus")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select marital status" />
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
                </div>
              </>
            )}

            {/* Step 3: Family Members */}
            {currentStep === "step3" && (
              <>
                <div className="space-y-1">
                  <Label>Family Members / Co-occupants</Label>
                  <p className="text-xs text-muted-foreground">
                    Add each family member. Leave blank if there are no additional occupants.
                  </p>
                </div>
                <div className="space-y-3">
                  {(form.getValues("step3.familyMembers") || []).length > 0 ? (
                    <>
                      {(form.getValues("step3.familyMembers") as any[]).map((member, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-muted/50 rounded border border-border">
                          <div>
                            <Label className="text-xs">Full Name</Label>
                            <Input
                              {...form.register(`step3.familyMembers.${idx}.fullName`)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Relationship</Label>
                            <Input {...form.register(`step3.familyMembers.${idx}.relation`)} />
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
                  onClick={() => {
                    const members = form.getValues("step3.familyMembers") || [];
                    form.setValue("step3.familyMembers", [
                      ...members,
                      { fullName: "", relation: "", age: null, idProof: "" },
                    ]);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Family Member
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Maximum 4 family members. Add more only if management approves.
                </p>
              </>
            )}

            {/* Step 4: Identity & Police Verification */}
            {currentStep === "step4" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>ID Proof Type *</Label>
                    <Select
                      onValueChange={(value) => form.setValue("step4.idProofType", String(value))}
                      {...form.register("step4.idProofType")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ID type" />
                      </SelectTrigger>
                      <SelectContent>
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
                </div>
                <div className="space-y-1">
                  <Label>Police Verification Status *</Label>
                  <Select
                    onValueChange={(value) => form.setValue("step4.policeStatus", String(value))}
                    {...form.register("step4.policeStatus")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="APPLIED_IN_PROCESS">Applied / In Process</SelectItem>
                      <SelectItem value="NOT_YET_APPLIED">Not Yet Applied</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.step4?.policeStatus && (
                    <p className="text-xs text-destructive">{form.formState.errors.step4.policeStatus.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Reference Number</Label>
                    <Input {...form.register("step4.policeRefNumber")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Reference Date</Label>
                    <Input type="date" {...form.register("step4.policeRefDate")} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Previous Address</Label>
                  <Input placeholder="Your previous residential address" {...form.register("step4.previousAddress")} />
                </div>
                <p className="text-xs text-muted-foreground">
                  ID number field shows last 4 digits preferred. Do not submit full Aadhaar unless
                  required by management policy.
                </p>
              </>
            )}

            {/* Step 5: Vehicle Details */}
            {currentStep === "step5" && (
              <>
                <div className="space-y-1">
                  <Label>Vehicle Details</Label>
                  <p className="text-xs text-muted-foreground">
                    Declare vehicles for parking. Leave blank if no vehicle.
                  </p>
                </div>
                <div className="space-y-3">
                  {(form.getValues("step5.vehicles") || []).map((v, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/50 rounded border border-border">
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
                  onClick={() => {
                    const vehicles = form.getValues("step5.vehicles") || [];
                    form.setValue("step5.vehicles", [
                      ...vehicles,
                      { vehicleType: "", registrationNo: "", stickerRfidNo: "" },
                    ]);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Vehicle
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Maximum 3 vehicles. Sticker/RFID may be assigned later by management.
                </p>
              </>
            )}

            {/* Step 6: Emergency Contact */}
            {currentStep === "step6" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* Step 7: Documents */}
            {currentStep === "step7" && (
              <>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Upload the following documents. All files are stored privately.
                  </p>
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
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-amber-600">
                    Document upload will be available after application creation. You can return to
                    this application to upload documents.
                  </span>
                </div>
              </>
            )}

            {/* Step 8: Declaration */}
            {currentStep === "step8" && (
              <>
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
                    disabled={isSubmitting || !form.formState.isValid}
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
