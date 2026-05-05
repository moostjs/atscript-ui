import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { provideCellLocale, useCellLocale } from "../composables/use-cell-locale";

function probe(setupProvider?: () => void) {
  let captured: ReturnType<typeof useCellLocale> | undefined;
  const Host = defineComponent({
    setup() {
      setupProvider?.();
    },
    render() {
      return h(Probe);
    },
  });
  const Probe = defineComponent({
    setup() {
      captured = useCellLocale();
    },
    render: () => h("span"),
  });
  mount(Host);
  return captured!;
}

describe("useCellLocale", () => {
  it("falls back to navigator.language when no provider", () => {
    const r = probe();
    expect(typeof r.locale.value).toBe("string");
    expect(r.locale.value.length).toBeGreaterThan(0);
    expect(r.timezone.value).toBeUndefined();
  });

  it("reads provided language", () => {
    const r = probe(() => provideCellLocale({ language: "de-DE" }));
    expect(r.locale.value).toBe("de-DE");
  });

  it("reads provided timezone", () => {
    const r = probe(() => provideCellLocale({ language: "en-US", timezone: "America/New_York" }));
    expect(r.timezone.value).toBe("America/New_York");
  });

  it("treats 'system' timezone as undefined (browser default)", () => {
    const r = probe(() => provideCellLocale({ language: "en-US", timezone: "system" }));
    expect(r.timezone.value).toBeUndefined();
  });

  it("treats empty-string timezone as undefined", () => {
    const r = probe(() => provideCellLocale({ language: "en-US", timezone: "" }));
    expect(r.timezone.value).toBeUndefined();
  });

  it("falls back to navigator.language when language is empty", () => {
    const r = probe(() => provideCellLocale({ language: "" }));
    expect(r.locale.value.length).toBeGreaterThan(0);
    expect(r.locale.value).not.toBe("");
  });

  it("reactively re-evaluates when source ref changes", async () => {
    const source = ref({ language: "en-US" });
    const r = probe(() => provideCellLocale(source));
    expect(r.locale.value).toBe("en-US");
    source.value = { language: "fr-FR" };
    expect(r.locale.value).toBe("fr-FR");
  });
});
