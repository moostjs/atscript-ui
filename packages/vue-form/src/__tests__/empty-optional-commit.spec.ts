import { describe, it, expect, vi } from "vitest";
import { nextTick } from "vue";
import { mountForm } from "./helpers";

// atscript 0.1.103: `null` on an optional `@meta.required` field is rejected
// ("Must not be empty"). Emptied inputs on optional fields therefore commit
// `undefined` (the field is omitted), like the optional toggle does; on a
// required field they keep committing `null`.

async function mountEmptied() {
  const { EmptiedInputs } = await import("./fixtures/field-annotations.as");
  const mounted = mountForm(EmptiedInputs, {
    initialValue: { due: "2026-10-09", start: "2026-10-01", qty: 3 },
  });
  await nextTick();
  return { ...mounted, EmptiedInputs };
}

type Wrapper = ReturnType<typeof mountForm>["wrapper"];

function control(wrapper: Wrapper, name: string) {
  const el = wrapper
    .findAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
    .find((i) => i.attributes("name") === name);
  if (!el) throw new Error(`no control named ${name}`);
  return el;
}

/** The user empties the control and leaves it. */
async function empty(wrapper: Wrapper, name: string) {
  const el = control(wrapper, name);
  await el.setValue("");
  await el.trigger("blur");
  await nextTick();
}

describe("emptied inputs", () => {
  it("an optional date commits undefined and passes @meta.required validation", async () => {
    const { wrapper, formData, EmptiedInputs } = await mountEmptied();
    const due = control(wrapper, "due");
    await due.setValue("");
    await due.trigger("change");
    await due.trigger("blur");
    await nextTick();

    expect("due" in formData.value && formData.value.due !== undefined).toBe(false);
    expect(EmptiedInputs.validator().validate(formData.value, true)).toBe(true);
  });

  it("an optional number commits undefined; a required date keeps null", async () => {
    const { wrapper, formData } = await mountEmptied();
    const qty = wrapper.find<HTMLInputElement>(".as-number-input");
    await qty.setValue("");
    await qty.trigger("blur");
    const start = control(wrapper, "start");
    await start.setValue("");
    await start.trigger("change");
    await start.trigger("blur");
    await nextTick();

    expect(formData.value.qty).toBeUndefined();
    expect(formData.value.start).toBeNull();
  });
});

// Since 0.1.176 the default text input follows the same rule: emptied on an
// optional field it commits `undefined`; on a required field it keeps `""`.
// The plain number input (AsNumber without adornments) shares the text control
// and commits like the other number inputs (`null` on a required field).

type PatchSurface = {
  isDirty: boolean;
  getPatch: () => Record<string, unknown>;
};

async function mountEmptiedText() {
  const { EmptiedTextInputs } = await import("./fixtures/field-annotations.as");
  const mounted = mountForm(EmptiedTextInputs, {
    initialValue: {
      nickname: "abc",
      bio: "Hello there",
      secret: "pw-123",
      title: "Lead",
      count: 3,
      total: 5,
    },
  });
  await nextTick();
  return { ...mounted, EmptiedTextInputs };
}

describe("emptied text inputs (since 0.1.176)", () => {
  it("optional text, textarea and password commit undefined; a required text keeps an empty string", async () => {
    const { wrapper, formData } = await mountEmptiedText();
    expect(control(wrapper, "bio").element.tagName).toBe("TEXTAREA");
    expect(control(wrapper, "secret").attributes("type")).toBe("password");

    for (const name of ["nickname", "bio", "secret", "title"]) await empty(wrapper, name);

    expect(formData.value.nickname).toBeUndefined();
    expect(formData.value.bio).toBeUndefined();
    expect(formData.value.secret).toBeUndefined();
    expect(formData.value.title).toBe("");
  });

  it("an emptied optional field is unset for the validator: @meta.required and minLength pass", async () => {
    const { wrapper, formData, EmptiedTextInputs } = await mountEmptiedText();
    const validator = EmptiedTextInputs.validator();

    // Before 0.1.176 the field held "" and both checks ran against it.
    expect(validator.validate({ ...formData.value, nickname: "" }, true)).toBe(false);

    await empty(wrapper, "nickname");
    expect(formData.value.nickname).toBeUndefined();
    expect(validator.validate(formData.value, true)).toBe(true);
  });

  it("the plain number input commits undefined on an optional field and null on a required one", async () => {
    const { wrapper, formData } = await mountEmptiedText();
    expect(control(wrapper, "count").attributes("type")).toBe("number");

    await empty(wrapper, "count");
    await empty(wrapper, "total");

    expect(formData.value.count).toBeUndefined();
    expect(formData.value.total).toBeNull();
  });

  it("typing keeps committing the text; an emptied field typed into again holds the new text", async () => {
    const { wrapper, formData } = await mountEmptiedText();
    const nickname = control(wrapper, "nickname");
    await nickname.trigger("focusin");
    await nickname.setValue("abcd");
    expect(formData.value.nickname).toBe("abcd");
    await nickname.setValue("");
    expect(formData.value.nickname).toBeUndefined();
    await nickname.setValue("z");
    expect(formData.value.nickname).toBe("z");
  });

  it("the emptied input stays while focus is in it; the placeholder shows once focus leaves", async () => {
    const { wrapper, formData } = await mountEmptiedText();
    const nickname = control(wrapper, "nickname");
    // The shell root stays mounted while its input row swaps for the placeholder.
    const field = wrapper
      .findAll(".as-default-field")
      .find((f) => f.find("[name='nickname']").exists())!;

    await nickname.trigger("focusin");
    await nickname.setValue("");
    await nextTick();
    expect(formData.value.nickname).toBeUndefined();
    expect(field.find("[name='nickname']").exists()).toBe(true);
    expect(field.find(".as-no-data").exists()).toBe(false);
    expect(nickname.element.value).toBe("");

    await nickname.trigger("focusout");
    await nextTick();
    expect(field.find("[name='nickname']").exists()).toBe(false);
    expect(field.find(".as-no-data").exists()).toBe(true);
  });
});

/** A keyed-array row of `PatchEmptiedTextForm`, with or without its optional `note`. */
function row(note?: string) {
  return { sku: "A", qty: 1, ...(note === undefined ? {} : { note }) };
}

describe("emptied text inputs — change tracking (since 0.1.176)", () => {
  async function mountTracked(initialValue: Record<string, unknown>) {
    const { PatchEmptiedTextForm } = await import("./fixtures/patch-forms.as");
    const mounted = mountForm(PatchEmptiedTextForm, { initialValue, trackChanges: true });
    await nextTick();
    return { ...mounted, vm: mounted.wrapper.vm as unknown as PatchSurface };
  }

  it("baseline unset → enable, type, delete everything → not dirty, no patch entry", async () => {
    const { wrapper, formData, vm } = await mountTracked({
      name: "Order",
      contact: { email: "a@b.c" },
      items: [row()],
    });
    // `remark` is declared first: its "Not set" placeholder is the first one.
    await wrapper.find(".as-no-data").trigger("click");
    await nextTick();

    const remark = control(wrapper, "remark");
    await remark.setValue("call first");
    expect(vm.getPatch()).toEqual({ remark: "call first" });
    await remark.setValue("");
    await nextTick();

    expect(formData.value.remark).toBeUndefined();
    expect(vm.isDirty).toBe(false);
    expect(vm.getPatch()).toEqual({});
  });

  it("a baseline value cleared → null at the top level, in a nested object and gone from a keyed row", async () => {
    const { wrapper, vm } = await mountTracked({
      name: "Order",
      remark: "call first",
      contact: { email: "a@b.c", phone: "555" },
      items: [row("gift"), { sku: "B", qty: 2 }],
    });

    await empty(wrapper, "remark");
    await empty(wrapper, "phone");
    await empty(wrapper, "note"); // items[0].note

    // Default (replace) strategy on `items`: the whole row, the cleared
    // optional prop left out — never sent as "".
    expect(vm.getPatch()).toStrictEqual({
      remark: null,
      contact: { phone: null },
      items: { $update: [row()] },
    });
  });

  it("an unset optional prop of a keyed row: enable, type, empty → no $update", async () => {
    const { wrapper, vm } = await mountTracked({
      name: "Order",
      remark: "call first",
      contact: { email: "a@b.c", phone: "555" },
      items: [row()],
    });
    // The row's `note` is the only unset optional field on screen.
    await wrapper.find(".as-no-data").trigger("click");
    await nextTick();

    const note = control(wrapper, "note");
    await note.setValue("gift");
    expect(vm.getPatch()).toStrictEqual({ items: { $update: [row("gift")] } });
    await note.setValue("");
    await nextTick();

    expect(vm.isDirty).toBe(false);
    expect(vm.getPatch()).toEqual({});
  });
});

// ── The held editor (since 0.1.176) ──────────────────────────
// An emptied optional field is unset at once, but the editor and its chrome
// stay while focus is in the input row; the placeholder shows once it leaves.

/** Focus leaves for another element of the page: `<body>` is active during `focusout`. */
async function leave(el: { element: Element }) {
  (document.activeElement as HTMLElement | null)?.blur?.();
  el.element.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
  await nextTick();
}

describe("the held editor (since 0.1.176)", () => {
  it("an optional union's text variant emptied while focused stays; the union collapses once focus leaves", async () => {
    const { OptionalPrimitiveUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper, formData } = mountForm(OptionalPrimitiveUnionForm, {
      initialValue: { reference: "INV-1" },
    });
    await nextTick();
    const input = wrapper.find<HTMLInputElement>("input[type='text']");
    await input.trigger("focusin");
    await input.setValue("");
    await nextTick();

    expect(formData.value.reference).toBeUndefined();
    expect(wrapper.find("input[type='text']").exists()).toBe(true);
    expect(wrapper.find(".as-object-empty-add").exists()).toBe(false);

    await input.setValue("INV-2");
    expect(formData.value.reference).toBe("INV-2");
    await input.setValue("");
    await leave(input);
    expect(wrapper.find("input").exists()).toBe(false);
    expect(wrapper.find(".as-object-empty-add").exists()).toBe(true);
  });

  it("an optional union's plain number variant: a partial entry the browser reports as empty keeps the variant", async () => {
    const { OptionalPrimitiveUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper, formData } = mountForm(OptionalPrimitiveUnionForm, {
      initialValue: { reference: 7 },
    });
    await nextTick();
    const input = wrapper.find<HTMLInputElement>("input[type='number']");
    await input.trigger("focusin");
    // Typing "-" into a native number input reports "".
    await input.setValue("");
    await nextTick();
    expect(formData.value.reference).toBeUndefined();
    expect(wrapper.find("input[type='number']").exists()).toBe(true);
    expect(wrapper.find(".as-object-empty-add").exists()).toBe(false);

    await input.setValue("-5");
    expect(formData.value.reference).toBe(-5);
    await input.setValue("");
    await leave(input);
    expect(wrapper.find(".as-object-empty-add").exists()).toBe(true);
  });

  it("a collapsed union picked again from its Add menu focuses the variant's input", async () => {
    const { OptionalPrimitiveUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper, formData } = mountForm(OptionalPrimitiveUnionForm, {
      initialValue: { reference: "INV-1" },
      attachTo: document.body,
    });
    await nextTick();
    const input = wrapper.find<HTMLInputElement>("input[type='text']");
    (input.element as HTMLInputElement).focus();
    await input.trigger("focusin");
    await input.setValue("");
    await leave(input);

    await wrapper.find(".as-object-empty-add").trigger("click");
    await wrapper.findAll(".as-dropdown-item")[0]!.trigger("click");
    await vi.waitFor(() => expect(document.activeElement?.tagName).toBe("INPUT"));
    expect(formData.value.reference).toBe("");
    expect(document.activeElement).toBe(wrapper.find("input[type='text']").element);
    wrapper.unmount();
  });

  it("an input row unmounted while it has focus releases the union: unset from outside, the union shows its own Add menu", async () => {
    const { OptionalObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper, formData } = mountForm(OptionalObjectUnionForm, {
      initialValue: { backupContact: { email: "a@b.c" } },
    });
    await nextTick();
    await wrapper.find("input[name='email']").trigger("focusin");

    // The object is unset while focus is in its Email row (a reset, an upstream rebase).
    formData.value.backupContact = undefined;
    await nextTick();

    // The union's placeholder with the variant menu — not the object variant's own "Add".
    expect(wrapper.find(".as-dropdown .as-object-empty-add").exists()).toBe(true);
  });

  it('the reference input\'s plain-text fallback: undefined on an optional field, "" on a required one', async () => {
    const { EmptiedRefInputs } = await import("./fixtures/field-annotations.as");
    const { wrapper, formData } = mountForm(EmptiedRefInputs, {
      initialValue: { owner: "u-1", assignee: "u-2" },
    });
    await nextTick();
    await empty(wrapper, "owner");
    await empty(wrapper, "assignee");
    expect(formData.value.owner).toBeUndefined();
    expect(formData.value.assignee).toBe("");
  });

  it("focus moving between two inputs of one row keeps the emptied field held", async () => {
    const { EmptiedDecimalInput } = await import("./fixtures/field-annotations.as");
    const { wrapper, formData } = mountForm(EmptiedDecimalInput, {
      initialValue: { fee: "12.50" },
    });
    await nextTick();
    const integer = wrapper.find(".as-decimal-integer");
    const fraction = wrapper.find(".as-decimal-decimal");
    await integer.trigger("focusin");
    formData.value.fee = undefined;
    await nextTick();

    integer.element.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, relatedTarget: fraction.element }),
    );
    await fraction.trigger("focusin");
    await nextTick();
    expect(wrapper.find(".as-decimal-decimal").exists()).toBe(true);
    expect(wrapper.find(".as-no-data").exists()).toBe(false);

    await leave(fraction);
    expect(wrapper.find(".as-no-data").exists()).toBe(true);
  });

  it("the window losing focus keeps the field held: the input stays the active element", async () => {
    const { EmptiedTextInputs } = await import("./fixtures/field-annotations.as");
    const { wrapper, formData } = mountForm(EmptiedTextInputs, {
      initialValue: { nickname: "abc", title: "Lead", total: 5 },
      attachTo: document.body,
    });
    await nextTick();
    const nickname = control(wrapper, "nickname");
    (nickname.element as HTMLInputElement).focus();
    await nickname.trigger("focusin");
    await nickname.setValue("");
    // What Chromium does on a window/app switch: `focusout` without a
    // `relatedTarget` while the input stays `document.activeElement`.
    nickname.element.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, relatedTarget: null }),
    );
    await nextTick();
    expect(document.activeElement).toBe(nickname.element);
    expect(formData.value.nickname).toBeUndefined();
    expect(wrapper.find("[name='nickname']").exists()).toBe(true);

    await leave(nickname);
    expect(wrapper.find("[name='nickname']").exists()).toBe(false);
    wrapper.unmount();
  });

  it("while held, the clear button and the dirty marker stay (no flicker typing through empty)", async () => {
    const { PatchEmptiedTextForm } = await import("./fixtures/patch-forms.as");
    const { wrapper } = mountForm(PatchEmptiedTextForm, {
      initialValue: { name: "Order", contact: { email: "a@b.c" }, items: [] },
      trackChanges: true,
    });
    await nextTick();
    await wrapper.find(".as-no-data").trigger("click"); // remark: "Not set" → ""
    await nextTick();
    const remark = control(wrapper, "remark");
    const field = wrapper
      .findAll(".as-default-field")
      .find((f) => f.find("[name='remark']").exists())!;
    await remark.trigger("focusin");
    await remark.setValue("a");
    expect(field.attributes("data-dirty")).toBe("");
    expect(field.find(".as-field-remove-btn").exists()).toBe(true);

    await remark.setValue(""); // unset → not dirty against the unset baseline
    await nextTick();
    expect(field.attributes("data-dirty")).toBe("");
    expect(field.find(".as-field-remove-btn").exists()).toBe(true);

    await leave(remark);
    expect(field.attributes("data-dirty")).toBeUndefined();
    expect(field.find(".as-no-data").exists()).toBe(true);
  });
});

describe('emptied text inputs — stored null and stored "" baselines (since 0.1.176)', () => {
  async function mountTracked(remark: unknown) {
    const { PatchEmptiedTextForm } = await import("./fixtures/patch-forms.as");
    const mounted = mountForm(PatchEmptiedTextForm, {
      initialValue: { name: "Order", remark, contact: { email: "a@b.c" }, items: [] },
      trackChanges: true,
    });
    await nextTick();
    return { ...mounted, vm: mounted.wrapper.vm as unknown as PatchSurface };
  }

  it("stored null → enable, type, empty → no change (null and undefined are both unset)", async () => {
    const { wrapper, vm } = await mountTracked(null);
    await wrapper.find(".as-no-data").trigger("click");
    await nextTick();
    const remark = control(wrapper, "remark");
    await remark.setValue("x");
    expect(vm.getPatch()).toEqual({ remark: "x" });
    await remark.setValue("");
    await nextTick();
    expect(vm.isDirty).toBe(false);
    expect(vm.getPatch()).toEqual({});
  });

  it('stored "" → type, empty → a change: the field is cleared (null)', async () => {
    const { wrapper, vm } = await mountTracked("");
    const remark = control(wrapper, "remark");
    await remark.setValue("x");
    await remark.setValue("");
    await nextTick();
    expect(vm.isDirty).toBe(true);
    expect(vm.getPatch()).toEqual({ remark: null });
  });
});
