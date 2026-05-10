import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import {
  provideAsNestedSectionsStore,
  type AsNestedSectionsStore,
} from "./use-as-nested-sections-store";
import { useAsOptionalAddFlow, type UseAsOptionalAddFlowReturn } from "./use-as-optional-add-flow";

interface ProbeCaptures {
  api: UseAsOptionalAddFlowReturn;
  store: AsNestedSectionsStore | undefined;
  rootRef: { value: HTMLElement | null };
}

/**
 * Mount a custom-component probe that calls `useAsOptionalAddFlow` inside
 * a tree that optionally provides the nested-sections store. The inner
 * template is a hand-written DOM tree the composable can later focus
 * into. Mirrors the pattern used by `use-as-form.spec.ts`.
 */
function mountProbe(opts: {
  provideStore?: boolean;
  pathGetter?: () => string | undefined;
}): ProbeCaptures & { unmount: () => void } {
  const { provideStore = true, pathGetter = () => "items.0" } = opts;
  const captures: { current?: ProbeCaptures } = {};

  const Inner = defineComponent({
    name: "Inner",
    setup() {
      const rootRef = ref<HTMLElement | null>(null);
      const api = useAsOptionalAddFlow({ path: pathGetter });
      // Read store via the same inject the composable uses (after Outer's provide).
      // We re-use the closure variable below — see Outer.setup().
      captures.current = {
        api,
        // Filled by Outer.setup() before this runs (provide happens in setup).
        store: storeBox.current,
        rootRef: rootRef as { value: HTMLElement | null },
      };
      return () =>
        h(
          "div",
          { ref: rootRef, class: "scope" },
          // Two existing inputs to verify "focus the new one"
          [h("input", { class: "old-1" }), h("input", { class: "old-2" })],
        );
    },
  });

  const storeBox: { current: AsNestedSectionsStore | undefined } = { current: undefined };

  const Outer = defineComponent({
    setup() {
      if (provideStore) {
        storeBox.current = provideAsNestedSectionsStore();
      }
      return () => h(Inner);
    },
  });

  const wrapper = mount(Outer, { attachTo: document.body });
  return {
    ...(captures.current as ProbeCaptures),
    unmount: () => wrapper.unmount(),
  };
}

describe("useAsOptionalAddFlow", () => {
  it("composeAction wraps the user action and registers the path open in the store", () => {
    const probe = mountProbe({ provideStore: true });
    expect(probe.store).toBeDefined();
    expect(probe.store!.isOpen("items.0")).toBe(false);

    let inner = 0;
    const wrapped = probe.api.composeAction(() => {
      inner += 1;
    });
    wrapped();
    expect(inner).toBe(1);
    expect(probe.store!.isOpen("items.0")).toBe(true);
    probe.unmount();
  });

  it("composeAction is a no-op for the store when the path getter returns undefined", () => {
    const probe = mountProbe({
      provideStore: true,
      pathGetter: () => undefined,
    });
    const wrapped = probe.api.composeAction(() => {});
    expect(() => wrapped()).not.toThrow();
    expect(probe.store!.open.value.size).toBe(0);
    probe.unmount();
  });

  it("composeAction works when no nested-sections store is provided", () => {
    const probe = mountProbe({ provideStore: false });
    expect(probe.store).toBeUndefined();
    const fn = vi.fn();
    const wrapped = probe.api.composeAction(fn);
    expect(() => wrapped()).not.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
    probe.unmount();
  });

  it("runAndFocusNew runs the action, sets store-open, and focuses the newly-mounted input", async () => {
    const probe = mountProbe({ provideStore: true });

    // Action: append a new input to the scope (simulates "add item" without
    // touching Vue's render — focusNewFocusableAfter just queries the DOM).
    const action = () => {
      const newInput = document.createElement("input");
      newInput.className = "fresh";
      probe.rootRef.value!.appendChild(newInput);
    };

    await probe.api.runAndFocusNew(() => probe.rootRef.value, action, 0);
    expect(probe.store!.isOpen("items.0")).toBe(true);
    expect(document.activeElement).toBe(probe.rootRef.value!.querySelector(".fresh"));
    probe.unmount();
  });

  it("path getter is read on every wrap call — variant switches inside a union", () => {
    let path: string | undefined = "a.0";
    const captures: {
      api?: UseAsOptionalAddFlowReturn;
      store?: AsNestedSectionsStore;
    } = {};

    const Inner = defineComponent({
      setup() {
        captures.api = useAsOptionalAddFlow({ path: () => path });
        return () => h("div");
      },
    });

    const Outer = defineComponent({
      setup() {
        captures.store = provideAsNestedSectionsStore();
        return () => h(Inner);
      },
    });

    mount(Outer);
    captures.api!.composeAction(() => {})();
    expect(captures.store!.isOpen("a.0")).toBe(true);

    path = "b.0";
    captures.api!.composeAction(() => {})();
    expect(captures.store!.isOpen("b.0")).toBe(true);
    // Old path stays open — store is the OR of every wrap that has fired.
    expect(captures.store!.isOpen("a.0")).toBe(true);
  });
});
