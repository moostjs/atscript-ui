interface WeekInfoLocale {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
}

/**
 * The first day of the week for a locale, `1` = Monday … `7` = Sunday, from
 * `Intl.Locale#getWeekInfo` where the runtime has it; `undefined` otherwise
 * (callers then default to Monday).
 */
export function weekStartOf(locale: string | undefined): number | undefined {
  if (!locale) return undefined;
  try {
    const l = new Intl.Locale(locale) as unknown as WeekInfoLocale;
    const day = (l.getWeekInfo?.() ?? l.weekInfo)?.firstDay;
    return typeof day === "number" && day >= 1 && day <= 7 ? day : undefined;
  } catch {
    return undefined;
  }
}
