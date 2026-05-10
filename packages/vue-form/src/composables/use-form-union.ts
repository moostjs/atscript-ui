import type { FormFieldDef, FormUnionFieldDef } from "@atscript/ui";
import {
  isUnionField,
  createFormData,
  createFormValueResolver,
  detectUnionVariant,
} from "@atscript/ui";
import { computed, inject, ref } from "vue";
import { CHANGE_HANDLER_KEY, PATH_PREFIX_KEY } from "./internal-keys";
import type { TAsComponentProps } from "../components/types";
import { useFormContext } from "./use-form-context";

/** Composable for union field state. Switching variants stashes per-index data so toggling back restores user's work instead of fresh defaults. */
export function useFormUnion(props: TAsComponentProps) {
  const unionPath = inject(
    PATH_PREFIX_KEY,
    computed(() => ""),
  );
  const { rootFormData, formContext } = useFormContext("useFormUnion");
  const handleChange = inject(CHANGE_HANDLER_KEY, () => {});

  const unionField = computed(() =>
    props.field && isUnionField(props.field) ? (props.field as FormUnionFieldDef) : undefined,
  );

  const hasMultipleVariants = computed(
    () => unionField.value !== undefined && unionField.value.unionVariants.length > 1,
  );

  const localUnionIndex = ref(
    unionField.value ? detectUnionVariant(props.model?.value, unionField.value.unionVariants) : 0,
  );

  const currentVariant = computed(() => {
    const variants = unionField.value?.unionVariants;
    if (!variants) return undefined;
    return variants[localUnionIndex.value] ?? variants[0];
  });

  // Synthesized field for the active variant — AsUnion dispatches it to the
  // matching component (AsObject for `def`-style, AsField for `itemField`-style).
  const innerField = computed<FormFieldDef | undefined>(() => {
    const variant = currentVariant.value;
    if (!variant) return undefined;
    const fieldName = unionField.value?.name ?? "";
    if (variant.def) return { ...variant.def.rootField, path: "", name: fieldName };
    if (variant.itemField) return { ...variant.itemField, path: "", name: "" };
    return undefined;
  });

  // Per-variant data stash — switching back restores user's work instead of fresh defaults.
  const variantDataStash = new Map<number, unknown>();

  function changeVariant(newIndex: number) {
    variantDataStash.set(localUnionIndex.value, props.model?.value);
    localUnionIndex.value = newIndex;
    const variant = unionField.value?.unionVariants[newIndex];
    if (variant && props.model) {
      const stashed = variantDataStash.get(newIndex);
      props.model.value =
        stashed !== undefined
          ? stashed
          : createFormData(
              variant.type,
              createFormValueResolver(
                rootFormData().value as Record<string, unknown>,
                formContext.value,
              ),
            ).value;
    }
    handleChange("union-switch", unionPath.value, props.model?.value);
  }

  // Treat both undefined and null as "unset" — DB-roundtripped null (SQL NULL) must render the empty-state placeholder, not the variant picker.
  const optionalEnabled = computed(() => props.model?.value != null);

  return {
    unionField,
    hasMultipleVariants,
    localUnionIndex,
    innerField,
    changeVariant,
    optionalEnabled,
  };
}
