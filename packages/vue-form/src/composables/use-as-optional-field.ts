import { createFormData, createFormValueResolver, type FormFieldDef } from "@atscript/ui";
import { computed, inject, type ComputedRef } from "vue";
import { CHANGE_HANDLER_KEY } from "./internal-keys";
import { useFormContext } from "./use-form-context";

export interface UseAsOptionalFieldReturn {
  /** Whether the field is declared optional in its atscript type. */
  optional: boolean;
  /** Whether the optional field currently holds a value (`!= null`). */
  enabled: ComputedRef<boolean>;
  /**
   * Enable (initialize with annotated defaults, like AsField's optional
   * toggle) or disable (clear to `undefined`) the field. Emits the
   * blur-committed `update` change for the field's absolute path.
   */
  toggle: (enabled: boolean) => void;
}

/**
 * Optional-field enable/clear for custom container renderers — the same
 * behavior AsField wires onto `onToggleOptional`, usable without mounting
 * `<AsField>` for the field.
 */
export function useAsOptionalField(field: FormFieldDef): UseAsOptionalFieldReturn {
  const { rootFormData, formContext, buildPath, getByPath, setByPath } =
    useFormContext("useAsOptionalField");
  const handleChange = inject(CHANGE_HANDLER_KEY, () => {});

  const enabled = computed(() => getByPath(buildPath(field.path)) != null);

  function toggle(on: boolean) {
    const path = buildPath(field.path);
    if (on) {
      const resolver = createFormValueResolver(
        rootFormData().value as Record<string, unknown>,
        formContext.value,
      );
      setByPath(path, createFormData(field.prop, resolver).value);
    } else {
      setByPath(path, undefined);
    }
    handleChange("update", path, getByPath(path));
  }

  return { optional: field.prop.optional ?? false, enabled, toggle };
}
