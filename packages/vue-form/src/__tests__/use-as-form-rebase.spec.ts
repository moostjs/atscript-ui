import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive, ref } from "vue";
import { createFormDef } from "@atscript/ui";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { useAsForm, type UseAsFormReturn } from "../composables/use-as-form";
import { unionVariantChanged } from "../composables/use-as-form-patch";
import { createDefaultTypes } from "../composables/create-default-types";
import { mountForm } from "./helpers";

/**
 * Mounts a renderless `useAsForm()` harness (mirrors use-as-form-patch.spec.ts)
 * so the test can drive `api.patch!.rebaseOnto(...)` and read the reactive
 * surface. Fixtures are precompiled `.as` types.
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

/** Wrap domain data as the form-data container. */
function wrap<T>(value: T): { value: T } {
  return { value };
}

describe("rebaseOnto — disjoint local + upstream edits", () => {
  it("local edit + untouched upstream sibling → both present; isDirty true; patch carries only local", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    // Local edit: name → Bob.
    formData.value.name = "Bob";
    await nextTick();
    expect(api.patch!.isDirty.value).toBe(true);

    // Upstream changed the sibling `age`; name untouched upstream.
    const result = api.patch!.rebaseOnto(wrap({ name: "Alice", age: 99 }));
    await nextTick();

    expect(result.conflicts).toEqual([]);
    // name = local Bob, age = upstream 99.
    expect(formData.value).toEqual({ name: "Bob", age: 99 });
    // Surviving diff (vs new baseline) is the local name edit only.
    expect(api.patch!.isDirty.value).toBe(true);
    expect(api.patch!.getPatch()).toEqual({ name: "Bob" });
    expect(result.reapplied).toEqual([
      { path: "name", kind: "set", before: "Alice", after: "Bob" },
    ]);
  });

  it("preserves the bound :form-data container identity (single mutation)", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });
    const sameRef = formData;

    api.patch!.rebaseOnto(wrap({ name: "Alice", age: 42 }));
    await nextTick();

    // The consumer's ref is the SAME object — only `.value` was reassigned.
    expect(sameRef).toBe(formData);
    expect(formData.value).toEqual({ name: "Alice", age: 42 });
  });
});

describe("rebaseOnto — same-field conflict", () => {
  it("'ours' (default) keeps the local edit", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    formData.value.name = "Bob"; // local
    await nextTick();

    const result = api.patch!.rebaseOnto(wrap({ name: "Carol", age: 30 })); // upstream
    await nextTick();

    expect(result.conflicts).toEqual(["name"]);
    expect(formData.value.name).toBe("Bob");
    // Surviving diff vs new (Carol) baseline.
    expect(api.patch!.getPatch()).toEqual({ name: "Bob" });
  });

  it("'theirs' takes upstream and ends clean", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    formData.value.name = "Bob"; // local
    await nextTick();

    const result = api.patch!.rebaseOnto(wrap({ name: "Carol", age: 30 }), { conflict: "theirs" });
    await nextTick();

    expect(result.conflicts).toEqual(["name"]);
    expect(formData.value.name).toBe("Carol");
    // next === upstream → clean.
    expect(api.patch!.isDirty.value).toBe(false);
    expect(api.patch!.getPatch()).toEqual({});
    expect(result.reapplied).toEqual([]);
  });

  it("parallel SAME-value edit is NOT a conflict and drops out clean (revert)", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    formData.value.name = "Bob"; // local set name → Bob
    await nextTick();

    // Upstream also set name → Bob (same value).
    const result = api.patch!.rebaseOnto(wrap({ name: "Bob", age: 30 }));
    await nextTick();

    expect(result.conflicts).toEqual([]);
    expect(formData.value).toEqual({ name: "Bob", age: 30 });
    // No surviving diff — clean.
    expect(api.patch!.isDirty.value).toBe(false);
    expect(api.patch!.getPatch()).toEqual({});
    expect(result.reapplied).toEqual([]);
  });
});

describe("rebaseOnto — fetch-then-fill (no baseline yet)", () => {
  it("adopts upstream wholesale and baselines it (no conflicts, nothing reapplied)", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const def = createFormDef(PatchScalarForm);
    // External ref starts undefined — data not loaded → baseline deferred.
    const formData = ref<{ value: Record<string, unknown> } | undefined>(undefined);
    let api!: UseAsFormReturn;
    const Custom = defineComponent({
      setup() {
        api = useAsForm({
          def: () => def,
          formData: () => formData.value,
          types: () => createDefaultTypes(),
          trackChanges: () => true,
        });
        return () => h("form");
      },
    });
    mount(Custom);

    // No baseline yet.
    expect(api.patch!.isDirty.value).toBe(false);

    // Assign the live container, then rebaseOnto adopts upstream.
    formData.value = reactive({ value: {} });
    await nextTick();
    const result = api.patch!.rebaseOnto(wrap({ name: "Alice", age: 30 }));
    await nextTick();

    expect(result.conflicts).toEqual([]);
    expect(result.reapplied).toEqual([]);
    expect(formData.value!.value).toEqual({ name: "Alice", age: 30 });
    // Freshly adopted upstream is the clean baseline.
    expect(api.patch!.isDirty.value).toBe(false);
    expect(api.patch!.getPatch()).toEqual({});

    // A subsequent edit diffs against the adopted baseline.
    formData.value!.value.name = "Bob";
    await nextTick();
    expect(api.patch!.getPatch()).toEqual({ name: "Bob" });
  });
});

describe("rebaseOnto — tracking OFF (pure no-op)", () => {
  it("does not exist as a patch handle; the renderless harness has no patch", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice" },
      trackChanges: false,
    });
    expect(api.patch).toBeUndefined();
  });
});

describe("rebaseOnto — $cas / version column", () => {
  it("baseline version after rebase equals upstream's; getPatch lifts it via $cas", async () => {
    const { PatchVersionedForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchVersionedForm,
      initialValue: { name: "Alice", version: 7 },
    });

    // Local edit against version 7.
    formData.value.name = "Bob";
    await nextTick();
    expect(api.patch!.getPatch()).toEqual({ name: "Bob", $cas: { version: 7 } });

    // Upstream bumped the version to 9 (server-side save by someone else),
    // name untouched upstream.
    const result = api.patch!.rebaseOnto(wrap({ name: "Alice", version: 9 }));
    await nextTick();

    expect(result.conflicts).toEqual([]);
    // Local name edit survives; version adopts upstream 9.
    expect(formData.value).toEqual({ name: "Bob", version: 9 });
    // The NEW baseline version is 9 → $cas now lifts 9 (optimistic retry lands).
    expect(api.patch!.getPatch()).toEqual({ name: "Bob", $cas: { version: 9 } });
  });
});

describe("rebaseOnto — union variant remount", () => {
  it("bumps the form remount key when a rebase lands a different union variant", async () => {
    const { RequiredObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { api, formData } = mountTrackedForm({
      type: RequiredObjectUnionForm,
      // Start on the Email variant.
      initialValue: { primaryContact: { email: "a@b.com" } },
    });
    const before = api.remountKey.value;

    // Upstream switched to the Phone variant; no local edit → upstream adopted.
    const result = api.patch!.rebaseOnto(wrap({ primaryContact: { phone: "555-1234" } }));
    await nextTick();

    expect(result.conflicts).toEqual([]);
    expect(formData.value).toEqual({ primaryContact: { phone: "555-1234" } });
    // The variant moved → the subtree must remount.
    expect(api.remountKey.value).toBe(before + 1);
  });

  it("does NOT bump the remount key when the variant is unchanged", async () => {
    const { RequiredObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { api } = mountTrackedForm({
      type: RequiredObjectUnionForm,
      initialValue: { primaryContact: { email: "a@b.com", newsletter: false } },
    });
    const before = api.remountKey.value;

    // Upstream edited a leaf WITHIN the same (Email) variant.
    api.patch!.rebaseOnto(wrap({ primaryContact: { email: "c@d.com", newsletter: false } }));
    await nextTick();

    expect(api.remountKey.value).toBe(before);
  });
});

describe("unionVariantChanged — pure helper", () => {
  it("detects a top-level union variant flip", async () => {
    const { RequiredObjectUnionForm } = await import("./fixtures/union-forms.as");
    const def = createFormDef(RequiredObjectUnionForm);
    expect(
      unionVariantChanged(
        def,
        wrap({ primaryContact: { email: "a@b.com" } }),
        wrap({ primaryContact: { phone: "555" } }),
      ),
    ).toBe(true);
  });

  it("returns false when the variant is the same", async () => {
    const { RequiredObjectUnionForm } = await import("./fixtures/union-forms.as");
    const def = createFormDef(RequiredObjectUnionForm);
    expect(
      unionVariantChanged(
        def,
        wrap({ primaryContact: { email: "a@b.com" } }),
        wrap({ primaryContact: { email: "x@y.com" } }),
      ),
    ).toBe(false);
  });

  it("returns false for a form with no union fields", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const def = createFormDef(PatchScalarForm);
    expect(unionVariantChanged(def, wrap({ name: "a" }), wrap({ name: "b" }))).toBe(false);
  });
});

// ── AsForm instance — defineExpose surface ───────────────────

type ExposedRebase = {
  isDirty: boolean;
  getPatch: (opts?: { cas?: boolean }) => Record<string, unknown>;
  rebaseOnto: (
    upstream: { value: Record<string, unknown> },
    opts?: { conflict?: "ours" | "theirs" },
  ) => { conflicts: string[]; reapplied: { path: string }[] };
};

describe("AsForm instance — rebaseOnto (track-changes ON)", () => {
  it("reapplies the local edit onto upstream and re-baselines", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { wrapper, formData } = mountForm(PatchScalarForm, {
      initialValue: { name: "Alice", age: 30 },
      trackChanges: true,
    });
    const vm = wrapper.vm as unknown as ExposedRebase;

    formData.value.name = "Bob"; // local edit
    await nextTick();

    const result = vm.rebaseOnto(wrap({ name: "Alice", age: 99 }));
    await nextTick();

    expect(result.conflicts).toEqual([]);
    expect(formData.value).toEqual({ name: "Bob", age: 99 });
    expect(vm.getPatch()).toEqual({ name: "Bob" });
  });

  it("resolves a conflict 'theirs' via opts", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { wrapper, formData } = mountForm(PatchScalarForm, {
      initialValue: { name: "Alice", age: 30 },
      trackChanges: true,
    });
    const vm = wrapper.vm as unknown as ExposedRebase;

    formData.value.name = "Bob";
    await nextTick();

    const result = vm.rebaseOnto(wrap({ name: "Carol", age: 30 }), { conflict: "theirs" });
    await nextTick();

    expect(result.conflicts).toEqual(["name"]);
    expect(formData.value.name).toBe("Carol");
    expect(vm.isDirty).toBe(false);
  });
});

describe("AsForm instance — rebaseOnto (track-changes OFF)", () => {
  it("is a pure no-op returning empty with NO side effects", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { wrapper, formData } = mountForm(PatchScalarForm, {
      initialValue: { name: "Alice", age: 30 },
      trackChanges: false,
    });
    const vm = wrapper.vm as unknown as ExposedRebase;

    const result = vm.rebaseOnto(wrap({ name: "ZZZ", age: 1 }));
    await nextTick();

    // Pure no-op: empty result AND data untouched.
    expect(result).toEqual({ conflicts: [], reapplied: [] });
    expect(formData.value).toEqual({ name: "Alice", age: 30 });
    expect(() => vm.rebaseOnto(wrap({ name: "x" }))).not.toThrow();
  });
});
