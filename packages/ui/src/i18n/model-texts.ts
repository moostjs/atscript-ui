import {
  deserializeAnnotatedType,
  translateUserText,
  type TAtscriptAnnotatedType,
  type TSerializedAnnotatedType,
} from "@atscript/typescript/utils";

/**
 * Translates one text of the model (a label, a hint, …): the translation, or
 * `undefined` to keep the text. A {@link UiT} is one (`provideAsLocale`'s
 * `t`): the model's texts are translated with the same keys as the server's —
 * the source text is the key.
 */
export type UserTextT = (text: string) => string | undefined;

/**
 * The value of metadata key `key` in the app's language, by the rules the
 * server translates a served type by (`translateUserText`): a text key's
 * string — each item of a list, the named fields of a value object — is
 * `t(text)`; any other key is returned as it is. Never changes `value`; `value`
 * itself when `t` is omitted (or no function) or nothing is translated.
 */
export function userText<T>(key: string, value: T, t?: UserTextT): T {
  // `typeof`: `raws.map(parseStaticOptions)` hands the item's index over as `t`.
  return typeof t !== "function" || value === undefined
    ? value
    : (translateUserText(key, value, t) as T);
}

/** The static metadata value `key` of `prop` in the app's language (see {@link userText}). */
export function fieldText<K extends keyof AtscriptMetadata>(
  prop: TAtscriptAnnotatedType,
  key: K,
  t?: UserTextT,
): AtscriptMetadata[K] | undefined;
export function fieldText(prop: TAtscriptAnnotatedType, key: string, t?: UserTextT): unknown;
export function fieldText(prop: TAtscriptAnnotatedType, key: string, t?: UserTextT): unknown {
  return userText(key, prop.metadata.get(key as keyof AtscriptMetadata), t);
}

// ── Served types ─────────────────────────────────────────────

/** The roots of the types a server served already translated (the types themselves stay untouched). */
const served = new WeakSet<object>();

/**
 * Marks `type` — a root deserialized from a schema the server served — as
 * translated by the server: a form built from it does not translate its texts
 * again. A translated text that equals another source text would be
 * mistranslated otherwise. For a served schema you deserialize yourself: prefer
 * {@link deserializeServedType}, which marks by the schema's `$i18n`.
 */
export function markServedType<T extends TAtscriptAnnotatedType>(type: T): T {
  served.add(type);
  return type;
}

/** Whether `type` was marked served ({@link markServedType}). */
export function isServedType(type: TAtscriptAnnotatedType): boolean {
  return served.has(type);
}

/**
 * `deserializeAnnotatedType` for a schema the server served: a schema carrying
 * `$i18n` — even an empty `{}` — was translated by the server (its texts, its
 * message codes and expression literals), so the result is marked served. A
 * schema without `$i18n` is untranslated source: the form translates it with
 * the app's `t`. (A server older than the release that added this mark can
 * leave out an empty `$i18n` after translating: upgrade server and client together.)
 */
export function deserializeServedType(json: TSerializedAnnotatedType): TAtscriptAnnotatedType {
  const type = deserializeAnnotatedType(json);
  return json.$i18n === undefined ? type : markServedType(type);
}
