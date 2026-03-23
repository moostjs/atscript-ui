import type { FormFieldDef, FormUnionFieldDef } from "@atscript/ui";
import {
  isUnionField,
  createFormData,
  createFormValueResolver,
  detectUnionVariant,
} from "@atscript/ui";
import { computed, inject, provide, ref, type ComputedRef } from "vue";
import type { TAsChangeType, TAsComponentProps, TAsUnionContext } from "../components/types";
import { useDropdown } from "./use-dropdown";
import { useFormContext } from "./use-form-context";

/**
 * Composable for managing union field state.
 *
 * Manages variant switching with data stashing — switching away from a variant
 * saves its data, and switching back restores it instead of creating fresh defaults.
 * Used by the default `AsUnion` component and available for custom union components.
 */
export function useFormUnion(props: TAsComponentProps) {
  // ── Change handler (path comes from AsField's provide for union fields) ──
  const unionPath = inject<ComputedRef<string>>(
    "__as_path_prefix",
    computed(() => ""),
  );
  const { rootFormData, formContext } = useFormContext("useFormUnion");
  const handleChange = inject<(type: TAsChangeType, path: string, value: unknown) => void>(
    "__as_change_handler",
    () => {},
  );

  // ── Union field def ─────────────────────────────────────────
  const unionField = computed(() =>
    props.field && isUnionField(props.field) ? (props.field as FormUnionFieldDef) : undefined,
  );

  const hasMultipleVariants = computed(
    () => unionField.value !== undefined && unionField.value.unionVariants.length > 1,
  );

  // ── Local union state ───────────────────────────────────────
  const localUnionIndex = ref(
    unionField.value ? detectUnionVariant(props.model?.value, unionField.value.unionVariants) : 0,
  );

  const currentVariant = computed(() => {
    const variants = unionField.value?.unionVariants;
    if (!variants) return undefined;
    return variants[localUnionIndex.value] ?? variants[0];
  });

  // ── Inner field def (stable ref — only rebuilt on variant change) ──
  function buildInnerField(): FormFieldDef | undefined {
    const variant = currentVariant.value;
    if (!variant) return undefined;

    const fieldName = unionField.value?.name ?? "";

    if (variant.def) {
      return { ...variant.def.rootField, path: "", name: fieldName };
    }
    if (variant.itemField) {
      return { ...variant.itemField, path: "" };
    }

    return undefined;
  }

  const innerField = computed(buildInnerField);

  // ── Per-variant data stash ──────────────────────────────────
  // Stores previous variant data keyed by variant index so switching back
  // restores the user's work instead of creating fresh defaults.
  const variantDataStash = new Map<number, unknown>();

  // ── Change variant handler ──────────────────────────────────
  function changeVariant(newIndex: number) {
    // Stash current variant's data before switching away
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

  const optionalEnabled = computed(() => props.model?.value !== undefined);

  // ── Provide union context for consumers ─────────────────────
  if (unionField.value) {
    provide<TAsUnionContext>("__as_union", {
      variants: unionField.value.unionVariants,
      currentIndex: localUnionIndex,
      changeVariant,
    });
  }

  // ── Dropdown (only for optional N/A variant picker) ─────────
  const dropdownRef = ref<HTMLElement | null>(null);
  const { isOpen, toggle, select } = useDropdown(dropdownRef);

  // For optional union N/A: clicking opens variant picker or just enables
  function handleNaClick() {
    if (hasMultipleVariants.value) {
      toggle();
    } else {
      props.onToggleOptional?.(true);
    }
  }

  return {
    unionField,
    hasMultipleVariants,
    localUnionIndex,
    currentVariant,
    innerField,
    changeVariant,
    optionalEnabled,
    dropdownRef,
    isOpen,
    toggle,
    select,
    handleNaClick,
  };
}
