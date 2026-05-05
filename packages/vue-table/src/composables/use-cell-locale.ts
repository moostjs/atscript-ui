import { computed, inject, provide, type ComputedRef, type MaybeRefOrGetter, toValue } from "vue";

// Decoupled from `useAppPrefs` so cells stay framework-agnostic at the prefs
// source — the app root decides where the values come from and pipes them in.
export interface CellLocale {
  language?: string;
  timezone?: string;
}

const CELL_LOCALE_KEY = "__as_cell_locale";

export function provideCellLocale(source: MaybeRefOrGetter<CellLocale | undefined>): void {
  provide(CELL_LOCALE_KEY, source);
}

export function useCellLocale(): {
  locale: ComputedRef<string>;
  timezone: ComputedRef<string | undefined>;
} {
  const source = inject<MaybeRefOrGetter<CellLocale | undefined>>(CELL_LOCALE_KEY, undefined);
  const locale = computed(() => {
    const lang = source ? toValue(source)?.language : undefined;
    if (lang && lang.trim().length > 0) return lang;
    return typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
  });
  const timezone = computed(() => {
    const tz = source ? toValue(source)?.timezone : undefined;
    // Empty / "system" → let Intl pick the browser TZ (passing "system" to
    // DateTimeFormat throws).
    if (!tz || tz === "system") return undefined;
    return tz;
  });
  return { locale, timezone };
}
