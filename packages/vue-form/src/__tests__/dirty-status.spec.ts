import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import AsFieldShell from "../components/defaults/as-field-shell.vue";
import { mountForm } from "./helpers";

/**
 * Change-tracking surfaces that live OUTSIDE the leaf `as-default-field` root:
 *
 *  1. Structured renderers (`AsObject` / `AsArray` / `AsTuple`) forward their
 *     `isDirty` prop into `AsCollapsible`, which paints `data-dirty` on the
 *     section root AND its heading — and on nothing else, so a dirty container
 *     does not make every descendant label look modified.
 *  2. `AsFieldShell`'s `status` slot — the accessible counterpart of the
 *     visual `data-dirty` rail: an sr-only "Modified" node that the input's
 *     `aria-describedby` points at.
 */

function shellProps(overrides: Record<string, unknown> = {}) {
  return {
    onBlur: () => {},
    model: { value: "" },
    type: "text",
    path: "",
    inputId: "shell-input",
    errorId: "shell-input-err",
    descId: "shell-input-desc",
    statusId: "shell-input-status",
    ...overrides,
  };
}

describe("AsCollapsible — dirty flag reaches structured sections", () => {
  it("marks a dirty nested object's section and heading, but not its clean child field", async () => {
    const { PatchSectionForm } = await import("./fixtures/patch-forms.as");
    const { wrapper } = mountForm(PatchSectionForm, {
      initialValue: {
        name: "Cart",
        address: { city: "Rotterdam", zip: "3011" },
      },
      trackChanges: true,
    });
    await nextTick();

    // Sections are keyed by the path AsCollapsible registers with the store —
    // the address object is the only `<details>` containing the city input.
    const section = () =>
      wrapper.findAll("details").find((d) => d.find('input[name="city"]').exists())!;

    // Clean baseline — nothing carries the attribute.
    expect(section().attributes("data-dirty")).toBeUndefined();

    const cityInput = wrapper.findAll("input").find((i) => i.attributes("name") === "city")!;
    await cityInput.setValue("Amsterdam");
    await nextTick();

    // The container lights up via its leaf — root AND heading.
    const dirtySection = section();
    expect(dirtySection.attributes("data-dirty")).toBe("");
    expect(dirtySection.find("h3, h4").attributes("data-dirty")).toBe("");

    // …and the dirty look does NOT cascade: the untouched sibling leaf inside
    // the very same section stays clean.
    const zipInput = wrapper.findAll("input").find((i) => i.attributes("name") === "zip")!;
    const zipField = zipInput.element.closest(".as-default-field") as HTMLElement;
    expect(zipField.getAttribute("data-dirty")).toBeNull();

    // The edited leaf itself is still marked (unchanged behaviour).
    const cityField = cityInput.element.closest(".as-default-field") as HTMLElement;
    expect(cityField.getAttribute("data-dirty")).toBe("");
  });
});

describe("AsFieldShell — accessible dirty status", () => {
  it("renders the sr-only status node and links it through aria-describedby", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { wrapper } = mountForm(PatchScalarForm, {
      initialValue: { name: "Cart", age: 3 },
      trackChanges: true,
    });
    await nextTick();

    const nameInput = wrapper.findAll("input").find((i) => i.attributes("name") === "name")!;
    const inputId = nameInput.attributes("id")!;
    const statusId = `${inputId}-status`;

    // Clean — no status node, no idref.
    expect(wrapper.find(`#${statusId}`).exists()).toBe(false);
    expect(nameInput.attributes("aria-describedby")).toBeUndefined();

    await nameInput.setValue("Basket");
    await nextTick();

    const status = wrapper.find(`#${statusId}`);
    expect(status.exists()).toBe(true);
    expect(status.text()).toBe("Modified");
    expect(status.classes()).toContain("as-field-status");

    const describedBy = nameInput.attributes("aria-describedby") ?? "";
    expect(describedBy.split(" ")).toContain(statusId);

    // The untouched sibling gets neither.
    const ageInput = wrapper.findAll("input").find((i) => i.attributes("name") === "age")!;
    expect(wrapper.find(`#${ageInput.attributes("id")}-status`).exists()).toBe(false);
    expect(ageInput.attributes("aria-describedby")).toBeUndefined();
  });

  it("keeps the error idref alongside the status idref", () => {
    const wrapper = mount(AsFieldShell as any, {
      props: shellProps({ isDirty: true, error: "Required" }),
      slots: { default: "<input />" },
    });
    // The shell renders both nodes; AsField is what joins the two ids, so this
    // asserts the shell side: error keeps `errorId`, status owns `statusId`.
    expect(wrapper.find("#shell-input-err").text()).toBe("Required");
    expect(wrapper.find("#shell-input-status").text()).toBe("Modified");
  });

  it("a custom status slot replaces the default markup wholesale", () => {
    const wrapper = mount(AsFieldShell as any, {
      props: shellProps({ isDirty: true, error: "Required" }),
      slots: {
        default: "<input />",
        status: `<template #status="{ isDirty, error, statusId }">
          <span :id="statusId" data-testid="custom">{{ error }}/{{ isDirty }}</span>
        </template>`,
      },
    });
    const custom = wrapper.find('[data-testid="custom"]');
    expect(custom.exists()).toBe(true);
    expect(custom.text()).toBe("Required/true");
    expect(custom.attributes("id")).toBe("shell-input-status");
    // Default markup is gone — the slot owns the whole footer status area.
    expect(wrapper.find(".as-error-slot").exists()).toBe(false);
    expect(wrapper.find(".as-field-status").exists()).toBe(false);
  });

  it("renders no status node when the field is clean", () => {
    const wrapper = mount(AsFieldShell as any, {
      props: shellProps({ isDirty: false }),
      slots: { default: "<input />" },
    });
    expect(wrapper.find(".as-field-status").exists()).toBe(false);
    expect(wrapper.find("#shell-input-status").exists()).toBe(false);
  });

  it("passes isDirty and statusId to the header slot", () => {
    const wrapper = mount(AsFieldShell as any, {
      props: shellProps({ isDirty: true, label: "Name" }),
      slots: {
        default: "<input />",
        header: `<template #header="{ isDirty, statusId }">
          <span data-testid="hdr">{{ statusId }}|{{ isDirty }}</span>
        </template>`,
      },
    });
    expect(wrapper.find('[data-testid="hdr"]').text()).toBe("shell-input-status|true");
  });
});
