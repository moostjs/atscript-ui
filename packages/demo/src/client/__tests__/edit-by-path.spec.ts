import { defineComponent, h } from "vue";
import { describe, it, expect, vi } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@atscript/vue-form", () => ({
  AsForm: defineComponent({
    name: "AsForm",
    props: { def: null, formData: null, types: null, valueHelpClientFactory: null },
    emits: ["submit"],
    setup: (_p, { slots }) => () => h("form", { "data-test": "as-form-stub" }, slots.default?.()),
  }),
  createDefaultTypes: () => ({}),
}));

vi.mock("../api/client-factory", () => ({
  clientForTable: () => ({
    meta: vi.fn().mockResolvedValue({
      type: { kind: "interface", name: "Stub", properties: {} },
      fields: { id: { sortable: true, filterable: true }, name: { sortable: true, filterable: true } },
    }),
    one: vi.fn().mockResolvedValue({ id: 1, name: "Widget" }),
    update: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
  }),
  valueHelpFactory: () => ({}),
}));

import EditByPath from "../components/EditByPath.vue";

describe("EditByPath", () => {
  it("loads meta + record then renders the form", async () => {
    const wrapper = mount(EditByPath, { props: { tablePath: "products", id: 1 } });
    expect(wrapper.text()).toContain("Edit products #1");
    await flushPromises();
    expect(wrapper.text()).not.toContain("Loading…");
    expect(wrapper.text()).not.toContain("Error:");
  });
});
