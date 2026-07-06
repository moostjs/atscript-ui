import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, type ComputedRef } from "vue";
import { useAsDescendantErrorCounts } from "../composables/use-as-nested-sections-store";
import { mountForm } from "./helpers";

// End-to-end coverage for the LIVE error aggregation: the descendant
// error-counts map (badges) must mirror what fields actually display —
// blur/change-time errors count immediately, and fixing a value (typed OR
// programmatic, e.g. a "discard changes" data restore) clears the count
// without waiting for another submit.

/** Mount LiveErrorForm with a probe that injects the descendant counts map. */
async function mountLiveErrorForm() {
  const { LiveErrorForm } = await import("./fixtures/live-error-forms.as");
  let counts: ComputedRef<Map<string, number>> | undefined;
  const Probe = defineComponent({
    setup() {
      counts = useAsDescendantErrorCounts();
      return () => h("i");
    },
  });
  const mounted = mountForm(LiveErrorForm, { slot: () => h(Probe) });
  return { ...mounted, counts: counts! };
}

describe("descendant error counts — live field errors", () => {
  it("counts a live (pre-submit) validation error on the leaf and its ancestors", async () => {
    const { wrapper, counts } = await mountLiveErrorForm();
    expect(counts.value.size).toBe(0);

    // Touch the field (default `on-change` gating), then clear it — the
    // field displays "Name is required" live, with NO submit involved.
    const input = wrapper.find("input");
    await input.setValue("Bob");
    await nextTick();
    expect(counts.value.size).toBe(0);

    await input.setValue("");
    await nextTick();
    expect(counts.value.get("info.name")).toBe(1);
    expect(counts.value.get("info")).toBe(1);
  });

  it("clears the count live when the user fixes the value (no second submit)", async () => {
    const { wrapper, counts } = await mountLiveErrorForm();

    await wrapper.find("form").trigger("submit");
    await nextTick();
    expect(counts.value.get("info.name")).toBe(1);

    await wrapper.find("input").setValue("Bob");
    await nextTick();
    expect(counts.value.size).toBe(0);
  });

  it("clears the count on a programmatic data fix (discard-changes restore)", async () => {
    const { wrapper, counts, formData } = await mountLiveErrorForm();

    await wrapper.find("form").trigger("submit");
    await nextTick();
    expect(counts.value.get("info.name")).toBe(1);
    expect(counts.value.get("info")).toBe(1);

    // A host-side restore writes the data directly — no input events, no
    // submit. The field stops displaying its error, so the badge must drop.
    formData.value.info.name = "Bob";
    await nextTick();
    expect(counts.value.size).toBe(0);
  });

  it("still counts submit-time errors for an untouched form", async () => {
    const { wrapper, counts } = await mountLiveErrorForm();

    await wrapper.find("form").trigger("submit");
    await nextTick();
    expect(counts.value.get("info.name")).toBe(1);
    expect(counts.value.get("info")).toBe(1);
  });

  it("exposed clearErrors() empties the counts map", async () => {
    const { wrapper, counts } = await mountLiveErrorForm();

    await wrapper.find("form").trigger("submit");
    await nextTick();
    expect(counts.value.get("info.name")).toBe(1);

    (wrapper.vm as unknown as { clearErrors: () => void }).clearErrors();
    await nextTick();
    expect(counts.value.size).toBe(0);
  });
});
