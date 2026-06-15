import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, isReactive, nextTick, reactive, ref } from "vue";
import { createFormDef } from "@atscript/ui";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { useAsForm, type UseAsFormReturn } from "../composables/use-as-form";
import { useAsFormPatch } from "../composables/use-as-form-patch";
import { createDefaultTypes } from "../composables/create-default-types";
import { mountForm } from "./helpers";

/**
 * Mounts a custom form root that calls `useAsForm()` directly so the test can
 * read the composable's return surface (`patch`, `slotProps`, `reset`) without
 * coupling to the `<AsForm>` template. Fixtures are precompiled `.as` types.
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

describe("useAsForm({ trackChanges }) — baseline + dirty lifecycle", () => {
  it("is off by default — no patch handle, slot-props inert, no overhead", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice" },
      trackChanges: false,
    });
    expect(api.patch).toBeUndefined();
    expect(api.slotProps.value.isDirty).toBe(false);
    expect(api.slotProps.value.changes).toEqual([]);
    expect(api.slotProps.value.getPatch()).toEqual({});
    expect(api.slotProps.value.getChanges()).toEqual([]);
  });

  it("isDirty is false initially (current === baseline)", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });
    expect(api.patch).toBeDefined();
    expect(api.patch!.isDirty.value).toBe(false);
    expect(api.patch!.changes.value).toEqual([]);
    expect(api.patch!.getPatch()).toEqual({});
  });

  it("edit → isDirty true + change list + patch shape", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    formData.value.name = "Bob";
    await nextTick();

    expect(api.patch!.isDirty.value).toBe(true);
    expect(api.patch!.changes.value).toEqual([
      { path: "name", kind: "set", before: "Alice", after: "Bob" },
    ]);
    expect(api.patch!.getPatch()).toEqual({ name: "Bob" });
    // slot-props mirror the reactive surface.
    expect(api.slotProps.value.isDirty).toBe(true);
    expect(api.slotProps.value.getChanges()).toHaveLength(1);
  });

  it("edit then revert → isDirty false, empty patch (revert-aware)", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    formData.value.name = "Bob";
    await nextTick();
    expect(api.patch!.isDirty.value).toBe(true);

    formData.value.name = "Alice";
    await nextTick();
    expect(api.patch!.isDirty.value).toBe(false);
    expect(api.patch!.changes.value).toEqual([]);
    expect(api.patch!.getPatch()).toEqual({});
  });

  it("clear an optional scalar → patch sets it to null", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    formData.value.age = undefined;
    await nextTick();
    expect(api.patch!.isDirty.value).toBe(true);
    expect(api.patch!.getPatch()).toEqual({ age: null });
  });
});

describe("useAsForm({ trackChanges }) — keyed array ops", () => {
  it("editing a keyed-array item emits an $update op in the patch", async () => {
    const { PatchArrayForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchArrayForm,
      initialValue: {
        name: "Cart",
        items: [
          { sku: "A", qty: 1 },
          { sku: "B", qty: 2 },
        ],
      },
    });

    (formData.value.items as { sku: string; qty: number }[])[0]!.qty = 5;
    await nextTick();

    expect(api.patch!.isDirty.value).toBe(true);
    const patch = api.patch!.getPatch();
    expect(patch).toEqual({ items: { $update: [{ sku: "A", qty: 5 }] } });
    // change list reports the array change as a single `array` kind entry.
    const changes = api.patch!.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0]!.kind).toBe("array");
    expect(changes[0]!.path).toBe("items");
  });

  it("adding a keyed-array item emits an $insert op", async () => {
    const { PatchArrayForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchArrayForm,
      initialValue: { name: "Cart", items: [{ sku: "A", qty: 1 }] },
    });

    (formData.value.items as { sku: string; qty: number }[]).push({ sku: "C", qty: 3 });
    await nextTick();

    expect(api.patch!.getPatch()).toEqual({ items: { $insert: [{ sku: "C", qty: 3 }] } });
  });

  // Regression for the reactive change-tracking blind spot: `buildFormDiff`'s
  // keyed-array `$insert` branch pushes a freshly-added row BY REFERENCE without
  // reading its leaves, so the reactive `diff` computed never registered a
  // dependency on an inserted row's non-key leaves. Editing such a row's `qty`
  // therefore left the reactive `changes` ComputedRef stale until some unrelated
  // reactive trigger fired. The guarded deep watch on the form data closes it.
  it("editing a NON-KEY leaf of a freshly-inserted keyed-array row invalidates the reactive changes", async () => {
    const { PatchArrayForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchArrayForm,
      initialValue: { name: "Cart", items: [{ sku: "A", qty: 1 }] },
    });

    // A consumer that derives a value from the REACTIVE `changes` computed —
    // mirrors the demo's `livePatch` (binds `changes`, then snapshots getPatch).
    // It only re-runs when `changes` actually invalidates, so it is the canary
    // for the dependency-tracking fix.
    const livePatch = computed(() => {
      void api.patch!.changes.value; // depend on the reactive change list
      return api.patch!.getPatch();
    });

    // Insert a brand-new (not-yet-saved) keyed row.
    (formData.value.items as { sku: string; qty: number }[]).push({ sku: "C", qty: 3 });
    await nextTick();
    expect(api.patch!.isDirty.value).toBe(true);
    expect(livePatch.value).toEqual({ items: { $insert: [{ sku: "C", qty: 3 }] } });

    // Now edit the inserted row's NON-KEY leaf. WITHOUT the fix the reactive
    // `changes` computed does not re-run, so `livePatch` stays stale at qty: 3.
    (formData.value.items as { sku: string; qty: number }[])[1]!.qty = 7;
    await nextTick();

    // The reactive surface must reflect the edited leaf (still an $insert, NOT a
    // $replace — the row is new, never saved).
    expect(api.patch!.isDirty.value).toBe(true);
    expect(livePatch.value).toEqual({ items: { $insert: [{ sku: "C", qty: 7 }] } });

    // And the reactive change list itself reflects qty: 7 on the inserted row.
    const changes = api.patch!.changes.value;
    expect(changes).toHaveLength(1);
    expect(changes[0]!.kind).toBe("array");
    expect(changes[0]!.path).toBe("items");
    expect(changes[0]!.after).toEqual([
      { sku: "A", qty: 1 },
      { sku: "C", qty: 7 },
    ]);
  });

  // Companion: editing a non-key leaf of an EXISTING (already-saved) keyed row
  // must keep working through the reactive surface (it always did, via
  // buildFormDiff's $update read-walk — guard against a fix that regresses it).
  it("editing a NON-KEY leaf of an EXISTING keyed-array item invalidates the reactive changes", async () => {
    const { PatchArrayForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchArrayForm,
      initialValue: {
        name: "Cart",
        items: [
          { sku: "A", qty: 1 },
          { sku: "B", qty: 2 },
        ],
      },
    });

    const livePatch = computed(() => {
      void api.patch!.changes.value;
      return api.patch!.getPatch();
    });

    (formData.value.items as { sku: string; qty: number }[])[1]!.qty = 9;
    await nextTick();

    expect(api.patch!.isDirty.value).toBe(true);
    expect(livePatch.value).toEqual({ items: { $update: [{ sku: "B", qty: 9 }] } });
    expect(api.patch!.changes.value).toHaveLength(1);
    expect(api.patch!.changes.value[0]!.kind).toBe("array");
  });
});

describe("useAsForm({ trackChanges }) — optimistic concurrency ($cas)", () => {
  it("includes $cas with the baseline version when a version column exists", async () => {
    const { PatchVersionedForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchVersionedForm,
      initialValue: { name: "Alice", version: 7 },
    });

    formData.value.name = "Bob";
    await nextTick();

    const patch = api.patch!.getPatch();
    // version column itself is never a SET; only round-tripped via $cas.
    expect(patch).toEqual({ name: "Bob", $cas: { version: 7 } });
  });

  it("opts.cas=false suppresses the $cas sibling", async () => {
    const { PatchVersionedForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchVersionedForm,
      initialValue: { name: "Alice", version: 7 },
    });

    formData.value.name = "Bob";
    await nextTick();

    expect(api.patch!.getPatch({ cas: false })).toEqual({ name: "Bob" });
  });
});

describe("useAsForm({ trackChanges }) — rebase + reset re-baseline", () => {
  it("rebase() clears dirty by adopting current as the new baseline", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    formData.value.name = "Bob";
    await nextTick();
    expect(api.patch!.isDirty.value).toBe(true);

    api.patch!.rebase();
    await nextTick();
    expect(api.patch!.isDirty.value).toBe(false);
    expect(api.patch!.getPatch()).toEqual({});

    // A further edit relative to the NEW baseline is dirty again.
    formData.value.name = "Carol";
    await nextTick();
    expect(api.patch!.getPatch()).toEqual({ name: "Carol" });
  });

  it("reset() re-baselines to the post-reset state", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    formData.value.name = "Bob";
    await nextTick();
    expect(api.patch!.isDirty.value).toBe(true);

    await api.reset();
    await nextTick();
    // After reset the tracker treats the current (post-reset) data as clean.
    expect(api.patch!.isDirty.value).toBe(false);
    expect(api.patch!.getPatch()).toEqual({});
  });
});

describe("useAsFormPatch() — public injector", () => {
  it("returns the handle inside a track-changes form", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const def = createFormDef(PatchScalarForm);
    const formData = reactive({ value: { name: "Alice" } }) as { value: Record<string, unknown> };

    let injected: ReturnType<typeof useAsFormPatch> | undefined;
    const Child = defineComponent({
      setup() {
        injected = useAsFormPatch();
        return () => h("span");
      },
    });
    const Parent = defineComponent({
      setup() {
        useAsForm({
          def: () => def,
          formData: () => formData,
          types: () => createDefaultTypes(),
          trackChanges: () => true,
        });
        return () => h("div", [h(Child)]);
      },
    });

    mount(Parent);
    expect(injected).toBeDefined();
    expect(injected!.isDirty.value).toBe(false);

    formData.value.name = "Bob";
    await nextTick();
    expect(injected!.isDirty.value).toBe(true);
    expect(injected!.getPatch()).toEqual({ name: "Bob" });
  });

  it("throws a clear error when track-changes is disabled", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const def = createFormDef(PatchScalarForm);
    const formData = reactive({ value: { name: "Alice" } }) as { value: Record<string, unknown> };

    let captured: unknown;
    const Child = defineComponent({
      setup() {
        try {
          useAsFormPatch();
        } catch (e) {
          captured = e;
        }
        return () => h("span");
      },
    });
    const Parent = defineComponent({
      setup() {
        useAsForm({
          def: () => def,
          formData: () => formData,
          types: () => createDefaultTypes(),
          trackChanges: () => false,
        });
        return () => h("div", [h(Child)]);
      },
    });

    mount(Parent);
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toMatch(/change tracking is not enabled/);
  });

  it("throws when used outside any form", () => {
    let captured: unknown;
    const Lonely = defineComponent({
      setup() {
        try {
          useAsFormPatch();
        } catch (e) {
          captured = e;
        }
        return () => h("span");
      },
    });
    mount(Lonely);
    expect(captured).toBeInstanceOf(Error);
  });
});

describe("useAsForm({ trackChanges }) — async (fetch-then-fill) form data", () => {
  it("defers the baseline until a real { value } container arrives — not the {} fallback", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const def = createFormDef(PatchScalarForm);
    // External `:form-data` ref starts undefined (data not loaded yet). The
    // `data` computed falls back to the internal `{}` container at setup.
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

    // No baseline yet → not dirty, empty patch (must NOT diff against `{}`).
    expect(api.patch!.isDirty.value).toBe(false);
    expect(api.patch!.getPatch()).toEqual({});

    // Data resolves: a real wrapped container is assigned.
    formData.value = reactive({ value: { name: "Alice", age: 30 } });
    await nextTick();

    // The freshly-arrived data is the clean baseline, NOT spuriously dirty.
    expect(api.patch!.isDirty.value).toBe(false);
    expect(api.patch!.getPatch()).toEqual({});

    // A subsequent edit diffs against the captured baseline.
    formData.value.value.name = "Bob";
    await nextTick();
    expect(api.patch!.isDirty.value).toBe(true);
    expect(api.patch!.getPatch()).toEqual({ name: "Bob" });
  });
});

describe("baseline is a deep clone (snapshot isolation)", () => {
  it("mutating live data after a getPatch does not corrupt the baseline", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchScalarForm,
      initialValue: { name: "Alice", age: 30 },
    });

    // First edit + patch — `before` references hold the deep-clone baseline.
    formData.value.name = "Bob";
    await nextTick();
    const firstChanges = api.patch!.getChanges();
    expect(firstChanges).toEqual([{ path: "name", kind: "set", before: "Alice", after: "Bob" }]);

    // Keep editing the LIVE data after building the diff.
    formData.value.name = "Carol";
    await nextTick();

    // The earlier change snapshot's `before` (baseline) must still read "Alice"
    // — the baseline was deep-cloned, not aliased to the live container.
    expect(firstChanges[0]!.before).toBe("Alice");
    // And a fresh diff is still measured against the original baseline.
    expect(api.patch!.getPatch()).toEqual({ name: "Carol" });
  });

  it("editing a keyed-array item does not retroactively mutate a prior $update", async () => {
    const { PatchArrayForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchArrayForm,
      initialValue: { name: "Cart", items: [{ sku: "A", qty: 1 }] },
    });

    (formData.value.items as { sku: string; qty: number }[])[0]!.qty = 2;
    await nextTick();
    const firstPatch = api.patch!.getPatch();
    expect(firstPatch).toEqual({ items: { $update: [{ sku: "A", qty: 2 }] } });

    // Continue editing the live array item; the baseline qty stays 1.
    (formData.value.items as { sku: string; qty: number }[])[0]!.qty = 9;
    await nextTick();
    expect(api.patch!.getPatch()).toEqual({ items: { $update: [{ sku: "A", qty: 9 }] } });
  });

  it("a returned $insert item is a frozen, proxy-free snapshot of the live data", async () => {
    const { PatchArrayForm } = await import("./fixtures/patch-forms.as");
    const { api, formData } = mountTrackedForm({
      type: PatchArrayForm,
      initialValue: { name: "Cart", items: [{ sku: "A", qty: 1 }] },
    });

    // Push a NEW item, then build the patch and capture the returned $insert item.
    (formData.value.items as { sku: string; qty: number }[]).push({ sku: "C", qty: 3 });
    await nextTick();
    const patch = api.patch!.getPatch();
    const insert = (patch.items as { $insert: { sku: string; qty: number }[] }).$insert;
    const returnedInsertItem = insert[0]!;
    expect(returnedInsertItem).toEqual({ sku: "C", qty: 3 });

    // The returned item must NOT be a Vue reactive proxy (it must not carry
    // reactivity onto the wire to table.updateOne).
    expect(isReactive(returnedInsertItem)).toBe(false);

    // Mutate the LIVE array item after the patch was returned.
    (formData.value.items as { sku: string; qty: number }[])[1]!.qty = 99;
    await nextTick();

    // The previously-returned $insert item is UNCHANGED — it does not alias the
    // live form data.
    expect(returnedInsertItem).toEqual({ sku: "C", qty: 3 });
  });
});

/**
 * Mounts the REAL `<AsForm>` component (not the renderless `useAsForm` harness)
 * so the `defineExpose({...})` block — the parent-template-ref surface — is the
 * unit under test. The exposed members surface on `wrapper.vm`.
 */
type ExposedSurface = {
  submit: (...args: unknown[]) => unknown;
  reset: (...args: unknown[]) => unknown;
  isDirty: boolean;
  changes: ReadonlyArray<Record<string, unknown>>;
  getPatch: (opts?: { cas?: boolean }) => Record<string, unknown>;
  getChanges: () => ReadonlyArray<Record<string, unknown>>;
  rebase: () => void;
};

describe("AsForm instance — defineExpose surface (track-changes ON)", () => {
  it("isDirty/changes/getPatch/getChanges reflect a scalar edit; rebase re-baselines", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { wrapper, formData } = mountForm(PatchScalarForm, {
      initialValue: { name: "Alice", age: 30 },
      trackChanges: true,
    });
    const vm = wrapper.vm as unknown as ExposedSurface;

    // Initially clean — current === baseline.
    expect(vm.isDirty).toBe(false);
    expect(vm.changes).toEqual([]);
    expect(vm.getPatch()).toEqual({});
    expect(vm.getChanges()).toEqual([]);

    // Edit a field the way the renderless tests do (mutate wrapped data).
    formData.value.name = "Bob";
    await nextTick();

    expect(vm.isDirty).toBe(true);
    expect(vm.getPatch()).toEqual({ name: "Bob" });
    expect(vm.changes).toEqual([{ path: "name", kind: "set", before: "Alice", after: "Bob" }]);
    expect(vm.getChanges()).toEqual([{ path: "name", kind: "set", before: "Alice", after: "Bob" }]);

    // rebase() adopts current as the new baseline → clean again.
    vm.rebase();
    await nextTick();
    expect(vm.isDirty).toBe(false);
    expect(vm.getPatch()).toEqual({});
    expect(vm.getChanges()).toEqual([]);

    // An edit relative to the NEW baseline is dirty again.
    formData.value.name = "Carol";
    await nextTick();
    expect(vm.isDirty).toBe(true);
    expect(vm.getPatch()).toEqual({ name: "Carol" });
  });

  it("submit and reset are functions; reset() re-baselines without throwing", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { wrapper, formData } = mountForm(PatchScalarForm, {
      initialValue: { name: "Alice", age: 30 },
      trackChanges: true,
    });
    const vm = wrapper.vm as unknown as ExposedSurface;

    expect(typeof vm.submit).toBe("function");
    expect(typeof vm.reset).toBe("function");

    formData.value.name = "Bob";
    await nextTick();
    expect(vm.isDirty).toBe(true);

    // reset() re-baselines to the post-reset state (does not throw).
    await vm.reset();
    await nextTick();
    expect(vm.isDirty).toBe(false);
    expect(vm.getPatch()).toEqual({});
  });

  it("getPatch() carries a keyed-array op", async () => {
    const { PatchArrayForm } = await import("./fixtures/patch-forms.as");
    const { wrapper, formData } = mountForm(PatchArrayForm, {
      initialValue: {
        name: "Cart",
        items: [
          { sku: "A", qty: 1 },
          { sku: "B", qty: 2 },
        ],
      },
      trackChanges: true,
    });
    const vm = wrapper.vm as unknown as ExposedSurface;

    (formData.value.items as { sku: string; qty: number }[])[0]!.qty = 5;
    await nextTick();

    expect(vm.isDirty).toBe(true);
    expect(vm.getPatch()).toEqual({ items: { $update: [{ sku: "A", qty: 5 }] } });
    const changes = vm.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0]!.kind).toBe("array");
    expect(changes[0]!.path).toBe("items");
  });

  it("getPatch() lifts $cas from a @db.column.version baseline; opts.cas=false drops it", async () => {
    const { PatchVersionedForm } = await import("./fixtures/patch-forms.as");
    const { wrapper, formData } = mountForm(PatchVersionedForm, {
      initialValue: { name: "Alice", version: 7 },
      trackChanges: true,
    });
    const vm = wrapper.vm as unknown as ExposedSurface;

    formData.value.name = "Bob";
    await nextTick();

    expect(vm.getPatch()).toEqual({ name: "Bob", $cas: { version: 7 } });
    expect(vm.getPatch({ cas: false })).toEqual({ name: "Bob" });
  });
});

describe("AsForm instance — defineExpose surface (track-changes OFF)", () => {
  it("all members are safe no-ops/empties when tracking is disabled", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { wrapper, formData } = mountForm(PatchScalarForm, {
      initialValue: { name: "Alice", age: 30 },
      trackChanges: false,
    });
    const vm = wrapper.vm as unknown as ExposedSurface;

    expect(typeof vm.submit).toBe("function");
    expect(typeof vm.reset).toBe("function");
    expect(vm.isDirty).toBe(false);
    expect(vm.changes).toEqual([]);
    expect(vm.getPatch()).toEqual({});
    expect(vm.getChanges()).toEqual([]);
    expect(() => vm.rebase()).not.toThrow();

    // Editing data must NOT flip the OFF surface dirty — no tracker exists.
    formData.value.name = "Bob";
    await nextTick();
    expect(vm.isDirty).toBe(false);
    expect(vm.changes).toEqual([]);
    expect(vm.getPatch()).toEqual({});
    expect(vm.getChanges()).toEqual([]);
    expect(() => vm.rebase()).not.toThrow();
  });
});
