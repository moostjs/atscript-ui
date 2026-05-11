// Intl formatter constructors are expensive (~50–200μs cached, 0.5–2ms cold).
// Inside virtual-scroll tables, cells re-format on every recycle, so a single
// keyed cache shared across renders eliminates the per-row construction cost.
// Number-format caching lives in `@atscript/ui` (`decimal-format.ts`) so form
// + table render through one path; this file keeps the date-time cache only.

const dateTimeCache = new Map<string, Intl.DateTimeFormat>();

export function getDateTimeFormat(
  locale: string,
  opts: Intl.DateTimeFormatOptions = {},
): Intl.DateTimeFormat {
  const key = `${locale}|${opts.timeZone ?? ""}|${opts.year ?? ""}|${opts.month ?? ""}|${opts.day ?? ""}|${opts.hour ?? ""}|${opts.minute ?? ""}`;
  let f = dateTimeCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, opts);
    dateTimeCache.set(key, f);
  }
  return f;
}
