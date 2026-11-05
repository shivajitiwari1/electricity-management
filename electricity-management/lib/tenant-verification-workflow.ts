import { prisma } from "@/lib/prisma";
import {
  TenantApplication,
  TenantApplicationStatus,
} from "@prisma/client";
import { isValidTransition } from "@/lib/tenant-verification";

export type WorkflowAction =
  | "SUBMIT"
  | "OWNER_APPROVE"
  | "OWNER_REJECT"
  | "REQUEST_CORRECTION"
  | "RESUBMIT"
  | "MANAGEMENT_APPROVE"
  | "MANAGEMENT_REJECT"
  | "WITHDRAW";

export interface WorkflowTransition {
  action: WorkflowAction;
  fromStatus: TenantApplicationStatus;
  toStatus: TenantApplicationStatus;
  allowedRoles: ("ADMIN" | "MANAGER" | "OWNER" | "TENANT")[];
  requiresRemarks: boolean;
}

/**
 * Defines the complete workflow transition matrix per spec Section 6.
 * Preserves the distinction between owner approval and management approval.
 */
export const WORKFLOW_TRANSITIONS: WorkflowTransition[] = [
  {
    action: "SUBMIT",
    fromStatus: TenantApplicationStatus.PENDING,
    toStatus: TenantApplicationStatus.DOCUMENTS_SUBMITTED,
    allowedRoles: ["TENANT"],
    requiresRemarks: false,
  },
  {
    action: "OWNER_APPROVE",
    fromStatus: TenantApplicationStatus.DOCUMENTS_SUBMITTED,
    toStatus: TenantApplicationStatus.OWNER_APPROVED,
    allowedRoles: ["OWNER"],
    requiresRemarks: false,
  },
  {
    action: "OWNER_REJECT",
    fromStatus: TenantApplicationStatus.DOCUMENTS_SUBMITTED,
    toStatus: TenantApplicationStatus.OWNER_REJECTED,
    allowedRoles: ["OWNER"],
    requiresRemarks: true,
  },
  {
    action: "REQUEST_CORRECTION",
    fromStatus: TenantApplicationStatus.POLICE_VERIFIED,
    toStatus: TenantApplicationStatus.MANAGEMENT_REJECTED,
    allowedRoles: ["ADMIN", "MANAGER"],
    requiresRemarks: true,
  },
  {
    action: "RESUBMIT",
    fromStatus: TenantApplicationStatus.MANAGEMENT_REJECTED,
    toStatus: TenantApplicationStatus.PENDING,
    allowedRoles: ["TENANT"],
    requiresRemarks: false,
  },
  {
    action: "MANAGEMENT_APPROVE",
    fromStatus: TenantApplicationStatus.POLICE_VERIFIED,
    toStatus: TenantApplicationStatus.MANAGEMENT_APPROVED,
    allowedRoles: ["ADMIN", "MANAGER"],
    requiresRemarks: false,
  },
  {
    action: "MANAGEMENT_REJECT",
    fromStatus: TenantApplicationStatus.POLICE_VERIFIED,
    toStatus: TenantApplicationStatus.MANAGEMENT_REJECTED,
    allowedRoles: ["ADMIN", "MANAGER"],
    requiresRemarks: true,
  },
  {
    action: "WITHDRAW",
    fromStatus: TenantApplicationStatus.PENDING,
    toStatus: TenantApplicationStatus.INACTIVE,
    allowedRoles: ["TENANT"],
    requiresRemarks: false,
  },
  {
    action: "WITHDRAW",
    fromStatus: TenantApplicationStatus.DOCUMENTS_SUBMITTED,
    toStatus: TenantApplicationStatus.INACTIVE,
    allowedRoles: ["TENANT"],
    requiresRemarks: false,
  },
];

/**
 * Returns the matching transition for a given action and current status.
 */
export function findTransition(
  action: WorkflowAction,
  fromStatus: TenantApplicationStatus
): WorkflowTransition | undefined {
  return WORKFLOW_TRANSITIONS.find(
    (t) => t.action === action && t.fromStatus === fromStatus
  );
}

/**
 * Validates that a role is allowed to perform an action on a given status.
 */
export function canPerformAction(
  action: WorkflowAction,
  fromStatus: TenantApplicationStatus,
  userRole: "ADMIN" | "MANAGER" | "OWNER" | "TENANT"
): boolean {
  const transition = findTransition(action, fromStatus);
  if (!transition) return false;
  return transition.allowedRoles.includes(userRole);
}

/**
 * Records an approval history entry. Returns the data to insert.
 */
export function buildAuditEntry({
  applicationId,
  action,
  fromStatus,
  toStatus,
  actorUserId,
  actorRole,
  remarks,
}: {
  applicationId: string;
  action: string;
  fromStatus?: TenantApplicationStatus;
  toStatus?: TenantApplicationStatus;
  actorUserId?: string;
  actorRole?: string;
  remarks?: string;
}) {
  return {
    applicationId,
    action,
    fromStatus,
    toStatus,
    actorUserId,
    actorRole,
    remarks,
  };
}

/**
 * Validates that remarks are provided when required by the transition.
 */
export function validateRemarksRequired(
  transition: WorkflowTransition | undefined,
  remarks?: string
): string | null {
  if (transition?.requiresRemarks && (!remarks || remarks.trim().length === 0)) {
    return "Remarks are required for this action.";
  }
  return null;
}
