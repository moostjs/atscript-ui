import {
  getMetaEntry,
  resetDefaultClientFactory,
  resetMetaCache,
  setDefaultClientFactory,
  setMetaCacheMaxEntries,
  setUiLocale,
} from "@atscript/ui";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT_FACTORY_KEY, useAsValueHelp } from "../composables/use-as-value-help";
import { provideAsLocale } from "../composables/use-as-locale";

const str = { kind: "", designType: "string", tags: [] };
const DICT_META = {
  searchable: false,
  primaryKeys: ["attribute", "value"],
  fields: {},
  type: {
    $v: 2,
    metadata: {},
    type: {
      kind: "object",
      tags: [],
      propsPatterns: [],
      props: {
        attribute: { metadata: { "meta.id": true }, type: str },
        value: { metadata: { "meta.id": true }, type: str },
        label: { metadata: { "ui.dict.label": true }, type: str },
      },
    },
  },
};

afterEach(() => {
  setMetaCacheMaxEntries();
  resetMetaCache();
  resetDefaultClientFactory();
});

describe("useAsValueHelp — @ui.valueHelp scope", () => {
  it("applies the static filter and commits the `value` field, not the composite key head", async () => {
    const query = vi.fn().mockResolvedValue([{ attribute: "color", value: "blue", label: "Blue" }]);
    setDefaultClientFactory(
      () => ({ meta: () => Promise.resolve(DICT_META), query, invalidateMeta: () => {} }) as never,
    );

    const model = { value: undefined as unknown };
    const filter = { attribute: { $eq: "color" } };
    let vh!: ReturnType<typeof useAsValueHelp>;
    const C = defineComponent({
      setup() {
        vh = useAsValueHelp({
          info: { url: "/attribute-values", targetField: "value", filter: filter as never },
          model,
          onBlur: () => {},
        });
        return () => h("span");
      },
    });
    const wrapper = mount(C);
    await flushPromises();

    // first search (no text): the static scope is the whole filter
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]![0]).toMatchObject({ filter });

    // typed search: scope AND'd with the `$or`; exact match on `value`
    const searchText = ref("bl");
    vh.searchText.value = searchText.value;
    await new Promise((r) => setTimeout(r, 400));
    await flushPromises();
    const typed = query.mock.calls.at(-1)![0] as {
      filter: { $and: [unknown, { $or: unknown[] }] };
    };
    expect(typed.filter.$and[0]).toEqual(filter);
    expect(typed.filter.$and[1].$or).toContainEqual({ value: "bl" });
    expect(typed.filter.$and[1].$or).not.toContainEqual({ attribute: "bl" });

    vh.selectItem({ attribute: "color", value: "blue", label: "Blue" });
    expect(model.value).toBe("blue");
    wrapper.unmount();
  });

  it("keeps the picker's meta entry (and injected client) cached while mounted", async () => {
    setMetaCacheMaxEntries(1);
    const query = vi.fn().mockResolvedValue([]);
    const injected = vi.fn(
      () => ({ meta: () => Promise.resolve(DICT_META), query, invalidateMeta: () => {} }) as never,
    );
    const other = () =>
      ({ meta: () => Promise.resolve(DICT_META), query, invalidateMeta: () => {} }) as never;
    setDefaultClientFactory(other);

    let vh!: ReturnType<typeof useAsValueHelp>;
    const C = defineComponent({
      setup() {
        vh = useAsValueHelp({
          info: { url: "/dict", targetField: "value" },
          model: { value: undefined },
          onBlur: () => {},
        });
        return () => h("span");
      },
    });
    const wrapper = mount(C, { global: { provide: { [CLIENT_FACTORY_KEY as symbol]: injected } } });
    const held = getMetaEntry("/dict");
    getMetaEntry("/a");
    getMetaEntry("/b");
    // `kickoff` resolves through the cache: still the entry built by the injected factory.
    await vh.kickoff();
    expect(vh.status.value).toBe("ready");
    expect(getMetaEntry("/dict")).toBe(held);
    expect(injected).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    getMetaEntry("/c");
    expect(getMetaEntry("/dict")).not.toBe(held);
  });

  // Why: the picker used to keep the client of the locale it mounted in, and a
  // resolve started after a switch created a second entry with the DEFAULT
  // factory — losing the form's `clientFactory` (auth, transport) and asking
  // `/meta` again for nothing.
  it("follows a locale switch without a remount through the form's factory", async () => {
    const queriedIn: (string | undefined)[] = [];
    const injected = vi.fn((_url: string, opts?: { locale?: string }) => ({
      meta: () => Promise.resolve(DICT_META),
      query: vi.fn(async () => {
        queriedIn.push(opts?.locale);
        return [];
      }),
      invalidateMeta: () => {},
    })) as never;
    const fallback = vi.fn(() => {
      throw new Error("the default factory must not be used");
    });
    setDefaultClientFactory(fallback as never);

    const locale = ref("de");
    let vh!: ReturnType<typeof useAsValueHelp>;
    const Field = defineComponent({
      setup() {
        vh = useAsValueHelp({
          info: { url: "/dict", targetField: "value" },
          model: { value: undefined },
          onBlur: () => {},
        });
        return () => h("span");
      },
    });
    const wrapper = mount(
      defineComponent({
        setup() {
          provideAsLocale(() => locale.value);
          return () => h(Field);
        },
      }),
      { global: { provide: { [CLIENT_FACTORY_KEY as symbol]: injected } } },
    );
    await flushPromises();
    expect(vh.status.value).toBe("ready");
    expect(queriedIn).toEqual(["de"]);

    locale.value = "en";
    await nextTick();
    await flushPromises();
    // the resolve restarted in `en` and re-ran the search with its client
    expect(queriedIn).toEqual(["de", "en"]);
    expect((injected as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[1])).toEqual([
      { locale: "de" },
      { locale: "en" },
    ]);
    expect(fallback).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  // Why: the browser-global locale (`setUiLocale`) is not reactive, so a picker
  // of an app without `provideAsLocale` kept asking in the old locale.
  it("follows a setUiLocale switch without a remount", async () => {
    const asked: (string | undefined)[] = [];
    setDefaultClientFactory(((url: string, opts?: { locale?: string }) => ({
      meta: () => Promise.resolve(DICT_META),
      query: vi.fn(async () => {
        if (url === "/dict-global") asked.push(opts?.locale);
        return [];
      }),
      invalidateMeta: () => {},
    })) as never);
    setUiLocale("de");
    try {
      const wrapper = mount(
        defineComponent({
          setup() {
            useAsValueHelp({
              info: { url: "/dict-global", targetField: "value" },
              model: { value: undefined },
              onBlur: () => {},
            });
            return () => h("span");
          },
        }),
      );
      await flushPromises();
      setUiLocale("en");
      await flushPromises();
      expect(asked).toEqual(["de", "en"]);
      wrapper.unmount();
    } finally {
      setUiLocale(undefined);
    }
  });

  // Why: a search of the previous text (or locale) answering after the next
  // one overwrote its results.
  it("a superseded search never overwrites the newer one's results", async () => {
    const pending: ((rows: unknown[]) => void)[] = [];
    setDefaultClientFactory(
      () =>
        ({
          meta: () => Promise.resolve(DICT_META),
          query: () => new Promise((resolve) => pending.push(resolve)),
          invalidateMeta: () => {},
        }) as never,
    );
    let vh!: ReturnType<typeof useAsValueHelp>;
    const wrapper = mount(
      defineComponent({
        setup() {
          vh = useAsValueHelp({
            info: { url: "/dict2", targetField: "value" },
            model: { value: undefined },
            onBlur: () => {},
          });
          return () => h("span");
        },
      }),
    );
    await flushPromises();
    vh.searchText.value = "bl";
    await new Promise((r) => setTimeout(r, 400));
    await flushPromises();
    expect(pending).toHaveLength(2);
    pending[1]!([{ attribute: "color", value: "blue", label: "Blue" }]);
    await flushPromises();
    pending[0]!([{ attribute: "x", value: "stale", label: "Stale" }]);
    await flushPromises();
    expect(vh.results.value.map((r) => r.value)).toEqual(["blue"]);
    expect(vh.searching.value).toBe(false);
    wrapper.unmount();
  });

  // Why: a search still in flight when the picker was cleared (or the locale
  // switched) landed afterwards and refilled the cleared results.
  it("a search in flight when the picker is cleared never lands", async () => {
    const pending: ((rows: unknown[]) => void)[] = [];
    setDefaultClientFactory(
      () =>
        ({
          meta: () => Promise.resolve(DICT_META),
          query: () => new Promise((resolve) => pending.push(resolve)),
          invalidateMeta: () => {},
        }) as never,
    );
    let vh!: ReturnType<typeof useAsValueHelp>;
    const wrapper = mount(
      defineComponent({
        setup() {
          vh = useAsValueHelp({
            info: { url: "/dict3", targetField: "value" },
            model: { value: undefined },
            onBlur: () => {},
          });
          return () => h("span");
        },
      }),
    );
    await flushPromises();
    expect(pending).toHaveLength(1);
    vh.clear();
    pending[0]!([{ attribute: "x", value: "late", label: "Late" }]);
    await flushPromises();
    expect(vh.results.value).toEqual([]);
    expect(vh.searching.value).toBe(false);
    wrapper.unmount();
  });
});
