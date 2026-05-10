import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import {
  useAsExternalErrors,
  type UseAsExternalErrorsReturn,
} from "../composables/use-as-external-errors";

/**
 * Mount a tiny component that drives `useAsExternalErrors` through a
 * `ref` so we can swap its identity from the outside, exposing the
 * resulting composable + ref to the test.
 */
function mountWithSource(initial: Record<string, string | undefined> | undefined) {
  const source = ref<Record<string, string | undefined> | undefined>(initial);
  let captured!: UseAsExternalErrorsReturn;
  const Probe = defineComponent({
    setup() {
      captured = useAsExternalErrors({ source: () => source.value });
      return () => h("div");
    },
  });
  mount(Probe);
  return {
    source,
    get composable() {
      return captured;
    },
  };
}

describe("useAsExternalErrors", () => {
  it("returns undefined effective when source is undefined", () => {
    const { composable } = mountWithSource(undefined);
    expect(composable.effective.value).toBeUndefined();
    expect(composable.formError.value).toBeUndefined();
    expect(composable.isFormDismissed.value).toBe(false);
  });

  it("exposes leaf errors via `effective` (without `__form`)", () => {
    const { composable } = mountWithSource({
      name: "bad name",
      __form: "form-level",
      "details.email": "bad email",
    });
    expect(composable.effective.value).toEqual({
      name: "bad name",
      "details.email": "bad email",
    });
    expect(composable.formError.value).toBe("form-level");
  });

  it("`dismissAt(path)` removes that leaf from `effective` (idempotent)", async () => {
    const { composable } = mountWithSource({ name: "bad", email: "still bad" });
    composable.dismissAt("name");
    await nextTick();
    expect(composable.effective.value).toEqual({ email: "still bad" });

    // Calling again is a no-op (no thrown error, no Set churn).
    composable.dismissAt("name");
    await nextTick();
    expect(composable.effective.value).toEqual({ email: "still bad" });
  });

  it("`dismissForm()` flips `isFormDismissed` and hides `formError`", async () => {
    const { composable } = mountWithSource({ __form: "down for maintenance" });
    expect(composable.formError.value).toBe("down for maintenance");
    composable.dismissForm();
    await nextTick();
    expect(composable.formError.value).toBeUndefined();
    expect(composable.isFormDismissed.value).toBe(true);
  });

  it("identity-reset re-arms all dismissals when source changes reference", async () => {
    const { source, composable } = mountWithSource({
      name: "bad",
      __form: "down",
    });
    composable.dismissAt("name");
    composable.dismissForm();
    await nextTick();
    expect(composable.effective.value).toEqual({});
    expect(composable.formError.value).toBeUndefined();

    // Fresh server response — new identity, dismissals reset.
    source.value = { name: "still bad", __form: "still down" };
    await nextTick();
    expect(composable.effective.value).toEqual({ name: "still bad" });
    expect(composable.formError.value).toBe("still down");
    expect(composable.isFormDismissed.value).toBe(false);
  });

  it("in-place mutation of source does NOT reset dismissals", async () => {
    const errs = { name: "bad" } as Record<string, string | undefined>;
    const { composable } = mountWithSource(errs);
    composable.dismissAt("name");
    await nextTick();
    expect(composable.effective.value).toEqual({});

    // Same identity, mutated content. Dismissal must survive.
    errs.name = "still bad (different message)";
    // The source ref's `.value` reference didn't change — Vue won't
    // schedule a watcher tick. Manually settle the queue and assert the
    // dismissal is still in effect.
    await nextTick();
    expect(composable.effective.value).toEqual({});
  });

  it("`reset()` un-dismisses everything without changing source identity", async () => {
    const { composable } = mountWithSource({ a: "x", __form: "form" });
    composable.dismissAt("a");
    composable.dismissForm();
    await nextTick();
    expect(composable.effective.value).toEqual({});
    expect(composable.formError.value).toBeUndefined();

    composable.reset();
    await nextTick();
    expect(composable.effective.value).toEqual({ a: "x" });
    expect(composable.formError.value).toBe("form");
  });

  it("`dismissAt('')` is a no-op (no allocation, no add)", async () => {
    const { composable } = mountWithSource({ name: "bad" });
    composable.dismissAt("");
    await nextTick();
    expect(composable.effective.value).toEqual({ name: "bad" });
  });
});
