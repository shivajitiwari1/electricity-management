import { prisma } from "@/lib/prisma";
import { TenantApplicationStatus, VerificationDocumentType } from "@prisma/client";

export const TENANT_APP_PREFIX = "TV";

/**
 * Generates the next application number prefixed with TV-.
 * Callers should retry on a unique-constraint violation if there is a race.
 */
export async function nextTenantApplicationNumber() {
  const latest = await prisma.tenantApplication.findFirst({
    where: { applicationNumber: { startsWith: `${TENANT_APP_PREFIX}-` } },
    orderBy: { applicationNumber: "desc" },
    select: { applicationNumber: true },
  });

  const latestNumber = latest
    ? Number(latest.applicationNumber.replace(/\D/g, ""))
    : 0;
  const next = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;
  return `${TENANT_APP_PREFIX}-${String(next).padStart(5, "0")}`;
}

/**
 * Generates a random, unguessable application token for public tracking.
 */
export function generateApplicationToken() {
  const buf = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Phase 1 workflow status transition matrix.
 * Maps Phase 1 design statuses to existing database enum values.
 *
 * Phase 1: DRAFT → SUBMITTED → OWNER_PENDING → MANAGEMENT_PENDING → APPROVED/REJECTED
 * DB enum: PENDING → DOCUMENTS_SUBMITTED → OWNER_APPROVED → POLICE_VERIFIED → MANAGEMENT_APPROVED/REJECTED
 */
export const ALLOWED_TRANSITIONS: Record<
  TenantApplicationStatus,
  TenantApplicationStatus[]
> = {
  [TenantApplicationStatus.PENDING]: [
    TenantApplicationStatus.DOCUMENTS_SUBMITTED,
    TenantApplicationStatus.INACTIVE,
  ],
  [TenantApplicationStatus.DOCUMENTS_SUBMITTED]: [
    TenantApplicationStatus.OWNER_APPROVED,
    TenantApplicationStatus.OWNER_REJECTED,
    TenantApplicationStatus.INACTIVE,
  ],
  [TenantApplicationStatus.OWNER_APPROVED]: [
    TenantApplicationStatus.POLICE_VERIFICATION_PENDING,
    TenantApplicationStatus.INACTIVE,
  ],
  [TenantApplicationStatus.OWNER_REJECTED]: [
    TenantApplicationStatus.PENDING,
    TenantApplicationStatus.INACTIVE,
  ],
  [TenantApplicationStatus.POLICE_VERIFICATION_PENDING]: [
    TenantApplicationStatus.POLICE_VERIFIED,
    TenantApplicationStatus.POLICE_VERIFICATION_FAILED,
    TenantApplicationStatus.INACTIVE,
  ],
  [TenantApplicationStatus.POLICE_VERIFIED]: [
    TenantApplicationStatus.MANAGEMENT_APPROVED,
    TenantApplicationStatus.MANAGEMENT_REJECTED,
    TenantApplicationStatus.INACTIVE,
  ],
  [TenantApplicationStatus.POLICE_VERIFICATION_FAILED]: [
    TenantApplicationStatus.OWNER_APPROVED,
    TenantApplicationStatus.INACTIVE,
  ],
  [TenantApplicationStatus.MANAGEMENT_APPROVED]: [
    TenantApplicationStatus.ACTIVE,
    TenantApplicationStatus.INACTIVE,
  ],
  [TenantApplicationStatus.MANAGEMENT_REJECTED]: [
    TenantApplicationStatus.PENDING,
    TenantApplicationStatus.INACTIVE,
  ],
  [TenantApplicationStatus.ACTIVE]: [TenantApplicationStatus.INACTIVE],
  [TenantApplicationStatus.INACTIVE]: [TenantApplicationStatus.PENDING],
};

export function isValidTransition(
  from: TenantApplicationStatus,
  to: TenantApplicationStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Maps a DB status to its Phase 1 workflow phase for display purposes.
 */
export function toWorkflowPhase(status: TenantApplicationStatus): string {
  const map: Record<TenantApplicationStatus, string> = {
    [TenantApplicationStatus.PENDING]: "DRAFT",
    [TenantApplicationStatus.DOCUMENTS_SUBMITTED]: "SUBMITTED",
    [TenantApplicationStatus.OWNER_APPROVED]: "OWNER_PENDING",
    [TenantApplicationStatus.OWNER_REJECTED]: "REJECTED",
    [TenantApplicationStatus.POLICE_VERIFICATION_PENDING]: "OWNER_PENDING",
    [TenantApplicationStatus.POLICE_VERIFIED]: "MANAGEMENT_PENDING",
    [TenantApplicationStatus.POLICE_VERIFICATION_FAILED]: "REJECTED",
    [TenantApplicationStatus.MANAGEMENT_APPROVED]: "APPROVED",
    [TenantApplicationStatus.MANAGEMENT_REJECTED]: "REJECTED",
    [TenantApplicationStatus.ACTIVE]: "APPROVED",
    [TenantApplicationStatus.INACTIVE]: "WITHDRAWN",
  };
  return map[status];
}

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
