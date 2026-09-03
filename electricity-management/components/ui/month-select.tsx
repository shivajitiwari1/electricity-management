"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** "2026-09" → "Sept 2026". */
export function formatMonthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

/** Month key of a date, in local time so it matches the date as displayed. */
export function monthKeyOf(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey() {
  return monthKeyOf(new Date());
}

/**
 * A rolling window of month keys, newest first. For picking a month to create
 * data in — a list derived from existing rows could not offer next month.
 */
export function monthRange({ back = 24, forward = 3 } = {}) {
  const now = new Date();
  const keys: string[] = [];
  for (let offset = forward; offset >= -back; offset--) {
    keys.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() + offset, 1)));
  }
  return keys;
}

/** The months present in a set of dates, newest first. */
export function monthOptionsFrom(dates: (string | Date)[]) {
  return [...new Set(dates.map(monthKeyOf))].sort().reverse();
}

interface MonthSelectProps {
  /** A month key ("2026-09"), or `allValue` for no month filter. */
  value: string;
  onChange: (value: string) => void;
  options: string[];
  /** Adds an "all months" entry; its selected value is `allValue`. */
  allowAll?: boolean;
  allLabel?: string;
  allValue?: string;
  className?: string;
  placeholder?: string;
  id?: string;
}

export function MonthSelect({
  value,
  onChange,
  options,
  allowAll = false,
  allLabel = "All months",
  allValue = "all",
  className = "w-40",
  placeholder = "Select month",
  id,
}: MonthSelectProps) {
  const isAll = allowAll && value === allValue;
  // A value outside the option list (an older month, or one with no rows left)
  // still has to be selectable, or the trigger would show a blank.
  const keys = !isAll && value && !options.includes(value) ? [value, ...options] : options;

  return (
    <Select value={value} onValueChange={(val) => onChange((val as string | null) ?? value)}>
      <SelectTrigger className={className} id={id}>
        {/* This Select renders the raw value in its trigger, so format it here. */}
        <SelectValue placeholder={placeholder}>
          {(selected) => {
            const key = selected == null ? "" : String(selected);
            if (!key) return placeholder;
            if (allowAll && key === allValue) return allLabel;
            return formatMonthLabel(key);
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value={allValue}>{allLabel}</SelectItem>}
        {keys.map((key) => (
          <SelectItem key={key} value={key}>
            {formatMonthLabel(key)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
