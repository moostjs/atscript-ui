import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, nextTick, provide, reactive, type ComputedRef } from "vue";
import { createFormDef } from "@atscript/ui";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { useAsForm, type UseAsFormReturn } from "../composables/use-as-form";
import { useAsField, type UseAsFieldReturn } from "../composables/use-as-field";
import {
  FORM_CONTEXT_KEY,
  FORM_DATA_KEY,
  FORM_PATCH_KEY,
  FORM_STATE_KEY,
} from "../composables/internal-keys";
import type { AsFormPatchHandle } from "../composables/use-as-form-patch";
import type { TFormState } from "../composables/types";
import { createDefaultTypes } from "../composables/create-default-types";
import { mountForm } from "./helpers";

/**
 * Phase 2 — per-field `isDirty`.
 *
 * Two surfaces under test:
 *
 *  1. The handle predicate `patch.isDirtyPath(path)` mounted from a real
 *     `<AsForm track-changes>` (via `useAsForm`) — the exact-vs-prefix
 *     granularity against a live, reactive change list.
 *  2. The `useAsField().isDirty` wiring — that the field-level computed reads
 *     the injected handle through `opts.path()`, flips on a real edit, and is
 *     a silent `false` (no throw) when tracking is off.
 *
 * Fixtures are pre-compiled `.as` types (no programmatic `defineAnnotatedType`).
 */

function mountTrackedForm(opts: {
  type: TAtscriptAnnotatedType;
  initialValue: Record<string, unknown>;
  trackChanges?: boolean;
}) {
  const def = createFormDef(opts.type);
  const formData = reactive({ value: opts.initialValue }) as { value: Record<string, unknown> };
  let api!: UseAsFormReturn;

  const Custom = defineComponent({
    setup() {
      api = useAsForm({
        def: () => def,
        formData: () => formData,
        types: () => createDefaultTypes(),
        trackChanges: () => opts.trackChanges ?? true,
      });
      return () => h("form");
    },
  });

  const wrapper = mount(Custom);
  return {
    wrapper,
    formData,
    get api() {
      return api;
    },
  };
}

describe("AsFormPatchHandle.isDirtyPath — granularity-correct predicate", () => {
  it("exact leaf match: edited scalar dirty, sibling clean", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    expect(api.patch!.isDirtyPath("name")).toBe(false);

    formData.value.name = "Bob";
    await nextTick();

    expect(api.patch!.isDirtyPath("name")).toBe(true);
    // sibling `age` untouched → clean.
    expect(api.patch!.isDirtyPath("age")).toBe(false);
  });

  it("nested leaf + object-container-via-prefix + whole-array + array-item-FALSE", async () => {
    const { PatchNestedForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchNestedForm,
      initialValue: {
        name: "Cart",
        address: { city: "Berlin", zip: "10115" },
        items: [
          { sku: "A", qty: 1 },
          { sku: "B", qty: 2 },
        ],
      },
    });

    // Edit a nested object leaf.
    (formData.value.address as Record<string, unknown>).city = "Munich";
    await nextTick();

    // Nested leaf → exact match.
    expect(api.patch!.isDirtyPath("address.city")).toBe(true);
    // Object container → no own change entry, lights up via the leaf's prefix.
    expect(api.patch!.isDirtyPath("address")).toBe(true);
    // A sibling nested leaf is still clean.
    expect(api.patch!.isDirtyPath("address.zip")).toBe(false);
    // The unrelated array + scalar are clean.
    expect(api.patch!.isDirtyPath("items")).toBe(false);
    expect(api.patch!.isDirtyPath("name")).toBe(false);

    // Now edit a keyed-array item leaf. The array diff emits ONE whole-array
    // change at `items`, never a per-item leaf path.
    (formData.value.items as { sku: string; qty: number }[])[0]!.qty = 9;
    await nextTick();

    // Whole-array field → exact match on the array root.
    expect(api.patch!.isDirtyPath("items")).toBe(true);
    // Array-ITEM leaf → NOT detectable (no per-item change exists). The array
    // container lights up instead — a known, documented limitation.
    expect(api.patch!.isDirtyPath("items.0.qty")).toBe(false);
    expect(api.patch!.isDirtyPath("items.0")).toBe(false);
  });

  it("revert clears the field dirty flag (reactive)", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    formData.value.name = "Bob";
    await nextTick();
    expect(api.patch!.isDirtyPath("name")).toBe(true);

    formData.value.name = "Alice";
    await nextTick();
    expect(api.patch!.isDirtyPath("name")).toBe(false);
  });

  it("the empty root path is dirty iff there are ANY changes", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    expect(api.patch!.isDirtyPath("")).toBe(false);
    formData.value.name = "Bob";
    await nextTick();
    expect(api.patch!.isDirtyPath("")).toBe(true);
  });
});

describe("AsForm slot-props / instance surface — isDirtyPath", () => {
  it("slot-props.isDirtyPath mirrors the handle when tracking is on", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    expect(api.slotProps.value.isDirtyPath("name")).toBe(false);
    formData.value.name = "Bob";
    await nextTick();
    expect(api.slotProps.value.isDirtyPath("name")).toBe(true);
  });

  it("slot-props.isDirtyPath is a false-returning no-op when tracking is off", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice" },
      trackChanges: false,
    });
    expect(api.patch).toBeUndefined();
    expect(api.slotProps.value.isDirtyPath("name")).toBe(false);
    formData.value.name = "Bob";
    await nextTick();
    expect(api.slotProps.value.isDirtyPath("name")).toBe(false);
  });
});

/**
 * Mounts `useAsField` inside a child whose parent provides the form injections
 * — exactly like `use-as-field.spec.ts`, plus an OPTIONAL `FORM_PATCH_KEY` so
 * the field-level `isDirty` wiring can be exercised in isolation.
 */
function setupFieldWithPatch(opts: {
  path: string;
  patch?: AsFormPatchHandle;
  getValue: () => unknown;
}) {
  let field!: UseAsFieldReturn;

  const formState = reactive<TFormState>({
    firstSubmitHappened: false,
    firstValidation: "on-change",
    freshFields: new Set<symbol>(),
    register: () => {},
    unregister: () => {},
  }) as unknown as TFormState;

  const Child = defineComponent({
    setup() {
      field = useAsField({
        getValue: opts.getValue,
        setValue: () => {},
        path: () => opts.path,
      });
      return () => null;
    },
  });

  const Parent = defineComponent({
    setup() {
      provide(FORM_STATE_KEY, formState);
      provide(
        FORM_DATA_KEY,
        computed(() => ({})),
      );
      provide(
        FORM_CONTEXT_KEY,
        computed(() => ({})),
      );
      if (opts.patch) provide(FORM_PATCH_KEY, opts.patch);
      return () => h(Child);
    },
  });

  const wrapper = mount(Parent);
  return {
    get field() {
      return field;
    },
    wrapper,
  };
}

describe("useAsField().isDirty — field-level wiring", () => {
  it("flips true for a real nested field via the injected handle, false for a sibling", async () => {
    // Build a real tracked form so the handle is genuine (not a stub), then
    // drive `useAsField` against the SAME handle for two distinct paths.
    const { PatchNestedForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchNestedForm,
      initialValue: {
        name: "Cart",
        address: { city: "Berlin", zip: "10115" },
        items: [{ sku: "A", qty: 1 }],
      },
    });
    const patch = api.patch!;

    const city = setupFieldWithPatch({
      path: "address.city",
      patch,
      getValue: () => (formData.value.address as Record<string, unknown>).city,
    });
    const zip = setupFieldWithPatch({
      path: "address.zip",
      patch,
      getValue: () => (formData.value.address as Record<string, unknown>).zip,
    });

    expect(city.field.isDirty.value).toBe(false);
    expect(zip.field.isDirty.value).toBe(false);

    (formData.value.address as Record<string, unknown>).city = "Munich";
    await nextTick();

    // The edited field's `isDirty` flips; the untouched sibling stays clean.
    expect(city.field.isDirty.value).toBe(true);
    expect(zip.field.isDirty.value).toBe(false);
  });

  it("object container field is dirty via the prefix branch", async () => {
    const { PatchNestedForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchNestedForm,
      initialValue: {
        name: "Cart",
        address: { city: "Berlin", zip: "10115" },
        items: [{ sku: "A", qty: 1 }],
      },
    });

    const address = setupFieldWithPatch({
      path: "address",
      patch: api.patch!,
      getValue: () => formData.value.address,
    });

    expect(address.field.isDirty.value).toBe(false);
    (formData.value.address as Record<string, unknown>).city = "Munich";
    await nextTick();
    expect(address.field.isDirty.value).toBe(true);
  });

  it("whole-array container is dirty; array-item field is NOT", async () => {
    const { PatchNestedForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchNestedForm,
      initialValue: {
        name: "Cart",
        address: { city: "Berlin", zip: "10115" },
        items: [{ sku: "A", qty: 1 }],
      },
    });

    const items = setupFieldWithPatch({
      path: "items",
      patch: api.patch!,
      getValue: () => formData.value.items,
    });
    const itemQty = setupFieldWithPatch({
      path: "items.0.qty",
      patch: api.patch!,
      getValue: () => (formData.value.items as { qty: number }[])[0]!.qty,
    });

    (formData.value.items as { sku: string; qty: number }[])[0]!.qty = 9;
    await nextTick();

    expect(items.field.isDirty.value).toBe(true);
    // The array-item leaf is not detectable — the container lights up instead.
    expect(itemQty.field.isDirty.value).toBe(false);
  });

  it("is always false (no throw) when tracking is off — no handle injected", async () => {
    const noPatch = setupFieldWithPatch({
      path: "name",
      // No `patch` provided → FORM_PATCH_KEY absent → inject(..., undefined).
      getValue: () => "anything",
    });
    expect(noPatch.field.isDirty.value).toBe(false);
    // The computed must be reactively safe with no handle (no throw on read).
    expect(() => noPatch.field.isDirty.value).not.toThrow();
  });
});

/**
 * End-to-end decoupling guard for the per-field `data-dirty` hook.
 *
 * `AsField` binds `isDirty` SEPARATELY from the memoised `componentProps`
 * computed (`:is-dirty="isDirty"` on the rendered `<component>`), so an
 * unchanged field's display props keep ZERO reactive deps on the change list
 * while its `data-dirty` attribute still flips. Editing ONE field must light up
 * only that field's `data-dirty` — the untouched sibling stays clean and its
 * (memoised) display props never had to re-merge to keep its hook correct.
 */
describe("AsField — per-field data-dirty is decoupled from componentProps", () => {
  it("editing one field flips only its own data-dirty; the sibling stays clean", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { wrapper } = mountForm(PatchScalarForm, {
      initialValue: { name: "Cart", age: 3 },
      trackChanges: true,
    });
    await nextTick();

    const fieldFor = (inputName: string) => {
      const input = wrapper.findAll("input").find((i) => i.attributes("name") === inputName)!;
      return input.element.closest(".as-default-field") as HTMLElement;
    };

    const nameField = fieldFor("name");
    const ageField = fieldFor("age");

    // Clean baseline — neither field carries the attribute.
    expect(nameField.getAttribute("data-dirty")).toBeNull();
    expect(ageField.getAttribute("data-dirty")).toBeNull();

    // Edit ONLY `name`.
    const nameInput = wrapper.findAll("input").find((i) => i.attributes("name") === "name")!;
    await nameInput.setValue("Basket");
    await nextTick();

    // Edited field lights up; the untouched sibling stays clean. If `isDirty`
    // were folded back into `componentProps`, the sibling's display props would
    // also re-run on this edit — this asserts the observable per-field outcome.
    expect(nameField.getAttribute("data-dirty")).toBe("");
    expect(ageField.getAttribute("data-dirty")).toBeNull();
  });
});

// `isDirty` is typed as ComputedRef<boolean> — compile-time guard so a future
// refactor cannot silently widen it to `boolean | undefined`.
type _AssertIsDirtyComputed =
  UseAsFieldReturn["isDirty"] extends ComputedRef<boolean> ? true : never;
const _assert: _AssertIsDirtyComputed = true;
void _assert;
