import {
  activateUiTexts,
  createUiTexts,
  getUiTexts,
  onUiLocaleChange,
  type UiT,
  type UiTexts,
  type UiTranslate,
} from "@atscript/ui";
import {
  type App,
  type ComputedRef,
  type InjectionKey,
  type ShallowRef,
  computed,
  getCurrentScope,
  hasInjectionContext,
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  ssrContextKey,
  watch,
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
 * The texts the server served during a server render (`/meta` `$i18n`, …), per
 * locale (`""` = no locale): what {@link getAsServedTexts} collects and
 * {@link provideAsServedTexts} hands to the browser app. Plain JSON.
 */
export type AsServedTexts = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** The server-rendered texts the browser app starts with (`provideAsServedTexts`). */
const AS_SERVED_TEXTS_KEY: InjectionKey<AsServedTexts> = Symbol.for("atscript.ui.served-texts");
/** Where a server render's app texts are kept on the Vue SSR context. */
const SSR_TEXTS = Symbol.for("atscript.ui.ssr-texts");

/**
 * Provides the app's locale. `getter` returns a BCP-47 locale (or
 * `undefined` for the runtime's); reactive sources work as they are
 * (`() => prefs.value.language`). The built-in texts follow it: the texts the
 * server served for the locale, else English — or your own `translate`
 * first (return `undefined` to fall back).
 *
 * Call it once at the app root. To switch the language of an open page,
 * remount the view (`<RouterView :key="locale" />`): the built-in component
 * texts, tables and value help follow a new locale at the next mount (a form's own
 * model texts re-render without a remount). With server rendering,
 * hand the texts the render used to the browser app: {@link getAsServedTexts}
 * and {@link provideAsServedTexts}.
 */
export function provideAsLocale(getter: () => string | undefined, translate?: UiTranslate): void {
  const ownTranslate = translate && (() => translate);
  // A server render keeps this request's texts on its SSR context, for
  // `getAsServedTexts` — never in module state.
  const ssr =
    typeof window === "undefined"
      ? (inject(ssrContextKey, null) as Record<symbol, SsrTexts | undefined> | null)
      : null;
  const render = ssr
    ? (ssr[SSR_TEXTS] ??= { dicts: shallowRef<AsServedTexts>({}), unserved: new Map() })
    : null;
  // The providers of one server render share its served texts, as the
  // hydrating browser's providers all start with the same snapshot.
  let texts = createUiTexts({
    locale: getter,
    translate: ownTranslate,
    dicts: render?.dicts ?? shallowRef({}),
  });
  // A hydrating app starts with the texts its server render used.
  const seed = inject(AS_SERVED_TEXTS_KEY, null);
  if (seed) {
    for (const [locale, dict] of Object.entries(seed)) texts.merge(locale || undefined, dict);
  }
  if (render) texts = pinUnserved(texts, render, ownTranslate);
  provide(AS_LOCALE_KEY, texts);
  // Code outside components (definitions built from metadata, table state)
  // reads the browser app's texts; on a server it never sees an app's.
  if (typeof window !== "undefined") onScopeDispose(activateUiTexts(texts));
}

/** A server render's served texts (shared by its providers), and the ids it read before they were served. */
interface SsrTexts {
  dicts: ShallowRef<AsServedTexts>;
  /** Per locale (`""` = none): ids some provider looked up before a text was served for them. */
  unserved: Map<string, Set<string>>;
}

/**
 * `texts` for one server render, so the HTML and the hydrating browser agree
 * everywhere: an id looked up before the server served a text for it shows
 * the fallback (`translate`, else English) for the rest of the render — in
 * every provider of the render — and is left out of `getAsServedTexts`.
 */
function pinUnserved(
  texts: UiTexts,
  render: SsrTexts,
  translate: (() => UiTranslate | undefined) | undefined,
): UiTexts {
  // The same texts without any served dict: the fallback a pinned id shows.
  const fallback = createUiTexts({ locale: texts.locale, translate });
  return {
    ...texts,
    t: (id, params) => {
      const key = texts.locale() ?? "";
      let pinned = render.unserved.get(key);
      if (pinned?.has(id)) return fallback.t(id, params);
      const dict = render.dicts.value[key];
      if (!dict || !Object.hasOwn(dict, id)) {
        if (!pinned) render.unserved.set(key, (pinned = new Set()));
        pinned.add(id);
      }
      return texts.t(id, params);
    },
  };
}

/**
 * Server side: the texts the server served while rendering this app (merged
 * into its `provideAsLocale` texts, e.g. `/meta` `$i18n`) — pass the context
 * object you gave `renderToString(app, ssrContext)`, after it resolves.
 * `undefined` when nothing was served (or the app has no `provideAsLocale`).
 * Put it into the state your server transfers to the browser and give it to
 * {@link provideAsServedTexts} there, so the browser renders the same texts
 * before its own requests come back.
 *
 * A text the render looked up before the server served it shows the fallback
 * everywhere in that render and is left out: the hydrating browser shows the
 * fallback too, and its own request switches it afterwards. Since 0.1.168.
 */
export function getAsServedTexts(ssrContext: object): AsServedTexts | undefined {
  const render = (ssrContext as Record<symbol, SsrTexts | undefined>)[SSR_TEXTS];
  if (!render) return undefined;
  let out: Record<string, Record<string, string>> | undefined;
  for (const [locale, dict] of Object.entries(render.dicts.value)) {
    const skip = render.unserved.get(locale);
    for (const [id, text] of Object.entries(dict)) {
      if (skip?.has(id)) continue;
      ((out ??= {})[locale] ??= {})[id] = text;
    }
  }
  return out;
}

/**
 * Browser side: the texts the server render used ({@link getAsServedTexts}),
 * merged into the app's texts when `provideAsLocale` creates them — call it
 * before `app.mount()`. Nothing to merge (`undefined`) is fine. Since 0.1.168.
 *
 * @example
 * ```ts
 * const { app } = createApp();
 * provideAsServedTexts(app, window.__SSR_STATE__?.asTexts);
 * app.mount("#app");
 * ```
 */
export function provideAsServedTexts(app: App, served: AsServedTexts | undefined): void {
  if (served) app.provide(AS_SERVED_TEXTS_KEY, served);
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

/**
 * The app's UI texts when a `provideAsLocale` is above the caller, else `null`.
 *
 * @internal Shared with `@atscript/vue-table`.
 */
export function injectAsTexts(): UiTexts | null {
  return hasInjectionContext() ? inject(AS_LOCALE_KEY, null) : null;
}

/**
 * The app's UI texts (`provideAsLocale`), else the global ones
 * (`setUiLocale`). One `inject` — cheap enough for per-row components.
 *
 * @internal Shared with `@atscript/vue-table` and `@atscript/vue-wf`.
 */
export function useAsTexts(): UiTexts {
  return injectAsTexts() ?? getUiTexts();
}

export function useAsLocale(): UseAsLocaleReturn {
  const provided = injectAsTexts();
  const texts = provided ?? getUiTexts();
  return { locale: computed(() => provided?.locale()), t: texts.t };
}

/**
 * The app's current UI locale as a ref: follows a `provideAsLocale` getter
 * and `setUiLocale` (which is not reactive) — for a `:key` that rebuilds a
 * view, or a watch that re-binds one, when the locale changes.
 *
 * @internal Shared with `@atscript/vue-table`.
 */
export function useUiLocaleKey(texts: Pick<UiTexts, "locale">): ShallowRef<string | undefined> {
  const key = shallowRef(texts.locale());
  const sync = () => {
    key.value = texts.locale();
  };
  watch(() => texts.locale(), sync);
  if (typeof window !== "undefined" && getCurrentScope()) onScopeDispose(onUiLocaleChange(sync));
  return key;
}
