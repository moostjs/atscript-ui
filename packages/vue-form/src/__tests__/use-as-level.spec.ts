import { describe, expect, it, beforeAll } from "vitest";
import { createFormDef } from "@atscript/ui";
import { installDynamicResolver } from "@atscript/ui-fns";
import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, provide, ref, type ComputedRef } from "vue";
import AsIterator from "../components/as-iterator.vue";
import { LEVEL_KEY } from "../composables/internal-keys";
import { provideAsNestedLevel, useAsLevel } from "../composables/use-as-level";
import { ContainerForm } from "./fixtures/container-renderer.as";
import { mountFormWithProbe } from "./helpers";

// `allStatic` (and thus the fn.hidden gating on `advanced`) depends on the
// dynamic resolver being active when `createFormDef` runs.
beforeAll(() => {
  installDynamicResolver();
});

describe("useAsLevel", () => {
  it("defaults to -1 outside any form / structured field", () => {
    let level!: ComputedRef<number>;
    const Probe = defineComponent({
      setup() {
        level = useAsLevel();
        return () => h("div");
      },
    });
    mount(Probe);
    expect(level.value).toBe(-1);
  });
});

describe("provideAsNestedLevel", () => {
  it("bumps one level relative to the (root) parent by default", () => {
    // No injected parent → ROOT (-1); default levels=1 → 0.
    let inner!: ComputedRef<number>;
    const Inner = defineComponent({
      setup() {
        inner = useAsLevel();
        return () => h("div");
      },
    });
    const Outer = defineComponent({
      setup() {
        provideAsNestedLevel();
        return () => h(Inner);
      },
    });
    mount(Outer);
    expect(inner.value).toBe(0);
  });

  it("stacks — nested provides accumulate relative to each parent", () => {
    let inner!: ComputedRef<number>;
    const Inner = defineComponent({
      setup() {
        inner = useAsLevel();
        return () => h("div");
      },
    });
    const Mid = defineComponent({
      setup() {
        // parent = 0 (from Outer) → +2 = 2
        provideAsNestedLevel(2);
        return () => h(Inner);
      },
    });
    const Outer = defineComponent({
      setup() {
        // parent = -1 (root) → +1 = 0
        provideAsNestedLevel(1);
        return () => h(Mid);
      },
    });
    mount(Outer);
    expect(inner.value).toBe(2);
  });

  it("reacts when the injected parent level changes", async () => {
    const parentLevel = ref(0);
    let inner!: ComputedRef<number>;
    const Inner = defineComponent({
      setup() {
        inner = useAsLevel();
        return () => h("div");
      },
    });
    const Mid = defineComponent({
      setup() {
        provideAsNestedLevel(1); // parent + 1
        return () => h(Inner);
      },
    });
    const Top = defineComponent({
      setup() {
        // Provide a reactive parent level directly (mirrors a real ancestor
        // whose level is data-driven).
        provide(
          LEVEL_KEY,
          computed(() => parentLevel.value),
        );
        return () => h(Mid);
      },
    });
    mount(Top);
    expect(inner.value).toBe(1); // 0 + 1

    parentLevel.value = 4;
    expect(inner.value).toBe(5); // 4 + 1
  });
});

describe("AsIterator `levels` prop", () => {
  // AsIterator is documented sugar over provideAsNestedLevel. Rendered
  // structured children read the bumped level via the same LEVEL_KEY that
  // useAsLevel reads, surfacing it as `data-object-level` (AsField renders a
  // structured field at parentLevel + 1).

  function objectLevels(levels: number): number[] {
    const def = createFormDef(ContainerForm);
    const { wrapper } = mountFormWithProbe(
      ContainerForm,
      () => h(AsIterator as any, { def, levels }),
      { initialValue: { title: "t", profile: { bio: "b", address: { street: "s" } } } },
    );
    return wrapper
      .findAll("[data-object-level]")
      .map((el) => Number(el.attributes("data-object-level")));
  }

  it("bumps rendered structured children by the given number of levels", () => {
    // slot parent level is -1 (AsForm provides no level at root).
    // levels=2 → AsIterator provides 1 → profile renders at 2, address at 3.
    const levels2 = objectLevels(2);
    expect(levels2).toContain(2);
    expect(levels2).toContain(3);
  });

  it("nested structured fields resume section/island alternation (parent + 1)", () => {
    // levels=0 → AsIterator provides -1 → profile at 0, nested address at 1.
    const levels0 = objectLevels(0);
    // profile (outer) and address (nested) differ by exactly one → alternation.
    const profile = Math.min(...levels0.filter((n) => n >= 0));
    expect(levels0).toContain(profile);
    expect(levels0).toContain(profile + 1);
    expect(profile).toBe(0);
  });
});
