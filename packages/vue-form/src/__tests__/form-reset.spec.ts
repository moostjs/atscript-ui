import { describe, it, expect } from "vitest";
import { createFormData, createFormDef } from "@atscript/ui";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive, ref, toRaw } from "vue";
import AsField from "../components/as-field.vue";
import AsForm from "../components/as-form.vue";
import { createDefaultTypes } from "../composables/create-default-types";
import { useAsField } from "../composables/use-as-field";
import { useAsForm } from "../composables/use-as-form";
import { mountForm } from "./helpers";

// Since 0.1.177 a form reset gives the form the data it has when first
// prepared empty — `createFormData`, the preparation `createAsFormDef` seeds a
// form with — instead of writing `""` into every non-optional scalar field,
// which put a string into number / boolean / select / date fields (a type
// error on submit) and left added array rows and switched-on optional
// structures in place.

type Exposed = {
  reset: () => Promise<void>;
  submit: () => void;
  isDirty: boolean;
  changes: readonly unknown[];
  getPatch: () => Record<string, unknown>;
};

type Wrapper = ReturnType<typeof mountForm>["wrapper"];

async function load() {
  const { ResetForm } = await import("./fixtures/reset-forms.as");
  return ResetForm;
}

/** The error a field displays (`""` when none — the footer row is then not rendered). */
function errorOf(wrapper: Wrapper, label: string): string {
  const field = wrapper.findAll(".as-default-field").find(
    (f) =>
      f
        .find(".as-field-label")
        .text()
        .replace(/\s*\*$/, "") === label,
  );
  if (!field) throw new Error(`no field labelled ${label}`);
  const slot = field.find(".as-error-slot");
  return slot.exists() ? slot.text() : "";
}

/** Switch the form's union to the variant labelled `label` through its picker. */
async function pickVariant(
  wrapper: { find: Wrapper["find"]; findAll: Wrapper["findAll"] },
  label: string,
) {
  await wrapper.find(".as-variant-trigger").trigger("click");
  await nextTick();
  const item = wrapper.findAll(".as-dropdown-item").find((b) => b.text().includes(label));
  await item!.trigger("click");
  await nextTick();
}

/** Edit every kind of field the way a user would end up: values typed, rows added, optional parts switched on. */
async function editEverything(wrapper: Wrapper, formData: { value: Record<string, any> }) {
  await wrapper.find<HTMLInputElement>('input[name="count"]').setValue("7");

  // Two rows added with the array's own button.
  const add = wrapper.find(".as-array-add-btn");
  await add.trigger("click");
  await add.trigger("click");

  // The optional union switched on through its placeholder (Phone variant).
  const contact = wrapper.findAll(".as-object-empty-add").find((b) => b.text().includes("Contact"));
  await contact!.trigger("click");
  await nextTick();
  const phone = wrapper.findAll(".as-dropdown-item").find((b) => b.text().includes("Phone"));
  await phone!.trigger("click");
  await nextTick();

  Object.assign(formData.value, {
    active: true,
    status: "done",
    priority: "high",
    due: "2026-11-21",
    title: "Changed",
    optCount: 3,
    optActive: false,
    optStatus: "done",
    optDue: "2026-12-01",
    optTitle: "Set",
    name: "Renamed",
    seats: 9,
    greeting: "Hi",
    address: { street: "Main St", zip: 12345 },
    extra: { note: "On" },
    point: [1, 2],
  });
  formData.value.contact.phone = "+1 555";
  formData.value.lines[0].sku = "A-1";
  await nextTick();
}

describe("form reset (since 0.1.177)", () => {
  it("returns every field to the value a freshly prepared empty form holds, and the form is clean", async () => {
    const ResetForm = await load();
    const prepared = createFormData(ResetForm).value;
    const { wrapper, formData } = mountForm(ResetForm, { trackChanges: true });
    const vm = wrapper.vm as unknown as Exposed;
    await nextTick();
    expect(toRaw(formData.value)).toStrictEqual(prepared);

    await editEverything(wrapper, formData);
    expect(formData.value.lines).toHaveLength(2);
    expect(formData.value.contact).toEqual({ phone: "+1 555" });
    expect(vm.isDirty).toBe(true);

    await vm.reset();

    // Annotation defaults are back, optional fields (and the switched-on
    // optional object / union) are absent again, added rows are gone.
    expect(toRaw(formData.value)).toStrictEqual(prepared);
    expect(formData.value).toMatchObject({ name: "Untitled", seats: 4, greeting: "Hello" });
    expect("optCount" in formData.value).toBe(false);
    expect("extra" in formData.value).toBe(false);
    expect("contact" in formData.value).toBe(false);
    expect(formData.value.lines).toEqual([]);

    expect(vm.isDirty).toBe(false);
    expect(vm.changes).toEqual([]);
    expect(vm.getPatch()).toEqual({});

    // The rendered form follows: no row editors, the union is back to its "Add" placeholder.
    expect(wrapper.findAll('input[name="sku"]')).toHaveLength(0);
    expect(wrapper.findAll(".as-object-empty-add").some((b) => b.text().includes("Contact"))).toBe(
      true,
    );
  });

  it("a required number holds 0 after reset, never an empty string — the reset form passes validation", async () => {
    const ResetForm = await load();
    const { wrapper, formData } = mountForm(ResetForm, { trackChanges: true });
    const vm = wrapper.vm as unknown as Exposed;
    await wrapper.find<HTMLInputElement>('input[name="count"]').setValue("42");
    expect(formData.value.count).toBe(42);

    await vm.reset();

    expect(formData.value.count).toBe(0);
    expect(formData.value.active).toBe(false);
    expect(formData.value.status).toBe("draft");
    expect(ResetForm.validator().validate(formData.value, true)).toBe(true);
  });

  it("clears the errors and touched state of the edited fields", async () => {
    const ResetForm = await load();
    const { wrapper } = mountForm(ResetForm);
    const vm = wrapper.vm as unknown as Exposed;
    await wrapper.find<HTMLInputElement>('input[name="count"]').setValue("500");
    await nextTick();
    expect(errorOf(wrapper, "Count")).not.toBe("");

    await vm.reset();
    await nextTick();
    expect(errorOf(wrapper, "Count")).toBe("");

    // A later submit validates the reset data — no stale error comes back.
    vm.submit();
    await nextTick();
    expect(wrapper.findAll(".as-error-slot").filter((e) => e.text() !== "")).toHaveLength(0);
  });

  // `reset()` restores the type defaults (docs/forms/validation.md), not the
  // loaded record: an edit form loaded from a stored row resets to an empty
  // form, the same as a create form.
  it("on an edit form loaded from a record, reset goes to the empty form, not back to the record", async () => {
    const ResetForm = await load();
    const record = {
      count: 12,
      active: true,
      status: "done",
      priority: "low",
      due: "2026-01-02",
      title: "Stored",
      optTitle: "Stored too",
      name: "Stored name",
      seats: 2,
      address: { street: "Old St", zip: 1 },
      lines: [{ sku: "S-1", qty: 1 }],
      point: [5, 6],
      contact: { email: "a@b.c" },
    };
    const { wrapper, formData } = mountForm(ResetForm, {
      initialValue: structuredClone(record),
      trackChanges: true,
      defOptions: { mode: "edit" },
    });
    const vm = wrapper.vm as unknown as Exposed;
    formData.value.title = "Edited";
    await nextTick();
    expect(vm.isDirty).toBe(true);

    await vm.reset();

    expect(toRaw(formData.value)).toStrictEqual(createFormData(ResetForm).value);
    expect(formData.value.title).not.toBe(record.title);
    expect(vm.isDirty).toBe(false);
    expect(vm.getPatch()).toEqual({});
  });

  it("dismisses the server error of a field the reset changes, as an edit would", async () => {
    const ResetForm = await load();
    const { wrapper } = mountForm(ResetForm, {
      initialValue: { ...createFormData(ResetForm).value, count: 5 },
      errors: { count: "Count is taken" },
    });
    const vm = wrapper.vm as unknown as Exposed;
    expect(errorOf(wrapper, "Count")).toBe("Count is taken");

    await vm.reset();
    await nextTick();
    expect(errorOf(wrapper, "Count")).toBe("");
  });

  it("a field registered with an explicit resetValue gets it after the form's data reset", async () => {
    const ResetForm = await load();
    const outside = ref("typed");
    const Probe = defineComponent({
      setup() {
        useAsField({
          getValue: () => outside.value,
          setValue: (v: string) => {
            outside.value = v;
          },
          path: () => "probe",
          resetValue: "fresh",
        });
        return () => h("span");
      },
    });
    const { wrapper, formData } = mountForm(ResetForm, { slot: () => h(Probe) });
    formData.value.title = "Changed";
    await nextTick();

    await (wrapper.vm as unknown as Exposed).reset();
    expect(outside.value).toBe("fresh");
    expect(formData.value.title).toBe("");
  });

  // An app may bind the form to an inline container, `:form-data="{ value: row }"`
  // — a new plain object on every render of the parent. The reset must land in
  // the row itself: a new data object there would not be reactive, and the
  // parent's next render would bring the old row back.
  it("resets the bound data object in place, so an inline `{ value: row }` container keeps the reset", async () => {
    const ResetForm = await load();
    const def = createFormDef(ResetForm);
    const types = createDefaultTypes();
    const row = reactive({
      ...createFormData(ResetForm).value,
      title: "Stored",
      count: 5,
      lines: [{ sku: "S-1", qty: 1 }],
    });
    const renders = ref(0);
    const formRef = ref<Exposed>();
    const Parent = defineComponent({
      setup() {
        return () => {
          void renders.value;
          return h(AsForm as any, {
            ref: formRef,
            def,
            formData: { value: row },
            types,
            trackChanges: true,
          });
        };
      },
    });
    const wrapper = mount(Parent);
    const vm = formRef.value!;
    expect(wrapper.findAll('input[name="sku"]')).toHaveLength(1);

    await vm.reset();

    expect(toRaw(row)).toStrictEqual(createFormData(ResetForm).value);
    expect(wrapper.findAll('input[name="sku"]')).toHaveLength(0);
    expect(vm.isDirty).toBe(false);
    expect(vm.getPatch()).toEqual({});

    renders.value++;
    await nextTick();
    expect(row.title).toBe("");
    expect(wrapper.findAll('input[name="sku"]')).toHaveLength(0);
  });

  // The old per-field reset only touched the form's fields; the version column
  // and navigation rows are not fields. Resetting the version would turn the
  // next save's `$cas` into `{ version: 0 }` — a version mismatch.
  it("leaves what the form does not render as it is: the version column, navigation rows, other keys", async () => {
    const { ResetStoredRow } = await import("./fixtures/reset-forms.as");
    const stored = { name: "Stored", version: 3, children: [{ title: "c" }], note: "kept" };
    const { wrapper, formData, def } = mountForm(ResetStoredRow, {
      initialValue: structuredClone(stored),
      trackChanges: true,
      defOptions: { mode: "edit" },
    });
    expect(def.fields.map((f) => f.path)).toEqual(["name"]);
    const vm = wrapper.vm as unknown as Exposed;
    formData.value.name = "Edited";
    await nextTick();

    await vm.reset();

    expect(toRaw(formData.value)).toStrictEqual({ ...stored, name: "" });
    expect(vm.isDirty).toBe(false);
    formData.value.name = "New";
    await nextTick();
    expect(vm.getPatch()).toEqual({ name: "New", $cas: { version: 3 } });
  });

  // A field's `resetValue` is written by the fields of the RESET form only: the
  // fields of a removed array row or a switched-off optional object writing
  // theirs would re-create the row / the object.
  it("a resetValue inside a removed array row or optional object does not bring it back", async () => {
    const { ResetCustomForm } = await import("./fixtures/reset-forms.as");
    const Resetting = defineComponent({
      inheritAttrs: false,
      props: { model: { type: Object, required: true }, path: { type: String, required: true } },
      setup(props) {
        const model = props.model as { value: unknown };
        useAsField({
          getValue: () => model.value,
          setValue: (v) => {
            model.value = v;
          },
          path: () => props.path,
          resetValue: "",
        });
        return () => h("input", { class: "resetting", value: model.value });
      },
    });
    const { wrapper, formData } = mountForm(ResetCustomForm, {
      trackChanges: true,
      components: { resetting: Resetting },
    });
    const vm = wrapper.vm as unknown as Exposed;
    formData.value.lines.push({ sku: "A" }, { sku: "B" });
    formData.value.extra = { note: "On" };
    await nextTick();
    expect(wrapper.findAll("input.resetting")).toHaveLength(3);

    await vm.reset();

    expect(toRaw(formData.value)).toStrictEqual({ lines: [] });
    expect(wrapper.findAll("input.resetting")).toHaveLength(0);
    expect(vm.isDirty).toBe(false);
  });

  it("a custom root built on useAsForm that binds remountKey shows the reset union variant", async () => {
    const { RequiredObjectUnionForm } = await import("./fixtures/union-forms.as");
    const def = createFormDef(RequiredObjectUnionForm);
    const formData = reactive(createFormData(RequiredObjectUnionForm)) as {
      value: Record<string, any>;
    };
    let form!: ReturnType<typeof useAsForm>;
    const Root = defineComponent({
      setup() {
        form = useAsForm({ def: () => def, formData: () => formData, types: createDefaultTypes });
        return () => h(AsField, { key: form.remountKey.value, field: def.rootField });
      },
    });
    const wrapper = mount(Root);
    await pickVariant(wrapper, "Phone");
    expect(wrapper.find('input[name="phone"]').exists()).toBe(true);

    await form.reset();

    expect("email" in formData.value.primaryContact).toBe(true);
    expect(wrapper.find('input[name="email"]').exists()).toBe(true);
    expect(wrapper.find('input[name="phone"]').exists()).toBe(false);
  });

  // "Discard changes" on an edit form = assign a fresh copy of the loaded row.
  // The variant picker detects its variant once, at mount: a swap that lands
  // another variant must remount the fields, or the picker shows the old one.
  it("swapping in a fresh copy of the loaded row brings a switched union back to its stored variant", async () => {
    const { RequiredObjectUnionForm } = await import("./fixtures/union-forms.as");
    const stored = { primaryContact: { email: "a@b.c" } };
    const { wrapper, formData } = mountForm(RequiredObjectUnionForm, {
      initialValue: structuredClone(stored),
      trackChanges: true,
    });
    const vm = wrapper.vm as unknown as Exposed;
    await pickVariant(wrapper, "Phone");
    formData.value.primaryContact.phone = "+1 555";
    await nextTick();
    expect(vm.isDirty).toBe(true);

    formData.value = structuredClone(stored);
    await nextTick();

    expect(vm.isDirty).toBe(false);
    expect(wrapper.find('input[name="email"]').exists()).toBe(true);
    expect(wrapper.find('input[name="phone"]').exists()).toBe(false);
  });
});
