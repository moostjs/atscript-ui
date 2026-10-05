import { DEV } from "./dev";

// Intl formatter constructors are expensive (~50–200μs cached, 0.5–2ms cold).
// Virtual-scroll cells re-format on every recycle and every filter chip and
// zone lookup formats too, so one cache serves them all. A `null` entry is a
// construction that failed (an unknown time zone), remembered so it is neither
// retried nor warned about twice.
const cache = new Map<string, Intl.DateTimeFormat | null>();

function lookup(
  locale: string | undefined,
  opts: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat | null {
  const key = `${locale ?? ""}|${Object.keys(opts)
    .toSorted()
    .map((k) => `${k}=${String(opts[k as keyof Intl.DateTimeFormatOptions])}`)
    .join(",")}`;
  let format = cache.get(key);
  if (format === undefined) {
    try {
      format = new Intl.DateTimeFormat(locale, opts);
    } catch {
      format = null;
      if (DEV && opts.timeZone) {
        console.warn(`[ui-table] Unknown time zone "${opts.timeZone}"; using the local zone.`);
      }
    }
    cache.set(key, format);
  }
  return format;
}

/**
 * A cached `Intl.DateTimeFormat`. An unknown `timeZone` reads on the runtime's
 * own clock instead of throwing.
 *
 * @internal Shared with `@atscript/vue-table`.
 */
export function getDateTimeFormat(
  locale: string | undefined,
  opts: Intl.DateTimeFormatOptions = {},
): Intl.DateTimeFormat {
  const format = lookup(locale, opts);
  if (format) return format;
  const { timeZone: _unknown, ...local } = opts;
  return lookup(locale, local) ?? new Intl.DateTimeFormat(locale);
}

const ZONE_PARTS: Intl.DateTimeFormatOptions = {
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
};

/** The formatter that reads a zone's wall clock as numeric parts; `null` for an unknown zone. */
export function getZoneFormat(timeZone: string): Intl.DateTimeFormat | null {
  return lookup("en-US", { ...ZONE_PARTS, timeZone });
}
