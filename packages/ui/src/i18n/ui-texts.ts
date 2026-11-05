import { AS_UI_MESSAGES } from "../messages";

/** Message params: the values a text's `{name}` placeholders are filled with. */
export type UiTextParams = Record<string, unknown>;

/**
 * An app's own translator for the built-in UI texts: return the final text
 * (params already filled in), or `undefined` to fall back to the texts the
 * server served for the locale, then to English. `id` is a code of
 * `AS_UI_MESSAGES` (`UI_CANCEL`, …) or a literal text.
 */
export type UiTranslate = (
  id: string,
  params: UiTextParams | undefined,
  locale: string | undefined,
) => string | undefined;

/** `t(id, params?)` — a UI text in the current locale. */
export type UiT = (id: string, params?: UiTextParams) => string;

/** Served texts per locale: `{ [locale]: { [code or text]: template } }` (`""` = no locale). */
type UiDicts = Readonly<Record<string, Readonly<Record<string, string>>>>;

/**
 * One source of UI texts: the browser-global one (`setUiLocale`) or an app's
 * (`provideAsLocale` in `@atscript/vue-form`).
 *
 * @internal Shared with the `@atscript/vue-*` packages.
 */
export interface UiTexts {
  /** The current locale. */
  locale: () => string | undefined;
  /**
   * A text in the current locale — reactive when the locale and the dict
   * are: your translator's text, else the text the server served for the
   * locale, else English (`AS_UI_MESSAGES`), else `id` — with `{name}`
   * placeholders filled.
   */
  t: UiT;
  /**
   * Merges texts the server served for `locale` (an `$i18n` dict: codes and
   * literal texts) into that locale's dict. Pass the locale the request was
   * made for: a late answer for a previous locale lands in that locale's dict,
   * never in the current one.
   */
  merge: (locale: string | undefined, served: unknown) => void;
}

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Fills `{name}` placeholders in one pass (arrays joined with `, `); a
 * placeholder without a param stays, filled-in values are never filled again.
 */
function fill(template: string, params: UiTextParams | undefined): string {
  if (!params || !template.includes("{")) return template;
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = Object.hasOwn(params, name) ? params[name] : undefined;
    if (value === undefined) return match;
    return Array.isArray(value)
      ? value.map(String).join(", ")
      : String(value as string | number | boolean | bigint | null);
  });
}

let failureLogged = false;

/** The translator's text; `undefined` when it has none or throws (logged once). */
function callTranslator(
  translate: UiTranslate,
  id: string,
  params: UiTextParams | undefined,
  locale: string | undefined,
): string | undefined {
  try {
    const out = translate(id, params, locale);
    return typeof out === "string" ? out : undefined;
  } catch (error) {
    if (!failureLogged) {
      failureLogged = true;
      console.error(`[atscript-ui] The UI translator threw for "${id}" (logged once)`, error);
    }
    return undefined;
  }
}

/** The string entries of a served `$i18n` dict, `undefined` when it has none. */
function servedEntries(served: unknown): Record<string, string> | undefined {
  if (typeof served !== "object" || served === null || Array.isArray(served)) return undefined;
  let out: Record<string, string> | undefined;
  for (const [id, text] of Object.entries(served)) {
    if (typeof text === "string") (out ??= {})[id] = text;
  }
  return out;
}

/**
 * Creates a source of UI texts. `dicts` holds the served texts — pass a Vue
 * `shallowRef({})` for reactive lookups; it is replaced wholesale on merge.
 *
 * @internal Shared with the `@atscript/vue-*` packages.
 */
export function createUiTexts(opts: {
  locale: () => string | undefined;
  translate?: () => UiTranslate | undefined;
  dicts?: { value: UiDicts };
}): UiTexts {
  const { locale, translate } = opts;
  const dicts = opts.dicts ?? { value: {} };
  const t: UiT = (id, params) => {
    const loc = locale();
    const translator = translate?.();
    if (translator) {
      const own = callTranslator(translator, id, params, loc);
      // i18n libraries answer a missing key with the key itself: untranslated.
      if (own !== undefined && own !== id) return own;
    }
    const dict = dicts.value[loc ?? ""];
    const template =
      dict && Object.hasOwn(dict, id)
        ? dict[id]
        : Object.hasOwn(AS_UI_MESSAGES, id)
          ? AS_UI_MESSAGES[id as keyof typeof AS_UI_MESSAGES]
          : id;
    return fill(template, params);
  };
  const merge = (loc: string | undefined, served: unknown) => {
    const entries = servedEntries(served);
    if (!entries) return;
    const key = loc ?? "";
    const prev = dicts.value[key];
    if (prev && Object.keys(entries).every((id) => prev[id] === entries[id])) return;
    dicts.value = { ...dicts.value, [key]: Object.freeze({ ...prev, ...entries }) };
  };
  return { locale, t, merge };
}

// ── The browser-global source ────────────────────────────────

let globalLocale: string | undefined;
let globalTranslate: UiTranslate | undefined;
const globalTexts = createUiTexts({
  locale: () => globalLocale,
  translate: () => globalTranslate,
});
/** Activated sources, most recent last; the global one when empty. */
const activated: UiTexts[] = [];

/**
 * Sets the locale of the built-in UI texts, and optionally your own
 * translator for them, for an app that does not use the Vue provider
 * (`provideAsLocale` in `@atscript/vue-form`). Browser-global: never call it
 * on a server that renders for many users.
 *
 * @example
 * ```ts
 * setUiLocale("de", (id, params) => i18n.t(id, params));
 * ```
 */
export function setUiLocale(locale: string | undefined, translate?: UiTranslate): void {
  globalLocale = locale;
  globalTranslate = translate;
}

/**
 * The texts code outside a component reads (definitions built from
 * metadata, table state): the browser-side app provider's when one is
 * active, else the browser-global ones (`setUiLocale`).
 *
 * @internal Shared with the `@atscript/vue-*` packages.
 */
export function getUiTexts(): UiTexts {
  return activated.at(-1) ?? globalTexts;
}

/**
 * Makes `texts` the ones {@link getUiTexts} returns (browser only — the Vue
 * provider never calls it on a server) until undone; undoing one of several
 * gives the most recent remaining one back. Returns the undo (idempotent).
 *
 * @internal Shared with `@atscript/vue-form`.
 */
export function activateUiTexts(texts: UiTexts): () => void {
  activated.push(texts);
  let undone = false;
  return () => {
    if (undone) return;
    undone = true;
    activated.splice(activated.lastIndexOf(texts), 1);
  };
}
