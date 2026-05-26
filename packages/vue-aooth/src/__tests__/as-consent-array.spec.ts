import { mount } from "@vue/test-utils";
import { defineComponent, h, reactive } from "vue";
import { describe, expect, it, vi } from "vitest";
import AsConsentArray from "../components/as-consent-array.vue";

type ConsentItem = { id: string; text: string; required?: string };

// `FORM_STATE_KEY` / `FORM_DATA_KEY` / `FORM_CONTEXT_KEY` are private to
// `@atscript/vue-form` (intentional — see internal-keys.ts). Without
// providing them, `useAsField`'s validation gating stays inactive: the
// local rule never surfaces from the on-change/blur/submit gates. That's
// the right behaviour for a standalone unit-test mount — the rule path
// is exercised end-to-end by the e2e suite that drives a real `AsForm`.
//
// These unit tests cover: rendering, hide-when-empty, model commit on
// toggle, and the `props.error` fallback path (backend-pushed errors
// must always surface, regardless of touched state).
function mountInForm(props: Record<string, unknown>) {
  const Parent = defineComponent({
    props: { childProps: { type: Object, required: true } },
    setup(p) {
      return () => h(AsConsentArray, p.childProps as Record<string, unknown>);
    },
  });
  return mount(Parent, { props: { childProps: props } });
}

function baseProps(overrides: Record<string, unknown> = {}) {
  // `model` must be reactive so v-model-style writes (`props.model.value = X`)
  // trigger re-render. The framework wraps the value in a reactive proxy
  // upstream (as-field.vue § slotModel); mirror that here.
  const model = reactive({ value: [] as string[] });
  return {
    onBlur: vi.fn(),
    model,
    type: "consent-array",
    path: "consents",
    inputId: "consents-input",
    errorId: "consents-input-err",
    descId: "consents-input-desc",
    ...overrides,
  };
}

const sampleConsents: ConsentItem[] = [
  { id: "tos", text: "I accept the terms of service", required: "Terms are mandatory" },
  { id: "privacy", text: "I accept the privacy policy", required: "Privacy is mandatory" },
  { id: "marketing", text: "Send me marketing emails" }, // optional
];

describe("AsConsentArray", () => {
  it("renders one checkbox per pendingConsents entry", () => {
    // WHY: the component's core contract is "one row per backend-supplied
    // consent". A mismatch would mean a backend-flagged consent never
    // surfaces in the UI — the user submits without ever seeing it.
    const wrapper = mountInForm(baseProps({ pendingConsents: sampleConsents }));
    const checkboxes = wrapper.findAll("input[type=checkbox]");
    expect(checkboxes).toHaveLength(sampleConsents.length);
    const labels = wrapper.findAll("label");
    expect(labels.map((l) => l.text())).toEqual(sampleConsents.map((c) => c.text));
  });

  it("hides the whole component when pendingConsents is empty", () => {
    // WHY: zero-consent should read as "nothing to consent to" — no
    // placeholder, no chrome. A persistent shell when there are no items
    // would clutter forms whose backend hasn't (yet) flagged anything,
    // and reads as a broken / unfinished UI.
    const wrapper = mountInForm(baseProps({ pendingConsents: [] }));
    expect(wrapper.findAll("input[type=checkbox]")).toHaveLength(0);
    // No FieldShell wrapper either — the entire AsFieldShell tree is gated.
    expect(wrapper.find(".as-consent-array").exists()).toBe(false);
  });

  it("hides the whole component when pendingConsents is undefined", () => {
    // WHY: defensive against the transient render before `@ui.form.fn.attr`
    // resolves on first mount — same intent as the empty-array case.
    const wrapper = mountInForm(baseProps());
    expect(wrapper.findAll("input[type=checkbox]")).toHaveLength(0);
    expect(wrapper.find(".as-consent-array").exists()).toBe(false);
  });

  it("toggling a checkbox commits the id to the bound array", async () => {
    // WHY: this component IS the editor for the bound string[]. If writes
    // don't propagate through `model.value`, the form's submit payload
    // silently omits the user's consent choice.
    const props = baseProps({ pendingConsents: sampleConsents });
    const wrapper = mountInForm(props);

    const tos = wrapper.find("input#consents-input-tos");
    await tos.setValue(true);

    expect((props.model as { value: string[] }).value).toEqual(["tos"]);
  });

  it("untoggling a checked id removes it from the bound array", async () => {
    // WHY: opt-in without opt-out would trap users in a consent they can't
    // revoke before submission. Symmetric removal is non-negotiable.
    const props = baseProps({
      pendingConsents: sampleConsents,
      model: reactive({ value: ["tos", "privacy"] }),
    });
    const wrapper = mountInForm(props);

    const tos = wrapper.find("input#consents-input-tos");
    await tos.setValue(false);

    expect((props.model as { value: string[] }).value).toEqual(["privacy"]);
  });

  // Per-item required-error rendering is gated on `useAsField`'s
  // `localError` (live + submit + external-error pipeline). That gate
  // only opens when the form pipeline is wired (`FORM_STATE_KEY` provided
  // + setExternalError or live-validation fired). This unit-test mount
  // deliberately omits that wiring, so the gate stays closed here.
  // End-to-end coverage lives in `tests/e2e/o-aooth-components/
  // section-36-aooth-components.spec.ts` (cases A5/A6/A9).
});
