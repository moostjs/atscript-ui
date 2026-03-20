/** A date shortcut produces a label and a [start, end] ISO date range. */
export interface DateShortcut {
  label: string;
  dates: [start: string, end: string];
}

/**
 * Generate date filter shortcuts relative to the given date (defaults to now).
 * Each shortcut produces a `bw` (between) condition range using ISO date strings (YYYY-MM-DD).
 */
export function dateShortcuts(now?: Date): DateShortcut[] {
  const today = now ?? new Date();
  const todayISO = toISO(today);

  return [
    { label: "Last 7 Days", dates: [toISO(daysAgo(today, 7)), todayISO] },
    { label: "Last 30 Days", dates: [toISO(daysAgo(today, 30)), todayISO] },
    { label: "Month to Date", dates: [toISO(monthStart(today)), todayISO] },
    { label: "Last 90 Days", dates: [toISO(daysAgo(today, 90)), todayISO] },
    { label: "Last 6 Months", dates: [toISO(monthsAgo(today, 6)), todayISO] },
    { label: "Last 12 Months", dates: [toISO(monthsAgo(today, 12)), todayISO] },
    { label: "Year to Date", dates: [toISO(yearStart(today)), todayISO] },
  ];
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysAgo(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d;
}

function monthsAgo(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() - months);
  return d;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function yearStart(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}
