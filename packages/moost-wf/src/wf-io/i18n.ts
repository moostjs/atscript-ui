/**
 * The request's language for what a workflow serves: form schemas,
 * validation errors and finish envelopes, translated with moost's
 * translator (`setTranslator`).
 */

import {
  translateServed,
  VALIDATOR_MESSAGES,
  type TSerializedAnnotatedType,
} from "@atscript/typescript/utils";
import { AS_UI_MESSAGES } from "@atscript/ui/messages";
import { formatMessage, registerMessages, useTranslation, type TTranslation } from "moost";

// The templates a form needs on the client: the validator's (client-side
// validation) and the UI components' texts. A translation's `messages()`
// serves them as `$i18n`; they are also the English fallback of their codes.
registerMessages(VALIDATOR_MESSAGES);
registerMessages(AS_UI_MESSAGES);

/** The current event's translation, `undefined` without one (or outside an event). */
export function currentTranslation(): TTranslation | undefined {
  try {
    return useTranslation();
  } catch {
    return undefined; // not inside an event
  }
}

/**
 * Localized schemas per serialized schema, then per translation partition
 * (the locale, plus the translator's scope — a tenant, a brand — when it has
 * one), each with the translation key it was made under. The key changes with
 * every `setTranslator` / `registerMessages` generation: the partition's entry
 * is then replaced, so a schema keeps one output per served locale and scope.
 */
const memo = new WeakMap<object, Map<string, { key: string; out: TSerializedAnnotatedType }>>();

/**
 * `schema` in the translation's language: its texts translated, `$i18n`
 * holding the translated message templates and the translated literals of
 * its expressions. The schema itself when nothing changes. Memoized per
 * (schema, partition) for the translator's locales and scopes; computed per
 * call otherwise.
 */
export function localizeSchema(
  schema: TSerializedAnnotatedType,
  translation: TTranslation,
): TSerializedAnnotatedType {
  const { key, partition } = translation;
  if (key === undefined) return build(schema, translation);
  let byPartition = memo.get(schema);
  const hit = byPartition?.get(partition);
  if (hit?.key === key) return hit.out;
  const out = build(schema, translation);
  if (!byPartition) memo.set(schema, (byPartition = new Map()));
  byPartition.set(partition, { key, out });
  return out;
}

function build(
  schema: TSerializedAnnotatedType,
  translation: TTranslation,
): TSerializedAnnotatedType {
  const { value, texts } = translateServed(schema, textTranslator(translation));
  // moost memoizes `messages()` per generation and locale: shared when the schema adds no texts.
  const messages = translation.messages();
  const i18n = Object.keys(texts).length > 0 ? { ...messages, ...texts } : messages;
  return Object.keys(i18n).length > 0 ? { ...value, $i18n: i18n } : value;
}

/** A text's translation, `undefined` when it has none (the source text is the id). */
function textTranslator(translation: TTranslation): (text: string) => string | undefined {
  return (text) => {
    const out = translation.t(text, undefined, text);
    return out === text ? undefined : out;
  };
}

/** `text` in the current event's language (the text itself without a translation). */
export function translateText(text: string, params?: Record<string, unknown>): string {
  const translation = currentTranslation();
  return translation ? translation.t(text, params) : formatMessage(text, params);
}
