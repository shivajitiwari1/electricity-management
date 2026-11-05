import {
  TenantApplicationStatus,
  VerificationDocumentType,
} from "@prisma/client";

export function formatDocumentType(type: VerificationDocumentType): string {
  const map: Record<VerificationDocumentType, string> = {
    [VerificationDocumentType.ID_PROOF]: "ID Proof",
    [VerificationDocumentType.ADDRESS_PROOF]: "Address Proof",
    [VerificationDocumentType.RENT_AGREEMENT]: "Rent Agreement",
    [VerificationDocumentType.NOC]: "NOC",
    [VerificationDocumentType.PHOTO]: "Photo",
    [VerificationDocumentType.OTHER]: "Other",
  };
  return map[type];
}

export function formatStatus(status: TenantApplicationStatus): string {
  const map: Record<TenantApplicationStatus, string> = {
    [TenantApplicationStatus.PENDING]: "Draft",
    [TenantApplicationStatus.DOCUMENTS_SUBMITTED]: "Submitted",
    [TenantApplicationStatus.OWNER_APPROVED]: "Owner Approved",
    [TenantApplicationStatus.OWNER_REJECTED]: "Owner Rejected",
    [TenantApplicationStatus.POLICE_VERIFICATION_PENDING]:
      "Police Verification Pending",
    [TenantApplicationStatus.POLICE_VERIFIED]: "Police Verified",
    [TenantApplicationStatus.POLICE_VERIFICATION_FAILED]:
      "Police Verification Failed",
    [TenantApplicationStatus.MANAGEMENT_APPROVED]: "Management Approved",
    [TenantApplicationStatus.MANAGEMENT_REJECTED]: "Management Rejected",
    [TenantApplicationStatus.ACTIVE]: "Active",
    [TenantApplicationStatus.INACTIVE]: "Inactive",
  };
  return map[status];
}

export function statusColor(status: TenantApplicationStatus): string {
  const map: Record<TenantApplicationStatus, string> = {
    [TenantApplicationStatus.PENDING]: "bg-yellow-100 text-yellow-800",
    [TenantApplicationStatus.DOCUMENTS_SUBMITTED]: "bg-blue-100 text-blue-800",
    [TenantApplicationStatus.OWNER_APPROVED]: "bg-emerald-100 text-emerald-800",
    [TenantApplicationStatus.OWNER_REJECTED]: "bg-rose-100 text-rose-800",
    [TenantApplicationStatus.POLICE_VERIFICATION_PENDING]:
      "bg-yellow-100 text-yellow-800",
    [TenantApplicationStatus.POLICE_VERIFIED]: "bg-emerald-100 text-emerald-800",
    [TenantApplicationStatus.POLICE_VERIFICATION_FAILED]:
      "bg-rose-100 text-rose-800",
    [TenantApplicationStatus.MANAGEMENT_APPROVED]: "bg-emerald-100 text-emerald-800",
    [TenantApplicationStatus.MANAGEMENT_REJECTED]: "bg-rose-100 text-rose-800",
    [TenantApplicationStatus.ACTIVE]: "bg-emerald-100 text-emerald-800",
    [TenantApplicationStatus.INACTIVE]: "bg-slate-100 text-slate-800",
  };
  return map[status] ?? "bg-slate-100 text-slate-800";
}
