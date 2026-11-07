import type { UserTextT } from "@atscript/ui";
import { inject } from "vue";
import { MODEL_TEXTS_KEY } from "./internal-keys";
import { useAsTexts } from "./use-as-locale";

/**
 * The translator of the model's own texts (labels, hints, option labels, …) for
 * the form the caller renders in: the app's `t` (`provideAsLocale`) — the source
 * text is the key, as in the catalogue a server translates served schemas
 * with — or `undefined` when the form's schema was served translated.
 *
 * A getter: call it where the text is read (a computed, a render function), so
 * a locale switch and a def change are tracked. Pass its result to `userText` /
 * `fieldText` / `resolveFieldProp(…, { t })` from `@atscript/ui`. Outside a
 * form: the app's `t`.
 */
export function useAsModelTexts(): () => UserTextT | undefined {
  const provided = inject(MODEL_TEXTS_KEY, null);
  if (provided) return provided;
  const { t } = useAsTexts();
  return () => t;
}
