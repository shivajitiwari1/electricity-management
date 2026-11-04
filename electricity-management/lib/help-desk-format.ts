const STATUS_LABELS: Record<string, string> = {
  OPEN: "Ticket Open",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  AUTO_CLOSED: "Auto Closed",
  CANCELLED: "Cancelled",
  NOT_AN_ISSUE: "Not an Issue",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const TYPE_LABELS: Record<string, string> = {
  PERSONAL: "Personal",
  PUBLIC: "Public",
};

export function formatTicketStatus(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function formatTicketPriority(priority: string) {
  return PRIORITY_LABELS[priority] ?? priority;
}

export function formatTicketType(type: string) {
  return TYPE_LABELS[type] ?? type;
}

export function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    OPEN: "bg-amber-100 text-amber-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    ON_HOLD: "bg-slate-100 text-slate-800",
    RESOLVED: "bg-green-100 text-green-800",
    CLOSED: "bg-green-100 text-green-800",
    AUTO_CLOSED: "bg-slate-100 text-slate-800",
    CANCELLED: "bg-red-100 text-red-800",
    NOT_AN_ISSUE: "bg-purple-100 text-purple-800",
  };
  return map[status] ?? "bg-gray-100 text-gray-800";
}

export function priorityBadgeClass(priority: string) {
  const map: Record<string, string> = {
    LOW: "bg-slate-100 text-slate-700",
    MEDIUM: "bg-blue-100 text-blue-800",
    HIGH: "bg-amber-100 text-amber-800",
    URGENT: "bg-red-100 text-red-800",
  };
  return map[priority] ?? "bg-gray-100 text-gray-800";
}
