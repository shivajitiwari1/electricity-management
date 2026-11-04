import { prisma } from "@/lib/prisma";
import { AssignmentSlotKind, type Prisma } from "@prisma/client";

export type FlatLocation = { id: string; flatNo: string; tower: string };

const WEEKDAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

function minutesInKolkata() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    weekday: get("weekday").toUpperCase(),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function slotMatches(day: string, startTime: string, endTime: string) {
  const { weekday, minutes } = minutesInKolkata();
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const dayMatch = day === "EVERYDAY" || day.toUpperCase() === weekday;
  return dayMatch && minutes >= start && minutes <= end;
}

/**
 * Picks the assignee for a new ticket from the configured assignment rules,
 * if any apply to the category/subcategory and current IST time window.
 */
export async function resolveTicketAssignee(
  categoryId: string,
  subcategoryId: string | null
) {
  const ruleKinds = new Set([AssignmentSlotKind.TICKET]);

  const candidateRules = await prisma.assignmentRule.findMany({
    where: {
      categoryId,
      OR: [{ subcategoryId: null }, ...(subcategoryId ? [{ subcategoryId }] : [])],
    },
    include: {
      slots: {
        where: { kind: { in: [...ruleKinds] } },
      },
    },
  });

  if (candidateRules.length === 0) return null;

  // Prefer the most specific (subcategory) rule, then first matching slot.
  for (const rule of candidateRules.sort(
    (a, b) => Number(b.subcategoryId !== null) - Number(a.subcategoryId !== null)
  )) {
    if (rule.slots.length === 0) return rule.assigneeId;
    const match = rule.slots.find((slot) =>
      slotMatches(slot.day, slot.startTime, slot.endTime)
    );
    if (match) return rule.assigneeId;
  }

  return null;
}

const unitToMinutes: Record<string, number> = {
  MINUTES: 1,
  HOURS: 60,
  DAYS: 60 * 24,
};

/**
 * Finds the first escalation step for a category/priority and returns the
 * absolute time by which someone must respond, or null when no rule exists.
 */
export async function computeSlaDueAt(
  categoryId: string,
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
) {
  const rule = await prisma.escalationRule.findUnique({
    where: { categoryId_priority: { categoryId, priority } },
    include: { steps: { orderBy: { level: "asc" }, take: 1 } },
  });

  const step = rule?.steps[0];
  if (!step) return null;

  const minutes = (unitToMinutes[step.timeUnit.toUpperCase()] ?? 1) * step.timeValue;
  return new Date(Date.now() + minutes * 60 * 1000);
}

/** Builds a list of levels that should be escalated to at the current time. */
export async function escalationStepAt(
  ruleId: string,
  currentLevel: number
) {
  return prisma.escalationStep.findFirst({
    where: { ruleId, level: currentLevel + 1 },
  });
}
