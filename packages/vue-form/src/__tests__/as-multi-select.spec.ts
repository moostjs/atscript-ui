import { createFormDef, isArrayField } from "@atscript/ui";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { mountForm } from "./helpers";

// Reka-ui's ComboboxPortal teleports the popup outside the mount wrapper.
// In happy-dom we set `attachTo: document.body` via the helper if needed,
// but for our assertions we query the rendered popup directly from
// `document.body` and exercise the model from script — the option list is
// `props.options`, so the component receives it independently of whether
// the popup is "open" in DOM.

describe("AsMultiSelect", () => {
  it("dispatches to multiselect for array of literal-union items", async () => {
    const { LiteralUnionMultiselect } = await import("./fixtures/multiselect-forms.as");
    const def = createFormDef(LiteralUnionMultiselect);
    const field = def.fields.find((f) => f.name === "tags");
    expect(field).toBeDefined();
    expect(isArrayField(field!)).toBe(true);
    expect(field!.customType).toBe("multiselect");

    const { wrapper } = mountForm(LiteralUnionMultiselect);
    expect(wrapper.find(".as-multi-select-root").exists()).toBe(true);
    expect(wrapper.find(".as-multi-select-anchor").exists()).toBe(true);
    expect(wrapper.find(".as-multi-select-input").exists()).toBe(true);
  });

  it("dispatches to multiselect for string[] with @ui.form.options", async () => {
    const { ExplicitOptionsMultiselect } = await import("./fixtures/multiselect-forms.as");
    const def = createFormDef(ExplicitOptionsMultiselect);
    const field = def.fields.find((f) => f.name === "roles");
    expect(field!.customType).toBe("multiselect");

    const { wrapper } = mountForm(ExplicitOptionsMultiselect);
    expect(wrapper.find(".as-multi-select-root").exists()).toBe(true);
  });

  it("plain string[] without options does NOT render as multiselect", async () => {
    const { PlainStringArray } = await import("./fixtures/multiselect-forms.as");
    const def = createFormDef(PlainStringArray);
    const field = def.fields.find((f) => f.name === "items");
    expect(field!.customType).toBeUndefined();

    const { wrapper } = mountForm(PlainStringArray);
    expect(wrapper.find(".as-multi-select-root").exists()).toBe(false);
    // Falls through to AsArray's add button.
    expect(wrapper.find(".as-array-add-btn").exists()).toBe(true);
  });

  it("writing to the model surfaces chips inside the anchor", async () => {
    const { LiteralUnionMultiselect } = await import("./fixtures/multiselect-forms.as");
    const { wrapper, formData } = mountForm(LiteralUnionMultiselect);

    expect(formData.value.tags).toEqual([]);
    expect(wrapper.findAll(".as-multi-select-chip").length).toBe(0);

    formData.value.tags = ["a", "c"];
    await nextTick();

    const chips = wrapper.findAll(".as-multi-select-chip");
    expect(chips.length).toBe(2);
    expect(chips[0]!.text()).toContain("a");
    expect(chips[1]!.text()).toContain("c");
  });

  it("clicking a chip's remove button drops that value from the model", async () => {
    const { LiteralUnionMultiselect } = await import("./fixtures/multiselect-forms.as");
    const { wrapper, formData } = mountForm(LiteralUnionMultiselect);

    formData.value.tags = ["a", "b", "c"];
    await nextTick();

    const removes = wrapper.findAll(".as-multi-select-chip-remove");
    expect(removes.length).toBe(3);

    await removes[1]!.trigger("click");
    await nextTick();
    expect(formData.value.tags).toEqual(["a", "c"]);

    await wrapper.findAll(".as-multi-select-chip-remove")[0]!.trigger("click");
    await nextTick();
    expect(formData.value.tags).toEqual(["c"]);
  });

  it("respects @expect.minLength / maxLength on the array on submit", async () => {
    const { BoundedMultiselect } = await import("./fixtures/multiselect-forms.as");
    const { wrapper, formData } = mountForm(BoundedMultiselect);

    await wrapper.find("form").trigger("submit");
    await nextTick();
    let errors = wrapper.emitted("error");
    expect(errors).toBeTruthy();
    expect(
      (errors![0]![0] as { message: string }[]).some((e) =>
        e.message.includes("At least one tag required"),
      ),
    ).toBe(true);

    formData.value.tags = ["a", "b", "c"];
    await nextTick();
    await wrapper.find("form").trigger("submit");
    await nextTick();
    errors = wrapper.emitted("error");
    expect(errors!.length).toBeGreaterThanOrEqual(2);
    const lastErrors = errors![errors!.length - 1]![0] as { message: string }[];
    expect(lastErrors.some((e) => e.message.includes("At most two tags"))).toBe(true);
  });

  it("disables the combobox input and chip-remove buttons when @ui.form.disabled is set", async () => {
    const { DisabledMultiselect } = await import("./fixtures/multiselect-forms.as");
    const { wrapper, formData } = mountForm(DisabledMultiselect);
    formData.value.tags = ["a", "b"];
    await nextTick();

    const input = wrapper.find(".as-multi-select-input");
    expect(input.attributes("disabled")).toBeDefined();

    const removes = wrapper.findAll(".as-multi-select-chip-remove");
    expect(removes.length).toBe(2);
    for (const btn of removes) {
      expect(btn.attributes("disabled")).toBeDefined();
    }
  });

  it("marks the combobox input readonly when @meta.readonly is set", async () => {
    const { ReadonlyMultiselect } = await import("./fixtures/multiselect-forms.as");
    const { wrapper } = mountForm(ReadonlyMultiselect);
    const input = wrapper.find(".as-multi-select-input");
    expect(input.attributes("readonly")).toBeDefined();
  });

  describe("optional + undefined", () => {
    // Mirrors AsSelect/AsInput: optional scalar fields render AsFieldShell's
    // AsNoData placeholder when the model is undefined, not the AsArray-style
    // bordered "Add X" CTA.
    it("renders the AsNoData placeholder instead of the combobox when undefined", async () => {
      const { OptionalMultiselect } = await import("./fixtures/multiselect-forms.as");
      const { wrapper, formData } = mountForm(OptionalMultiselect);

      expect(formData.value.tags).toBeUndefined();
      const fields = wrapper.findAll(".as-multi-select-field");
      expect(fields.length).toBe(2);
      for (const field of fields) {
        expect(field.find(".as-multi-select-root").exists()).toBe(false);
        expect(field.find(".as-no-data").exists()).toBe(true);
        expect(field.find(".as-object-empty-add").exists()).toBe(false);
      }
    });

    it("clicking the placeholder initializes the model to [] and reveals the combobox", async () => {
      const { OptionalMultiselect } = await import("./fixtures/multiselect-forms.as");
      const { wrapper, formData } = mountForm(OptionalMultiselect);

      const literalField = wrapper
        .findAll(".as-multi-select-field")
        .find((f) => f.find(".as-field-label").text().includes("Preferred frameworks"))!;
      await literalField.find(".as-no-data").trigger("click");
      await nextTick();

      expect(formData.value.tags).toEqual([]);
      expect(literalField.find(".as-multi-select-root").exists()).toBe(true);
      expect(literalField.findAll(".as-multi-select-chip").length).toBe(0);
    });

    it("clearing via the X button returns to the placeholder state", async () => {
      const { OptionalMultiselect } = await import("./fixtures/multiselect-forms.as");
      const { wrapper, formData } = mountForm(OptionalMultiselect);

      const literalField = wrapper
        .findAll(".as-multi-select-field")
        .find((f) => f.find(".as-field-label").text().includes("Preferred frameworks"))!;
      await literalField.find(".as-no-data").trigger("click");
      await nextTick();
      expect(formData.value.tags).toEqual([]);

      await literalField.find(".as-field-header-actions .as-field-remove-btn").trigger("click");
      await nextTick();

      expect(formData.value.tags).toBeUndefined();
      expect(literalField.find(".as-multi-select-root").exists()).toBe(false);
      expect(literalField.find(".as-no-data").exists()).toBe(true);
    });
  });

  describe("clear and select-all actions", () => {
    // Reka-ui's ComboboxContent is conditionally rendered based on `open`
    // state; clicks land first on the input (focus → open) and then on
    // popup items. We assert directly against the model + on whether
    // ComboboxContent is still mounted in `document.body`.
    //
    // Portaled popups accumulate in `document.body` across tests (Reka
    // doesn't tear them down on unmount in happy-dom), so always scope
    // queries to the LAST `.as-multi-select-content` to target the
    // currently open popup.
    function footerButtons(): HTMLButtonElement[] {
      const popups = document.body.querySelectorAll(".as-multi-select-content");
      const popup = popups[popups.length - 1] as HTMLElement | undefined;
      if (!popup) return [];
      return Array.from(
        popup.querySelectorAll(".as-multi-select-footer-action"),
      ) as HTMLButtonElement[];
    }

    it("inline clear button: absent when selection is empty, present after a selection", async () => {
      const { LiteralUnionMultiselect } = await import("./fixtures/multiselect-forms.as");
      const { wrapper, formData } = mountForm(LiteralUnionMultiselect);

      expect(wrapper.find(".as-multi-select-clear").exists()).toBe(false);

      formData.value.tags = ["a"];
      await nextTick();
      expect(wrapper.find(".as-multi-select-clear").exists()).toBe(true);
    });

    it("inline clear button: hidden when disabled or readonly even if selection exists", async () => {
      const { DisabledMultiselect } = await import("./fixtures/multiselect-forms.as");
      const disabled = mountForm(DisabledMultiselect);
      disabled.formData.value.tags = ["a"];
      await nextTick();
      expect(disabled.wrapper.find(".as-multi-select-clear").exists()).toBe(false);

      const { ReadonlyMultiselect } = await import("./fixtures/multiselect-forms.as");
      const readonly = mountForm(ReadonlyMultiselect);
      readonly.formData.value.tags = ["a"];
      await nextTick();
      expect(readonly.wrapper.find(".as-multi-select-clear").exists()).toBe(false);
    });

    it("inline clear click: sets the model to [], NOT undefined", async () => {
      const { LiteralUnionMultiselect } = await import("./fixtures/multiselect-forms.as");
      const { wrapper, formData } = mountForm(LiteralUnionMultiselect);

      formData.value.tags = ["a", "b"];
      await nextTick();

      await wrapper.find(".as-multi-select-clear").trigger("click");
      await nextTick();

      expect(formData.value.tags).toEqual([]);
      expect(formData.value.tags).not.toBeUndefined();
    });

    it("inline clear click on an optional field empties array WITHOUT reverting to undefined", async () => {
      // The inline X must not be the path back to undefined — that's the
      // field-shell X. After clicking it, the combobox stays mounted with
      // an empty array.
      const { OptionalMultiselect } = await import("./fixtures/multiselect-forms.as");
      const { wrapper, formData } = mountForm(OptionalMultiselect);

      const literalField = wrapper
        .findAll(".as-multi-select-field")
        .find((f) => f.find(".as-field-label").text().includes("Preferred frameworks"))!;
      await literalField.find(".as-no-data").trigger("click");
      await nextTick();
      formData.value.tags = ["a", "b"];
      await nextTick();

      await literalField.find(".as-multi-select-clear").trigger("click");
      await nextTick();

      expect(formData.value.tags).toEqual([]);
      expect(literalField.find(".as-multi-select-root").exists()).toBe(true);
      expect(literalField.find(".as-no-data").exists()).toBe(false);
    });

    it("footer Select all click: writes every option key into the model in order", async () => {
      const { LiteralUnionMultiselect } = await import("./fixtures/multiselect-forms.as");
      const { wrapper, formData } = mountForm(LiteralUnionMultiselect);

      const anchor = wrapper.find(".as-multi-select-anchor");
      await anchor.trigger("click");
      await nextTick();

      const [selectAllBtn] = footerButtons();
      expect(selectAllBtn).toBeDefined();
      expect(selectAllBtn!.disabled).toBe(false);

      selectAllBtn!.click();
      await nextTick();

      expect(formData.value.tags).toEqual(["a", "b", "c"]);
      // Popup stays mounted — Select all / Clear must not close it.
      expect(footerButtons().length).toBeGreaterThan(0);
    });

    it("footer Select all: disabled once every option is selected", async () => {
      const { LiteralUnionMultiselect } = await import("./fixtures/multiselect-forms.as");
      const { wrapper, formData } = mountForm(LiteralUnionMultiselect);
      formData.value.tags = ["a", "b", "c"];
      await nextTick();

      await wrapper.find(".as-multi-select-anchor").trigger("click");
      await nextTick();

      const [selectAllBtn] = footerButtons();
      expect(selectAllBtn!.disabled).toBe(true);
    });

    it("footer Clear click: empties the model and keeps the popup open", async () => {
      const { LiteralUnionMultiselect } = await import("./fixtures/multiselect-forms.as");
      const { wrapper, formData } = mountForm(LiteralUnionMultiselect);
      formData.value.tags = ["a", "b"];
      await nextTick();

      await wrapper.find(".as-multi-select-anchor").trigger("click");
      await nextTick();

      const [, clearBtn] = footerButtons();
      expect(clearBtn).toBeDefined();
      expect(clearBtn!.disabled).toBe(false);

      clearBtn!.click();
      await nextTick();

      expect(formData.value.tags).toEqual([]);
      expect(footerButtons().length).toBeGreaterThan(0);
    });

    it("footer Clear: disabled when nothing is selected", async () => {
      const { LiteralUnionMultiselect } = await import("./fixtures/multiselect-forms.as");
      const { wrapper } = mountForm(LiteralUnionMultiselect);

      await wrapper.find(".as-multi-select-anchor").trigger("click");
      await nextTick();

      const [, clearBtn] = footerButtons();
      expect(clearBtn!.disabled).toBe(true);
    });
  });
});
