import { resetDefaultClientFactory, resetMetaCache, setDefaultClientFactory } from "@atscript/ui";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAsValueHelp } from "../composables/use-as-value-help";

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
    mount(C);
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
  });
});
