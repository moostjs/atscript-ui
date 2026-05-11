import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { describe, expect, it } from "vitest";
import { provideAsLocale, useAsLocale, type UseAsLocaleReturn } from "./use-as-locale";

function mountWithLocale(provider?: () => string | undefined) {
  let api!: UseAsLocaleReturn;
  const Probe = defineComponent({
    setup() {
      api = useAsLocale();
      return () => h("div");
    },
  });
  const Root = defineComponent({
    setup() {
      if (provider) provideAsLocale(provider);
      return () => h(Probe);
    },
  });
  mount(Root);
  return () => api;
}

describe("useAsLocale", () => {
  it("returns undefined when no provider is set", () => {
    const get = mountWithLocale();
    expect(get().locale.value).toBeUndefined();
  });

  it("returns the provider's value", () => {
    const get = mountWithLocale(() => "fr-FR");
    expect(get().locale.value).toBe("fr-FR");
  });

  it("reacts to changes in the provider's underlying source", async () => {
    const lang = ref<string | undefined>("en-US");
    const get = mountWithLocale(() => lang.value);
    expect(get().locale.value).toBe("en-US");
    lang.value = "ja-JP";
    await nextTick();
    expect(get().locale.value).toBe("ja-JP");
    lang.value = undefined;
    await nextTick();
    expect(get().locale.value).toBeUndefined();
  });
});
