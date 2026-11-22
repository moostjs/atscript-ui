import { afterEach, describe, expect, it } from "vitest";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { flushPromises, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { mountForm, objectType, stringProp } from "./helpers";

// Since 0.1.178 a reset keeps keyboard focus in the form: when the remount of
// the field tree removes the focused element, focus moves to the first field
// control (a checkbox or radio counts) instead of falling to `<body>`. Focus on
// anything the remount leaves in place, or outside the form, is not moved.

const mounted: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = "";
});

/** A field rendering a control that is out of the tab order. */
const OutOfTabOrder = defineComponent({
  setup: () => () => h("input", { name: "skipped", tabindex: "-1" }),
});

function mountFocusForm(
  type: TAtscriptAnnotatedType,
  opts: { attachTo?: Element; trackChanges?: boolean; initialValue?: unknown } = {},
) {
  const { wrapper, formData } = mountForm(type, {
    ...opts,
    components: { "out-of-tab-order": OutOfTabOrder },
    attachTo: opts.attachTo ?? document.body,
    // Slot content before the fields survives the remount: an input that must
    // not take focus, and a Reset button wired to the slot's `reset` — with
    // `trackChanges`, disabled while the form is clean.
    slot: ({ reset, isDirty }: { reset: () => Promise<void>; isDirty: boolean }) => [
      h("input", { name: "slot-note" }),
      h(
        "button",
        {
          type: "button",
          class: "reset-btn",
          disabled: opts.trackChanges && !isDirty,
          onClick: reset,
        },
        "Reset",
      ),
    ],
  });
  mounted.push(wrapper);
  return {
    wrapper,
    formData,
    input: (name: string) => wrapper.find<HTMLInputElement>(`input[name="${name}"]`).element,
    reset: () => (wrapper.vm as unknown as { reset: () => Promise<void> }).reset(),
  };
}

const threeFields = () =>
  objectType({ first: stringProp(), second: stringProp(), third: stringProp() });

describe("form reset keeps focus in the form (since 0.1.178)", () => {
  it("reset while a field's input has focus: the remount removes that input, focus lands on the first field's control, not on the slot input before the fields", async () => {
    const { input, reset } = mountFocusForm(threeFields());
    const focused = input("third");
    focused.focus();
    expect(document.activeElement).toBe(focused);

    await reset();

    expect(focused.isConnected).toBe(false);
    expect(document.activeElement).toBe(input("first"));
  });

  it("the reset the slots receive moves focus the same way as the template-ref reset", async () => {
    const { wrapper, input } = mountFocusForm(threeFields());
    input("second").focus();

    await wrapper.find(".reset-btn").trigger("click");
    await flushPromises();

    expect(document.activeElement).toBe(input("first"));
  });

  it("a Reset button disabled once the form is clean: focus moves to the first field instead of staying on a disabled button", async () => {
    // A loaded row: the reset values differ from the baseline, so the form
    // turns clean (and the button disabled) only when the reset re-baselines.
    const { wrapper, input } = mountFocusForm(threeFields(), {
      trackChanges: true,
      initialValue: { first: "a", second: "b", third: "c" },
    });
    const button = wrapper.find<HTMLButtonElement>(".reset-btn");
    expect(button.element.disabled).toBe(true);
    await wrapper.find('input[name="second"]').setValue("typed");
    expect(button.element.disabled).toBe(false);
    button.element.focus();

    await button.trigger("click");
    await flushPromises();

    expect(button.element.disabled).toBe(true);
    expect(input("first").value).toBe("");
    expect(document.activeElement).toBe(input("first"));
  });

  it("reset from a Reset button in a slot that holds focus and stays enabled: the button survives the remount and keeps focus", async () => {
    const { wrapper, formData, input } = mountFocusForm(threeFields());
    await wrapper.find('input[name="second"]').setValue("typed");
    const button = wrapper.find<HTMLButtonElement>(".reset-btn");
    button.element.focus();

    await button.trigger("click");
    await flushPromises();

    expect(formData.value.second).toBe("");
    expect(input("second").value).toBe("");
    expect(document.activeElement).toBe(button.element);
  });

  it("reset while focus is outside the form, or on nothing: focus is not moved into the form", async () => {
    const { reset } = mountFocusForm(threeFields());
    const outside = document.createElement("input");
    document.body.appendChild(outside);
    outside.focus();

    await reset();
    expect(document.activeElement).toBe(outside);

    outside.blur();
    expect(document.activeElement).toBe(document.body);
    await reset();
    expect(document.activeElement).toBe(document.body);
  });

  it("a disabled first control, or one with tabindex=-1, is skipped: focus lands on the next control that takes it", async () => {
    const { input, reset } = mountFocusForm(
      objectType({
        locked: stringProp({ "ui.form.disabled": true }),
        skipped: stringProp({ "ui.form.component": "out-of-tab-order" }),
        second: stringProp(),
        third: stringProp(),
      }),
    );
    expect(input("locked").disabled).toBe(true);
    expect(input("skipped").getAttribute("tabindex")).toBe("-1");
    input("third").focus();

    await reset();

    expect(document.activeElement).toBe(input("second"));
  });

  it("a checkbox as the first field is a field control: it takes focus after the reset, not the second field", async () => {
    const { ResetFocusCheckboxFirst } = await import("./fixtures/reset-focus-forms.as");
    const { input, reset } = mountFocusForm(ResetFocusCheckboxFirst);
    input("name").focus();

    await reset();

    expect(input("agree").type).toBe("checkbox");
    expect(document.activeElement).toBe(input("agree"));
  });

  it("a form of only radio and checkbox fields: the first radio takes focus after the reset instead of focus falling to <body>", async () => {
    const { ResetFocusChoicesOnly } = await import("./fixtures/reset-focus-forms.as");
    const { input, reset } = mountFocusForm(ResetFocusChoicesOnly);
    input("wrap").focus();

    await reset();

    const firstRadio = input("size");
    expect([firstRadio.type, firstRadio.value]).toEqual(["radio", "small"]);
    expect(document.activeElement).toBe(firstRadio);
  });

  it("a form rendered inside a shadow root (e.g. a Vue custom element) keeps focus the same way", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const container = document.createElement("div");
    host.attachShadow({ mode: "open" }).appendChild(container);
    const { input, reset } = mountFocusForm(threeFields(), { attachTo: container });
    input("third").focus();
    expect(host.shadowRoot!.activeElement).toBe(input("third"));

    await reset();

    expect(host.shadowRoot!.activeElement).toBe(input("first"));
  });
});
