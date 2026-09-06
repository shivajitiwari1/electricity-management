/**
 * Month-key helpers. A month key is "YYYY-MM". Kept out of the client
 * component so server components can import them too.
 */

/** "2026-09" → "September 2026". */
export function formatMonthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
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

/** The month before the current one — what most "this cycle" views want. */
export function previousMonthKey() {
  const now = new Date();
  return monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}
