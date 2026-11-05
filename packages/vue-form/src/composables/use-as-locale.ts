import {
  activateUiTexts,
  createUiTexts,
  getUiTexts,
  type UiT,
  type UiTexts,
  type UiTranslate,
} from "@atscript/ui";
import {
  type ComputedRef,
  type InjectionKey,
  computed,
  hasInjectionContext,
  inject,
  onScopeDispose,
  provide,
  shallowRef,
} from "vue";

/**
 * The app's locale and UI texts: the BCP-47 locale for form-side `Intl`
 * formatting (decimal separator, thousands, currency symbol) and the
 * language of the built-in texts (buttons, labels, messages) of every
 * `@atscript/vue-*` component. Parallels `provideCellLocale` in
 * `@atscript/vue-table`, which owns the table's `Intl` locale and time zone —
 * the host wires both from a single source (e.g. `useAppPrefs`).
 *
 * One per app, never module-global: a server rendering for many users keeps
 * each app's locale. Interned (`Symbol.for`): one key across module copies.
 */
const AS_LOCALE_KEY: InjectionKey<UiTexts> = Symbol.for("atscript.ui.locale");

/**
 * Provides the app's locale. `getter` returns a BCP-47 locale (or
 * `undefined` for the runtime's); reactive sources work as they are
 * (`() => prefs.value.language`). The built-in texts follow it: the texts the
 * server served for the locale, else English — or your own `translate`
 * first (return `undefined` to fall back).
 *
 * Call it once at the app root. To switch the language of an open page,
 * remount the view (`<RouterView :key="locale" />`).
 */
export function provideAsLocale(getter: () => string | undefined, translate?: UiTranslate): void {
  const texts = createUiTexts({
    locale: getter,
    translate: translate && (() => translate),
    dicts: shallowRef({}),
  });
  provide(AS_LOCALE_KEY, texts);
  // Code outside components (definitions built from metadata, table state)
  // reads the browser app's texts; on a server it never sees an app's.
  if (typeof window !== "undefined") onScopeDispose(activateUiTexts(texts));
}

export interface UseAsLocaleReturn {
  /** Resolved locale; `undefined` when no provider is present (runtime locale). */
  locale: ComputedRef<string | undefined>;
  /**
   * A built-in UI text in the app's locale — `t("UI_CANCEL")`,
   * `t("UI_FORM_ADD", { item: "address" })`. The codes and their English
   * texts are `AS_UI_MESSAGES` (`@atscript/ui/messages`).
   */
  t: UiT;
}

function injectTexts(): UiTexts | null {
  return hasInjectionContext() ? inject(AS_LOCALE_KEY, null) : null;
}

/**
 * The app's UI texts (`provideAsLocale`), else the global ones
 * (`setUiLocale`). One `inject` — cheap enough for per-row components.
 *
 * @internal Shared with `@atscript/vue-table` and `@atscript/vue-wf`.
 */
export function useAsTexts(): UiTexts {
  return injectTexts() ?? getUiTexts();
}

export function useAsLocale(): UseAsLocaleReturn {
  const provided = injectTexts();
  const texts = provided ?? getUiTexts();
  return { locale: computed(() => provided?.locale()), t: texts.t };
}
