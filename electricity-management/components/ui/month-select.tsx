"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatMonthLabel,
  monthKeyOf,
  currentMonthKey,
  previousMonthKey,
  monthRange,
  monthOptionsFrom,
} from "@/lib/month";

export { formatMonthLabel, monthKeyOf, currentMonthKey, previousMonthKey, monthRange, monthOptionsFrom };

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
