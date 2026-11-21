import { afterEach, describe, expect, it } from "vitest";
import {
  createFormDef,
  resetDefaultClientFactory,
  resetMetaCache,
  setDefaultClientFactory,
} from "@atscript/ui";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import AsForm from "../components/as-form.vue";
import { createDefaultTypes } from "../composables/create-default-types";

// Since 0.1.177 the reference picker's "×" clears the field's value — before,
// it only emptied the search box and the selected reference stayed in the
// model. It empties the field as emptying an input does: an optional reference
// is unset (`undefined`); a required one holds `""` (string key) or `null`
// (any other key) — never its default.

const str = { kind: "", designType: "string", tags: [] };
const USERS_META = {
  searchable: false,
  primaryKeys: ["id"],
  fields: {},
  type: {
    $v: 2,
    metadata: {},
    type: {
      kind: "object",
      tags: [],
      propsPatterns: [],
      props: {
        id: { metadata: { "meta.id": true }, type: str },
        name: { metadata: { "ui.dict.label": true }, type: str },
      },
    },
  },
};

type Exposed = {
  isDirty: boolean;
  getPatch: () => Record<string, unknown>;
  submit: () => void;
};

const STORED = { owner: "u1", assignee: "u2", checker: "u1", categoryId: 3, approver: "u2" };

afterEach(() => {
  resetMetaCache();
  resetDefaultClientFactory();
  document.body.innerHTML = "";
});

async function mountRefForm(initialValue: Record<string, unknown>) {
  setDefaultClientFactory(
    () =>
      ({
        meta: () => Promise.resolve(USERS_META),
        query: () =>
          Promise.resolve([
            { id: "u1", name: "Ann" },
            { id: "u2", name: "Bob" },
          ]),
        invalidateMeta: () => {},
      }) as never,
  );
  const { RefClearForm } = await import("./fixtures/ref-forms.as");
  const def = createFormDef(RefClearForm);
  for (const f of def.fields) f.valueHelpInfo = { url: "/users", targetField: "id" };
  const formData = reactive({ value: initialValue }) as { value: Record<string, unknown> };
  const wrapper = mount(AsForm as any, {
    props: { def, formData, types: createDefaultTypes(), trackChanges: true },
    attachTo: document.body,
  });
  await flushPromises();
  await nextTick();
  return { wrapper, formData, vm: wrapper.vm as unknown as Exposed };
}

type Wrapper = Awaited<ReturnType<typeof mountRefForm>>["wrapper"];

function fieldOf(wrapper: Wrapper, label: string) {
  const field = wrapper.findAll(".as-default-field").find(
    (f) =>
      f
        .find(".as-field-label")
        .text()
        .replace(/\s*\*$/, "") === label,
  );
  if (!field) throw new Error(`no field labelled ${label}`);
  return field;
}

const clearBtn = (wrapper: Wrapper, label: string) => fieldOf(wrapper, label).find(".as-ref-clear");
const inputOf = (wrapper: Wrapper, label: string) =>
  fieldOf(wrapper, label).find<HTMLInputElement>(".as-ref-input");

describe("AsRef — the × button clears the value (since 0.1.177)", () => {
  it("an optional reference is unset; the search text goes too; the change is tracked", async () => {
    const { wrapper, formData, vm } = await mountRefForm({ ...STORED });
    const input = inputOf(wrapper, "Owner");
    await input.setValue("an");
    expect(clearBtn(wrapper, "Owner").exists()).toBe(true);

    await clearBtn(wrapper, "Owner").trigger("click");
    await nextTick();

    expect(formData.value.owner).toBeUndefined();
    expect(input.element.value).toBe("");
    expect(vm.isDirty).toBe(true);
    expect(vm.getPatch()).toEqual({ owner: null });
  });

  it("a required string key holds an empty string and shows its required error", async () => {
    const { wrapper, formData, vm } = await mountRefForm({ ...STORED });

    await clearBtn(wrapper, "Assignee").trigger("click");
    await nextTick();

    expect(formData.value.assignee).toBe("");
    expect(fieldOf(wrapper, "Assignee").find(".as-error-slot").text()).toBe("Assignee is required");
    expect(vm.getPatch()).toEqual({ assignee: "" });
  });

  it("a required string key without @meta.required holds an empty string and shows no error", async () => {
    const { wrapper, formData } = await mountRefForm({ ...STORED });

    await clearBtn(wrapper, "Checker").trigger("click");
    await nextTick();

    expect(formData.value.checker).toBe("");
    expect(fieldOf(wrapper, "Checker").find(".as-error-slot").text()).toBe("");
  });

  // A number key must not fall back to `0`: that is a valid number, so the
  // form would submit a reference to row 0.
  it("a required number key holds null, shows an error and blocks the submit", async () => {
    const { wrapper, formData, vm } = await mountRefForm({ ...STORED });

    await clearBtn(wrapper, "Category").trigger("click");
    await nextTick();

    expect(formData.value.categoryId).toBeNull();
    expect(fieldOf(wrapper, "Category").find(".as-error-slot").text()).not.toBe("");
    expect(vm.getPatch()).toEqual({ categoryId: null });
    vm.submit();
    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(wrapper.emitted("error")).toHaveLength(1);
  });

  it("a key with @meta.default stays empty — the default is not picked again", async () => {
    const { wrapper, formData } = await mountRefForm({ ...STORED });

    await clearBtn(wrapper, "Approver").trigger("click");
    await nextTick();

    expect(formData.value.approver).toBe("");
    expect(clearBtn(wrapper, "Approver").exists()).toBe(false);
  });

  it("clearing back to the stored state (nothing stored) leaves the form clean", async () => {
    const { owner: _owner, ...stored } = STORED;
    const { wrapper, formData, vm } = await mountRefForm(stored);
    formData.value.owner = "u1";
    await nextTick();
    expect(vm.isDirty).toBe(true);

    await clearBtn(wrapper, "Owner").trigger("click");
    await nextTick();

    expect(formData.value.owner).toBeUndefined();
    expect(vm.isDirty).toBe(false);
    expect(vm.getPatch()).toEqual({});
  });

  it("focus is in the input after the click, which keeps an emptied optional field in place", async () => {
    const { wrapper } = await mountRefForm({ ...STORED });

    await clearBtn(wrapper, "Owner").trigger("click");
    await nextTick();

    expect(document.activeElement).toBe(inputOf(wrapper, "Owner").element);
    expect(fieldOf(wrapper, "Owner").find(".as-no-data").exists()).toBe(false);
  });

  it("is shown for a value without search text, and for search text without a value", async () => {
    const { wrapper } = await mountRefForm({ ...STORED, assignee: "" });
    expect(inputOf(wrapper, "Owner").element.value).toBe("u1");
    expect(clearBtn(wrapper, "Owner").exists()).toBe(true);

    // Nothing to clear on the empty required field until something is typed.
    expect(clearBtn(wrapper, "Assignee").exists()).toBe(false);
    const input = inputOf(wrapper, "Assignee");
    await input.setValue("bo");
    expect(clearBtn(wrapper, "Assignee").exists()).toBe(true);
    await clearBtn(wrapper, "Assignee").trigger("click");
    await nextTick();
    expect(input.element.value).toBe("");
    expect(clearBtn(wrapper, "Assignee").exists()).toBe(false);
  });

  it("is not shown on a disabled or read-only reference", async () => {
    const { wrapper } = await mountRefForm({ ...STORED, locked: "u1", fixed: "u1" });
    expect(inputOf(wrapper, "Locked").exists()).toBe(true);
    expect(inputOf(wrapper, "Fixed").exists()).toBe(true);
    expect(clearBtn(wrapper, "Locked").exists()).toBe(false);
    expect(clearBtn(wrapper, "Fixed").exists()).toBe(false);
  });
});
