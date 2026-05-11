import { type ComputedRef, type InjectionKey, computed, inject, provide } from "vue";

/**
 * BCP-47 locale for form-side decimal formatting (separator, thousands,
 * currency symbol). Parallels `provideCellLocale` in `@atscript/vue-table`
 * but lives in vue-form so the form package stays free of cross-package
 * coupling — the host wires both providers from a single source (e.g.
 * `useAppPrefs` in vue-table).
 *
 * The injected value is a getter so reactive sources (e.g.
 * `prefs.value?.language`) can be passed without forcing the caller to
 * wrap them in a computed.
 */
const AS_LOCALE_KEY: InjectionKey<() => string | undefined> = Symbol("as-locale");

export function provideAsLocale(getter: () => string | undefined): void {
  provide(AS_LOCALE_KEY, getter);
}

export interface UseAsLocaleReturn {
  /** Resolved locale; `undefined` when no provider is present (runtime locale). */
  locale: ComputedRef<string | undefined>;
}

export function useAsLocale(): UseAsLocaleReturn {
  const getter = inject(AS_LOCALE_KEY, () => undefined);
  return { locale: computed(() => getter()) };
}
