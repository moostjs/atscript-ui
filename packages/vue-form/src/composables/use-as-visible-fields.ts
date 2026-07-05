import { UI_FORM_FN_HIDDEN, UI_FORM_HIDDEN, type FormFieldDef } from "@atscript/ui";
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue";
import { useAsFieldScope } from "./use-as-field-scope";

/**
 * Partition a field list down to the currently visible fields, with
 * AsField's exact hidden semantics: static `@ui.form.hidden` presence
 * hides unconditionally; `@ui.form.fn.hidden` is resolved against the
 * field's live fn scope. Subscribes to form data only when some field
 * actually carries a `fn.hidden` key (via `resolveProp`'s presence gate).
 */
export function useAsVisibleFields(
  fields: MaybeRefOrGetter<FormFieldDef[] | undefined>,
): ComputedRef<FormFieldDef[]> {
  const { resolveProp } = useAsFieldScope();
  return computed(() => {
    const list = toValue(fields);
    const visible: FormFieldDef[] = [];
    if (!list) return visible;
    for (const f of list) {
      if (!resolveProp<boolean>(f, UI_FORM_FN_HIDDEN, UI_FORM_HIDDEN, { staticAsBoolean: true })) {
        visible.push(f);
      }
    }
    return visible;
  });
}
