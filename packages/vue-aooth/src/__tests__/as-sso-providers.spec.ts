import { mount } from "@vue/test-utils";
import { defineComponent, h, reactive } from "vue";
import { describe, expect, it, vi } from "vitest";
import AsSsoProviders from "../components/as-sso-providers.vue";

type Provider = { id: string; text: string; icon?: string; secondary?: boolean };

// Mirror the AsConsentArray harness: a passthrough parent that forwards a
// reactive `childProps` object so v-model-style writes (`props.model.value =
// X`) trigger a re-render — the framework wraps the model in a reactive proxy
// upstream (as-field.vue § slotModel). The SSO field has no `useAsField`
// validation wiring, so no FORM_*_KEY provides are needed for these tests.
function mountInForm(props: Record<string, unknown>) {
  const Parent = defineComponent({
    props: { childProps: { type: Object, required: true } },
    setup(p) {
      return () => h(AsSsoProviders, p.childProps as Record<string, unknown>);
    },
  });
  return mount(Parent, { props: { childProps: props } });
}

function baseProps(overrides: Record<string, unknown> = {}) {
  // `model` reactive so model writes re-render — see mountInForm note.
  const model = reactive({ value: undefined as string | undefined });
  return {
    onBlur: vi.fn(),
    model,
    type: "radio",
    path: "ssoProvider",
    inputId: "sso-input",
    errorId: "sso-input-err",
    descId: "sso-input-desc",
    ...overrides,
  };
}

const sampleProviders: Provider[] = [
  { id: "google", text: "Continue with Google", icon: "i-logos-google-icon" }, // main stack (default)
  { id: "apple", text: "Continue with Apple", icon: "i-logos-apple" }, // main stack (default)
  { id: "discord", text: "Discord", icon: "i-logos-discord-icon", secondary: true },
  { id: "github", text: "GitHub", secondary: true }, // secondary, no icon
];

describe("AsSsoProviders", () => {
  it("renders one button per provider, split into main stack and secondary group", () => {
    // WHY: the partition by `secondary` is the component's core contract —
    // providers default to the main stack, only `secondary: true` drops below
    // the divider. A mis-split would render a provider in the wrong visual
    // group (a full-width CTA where a chip belongs, or vice versa). We also
    // assert the `text` is rendered VERBATIM (no "Continue with {name}").
    const wrapper = mountInForm(baseProps({ providers: sampleProviders }));

    const primaryBtns = wrapper.findAll(".as-sso-providers-primary .as-sso-provider-btn");
    const secondaryBtns = wrapper.findAll(".as-sso-providers-secondary .as-sso-provider-chip");

    expect(primaryBtns).toHaveLength(2);
    expect(secondaryBtns).toHaveLength(2);

    expect(primaryBtns.map((b) => b.text())).toEqual([
      "Continue with Google",
      "Continue with Apple",
    ]);
    expect(secondaryBtns.map((b) => b.text())).toEqual(["Discord", "GitHub"]);
  });

  it('renders the "or" divider only when both main and secondary exist', () => {
    // WHY: the divider is purely a separator between the two groups. A lone
    // group with a dangling divider reads as broken UI. Test all three
    // shapes: all-main (default), all-secondary, and mixed.
    const allMain = mountInForm(
      baseProps({ providers: [{ id: "google", text: "Continue with Google" }] }),
    );
    expect(allMain.find(".as-sso-providers-divider").exists()).toBe(false);

    const allSecondary = mountInForm(
      baseProps({ providers: [{ id: "discord", text: "Discord", secondary: true }] }),
    );
    expect(allSecondary.find(".as-sso-providers-divider").exists()).toBe(false);

    const mixed = mountInForm(baseProps({ providers: sampleProviders }));
    expect(mixed.find(".as-sso-providers-divider").exists()).toBe(true);
  });

  it("hides the whole component when providers is empty", () => {
    // WHY: same hide-when-empty contract as AsConsentArray — a persistent
    // empty shell with no providers reads as broken / unfinished.
    const wrapper = mountInForm(baseProps({ providers: [] }));
    expect(wrapper.find(".as-sso-providers").exists()).toBe(false);
    expect(wrapper.findAll("button")).toHaveLength(0);
  });

  it("hides the whole component when providers is undefined", () => {
    // WHY: defensive against the transient render before `@ui.form.fn.attr`
    // resolves on first mount — same intent as the empty-array case.
    const wrapper = mountInForm(baseProps());
    expect(wrapper.find(".as-sso-providers").exists()).toBe(false);
    expect(wrapper.findAll("button")).toHaveLength(0);
  });

  it("clicking a provider writes its id to the bound model", async () => {
    // WHY: the click IS the selection mechanism. If it doesn't propagate
    // through `model.value`, the data-carrying action submits without the
    // chosen provider and the workflow can't know where to redirect.
    const props = baseProps({ providers: sampleProviders });
    const wrapper = mountInForm(props);

    await wrapper.find(".as-sso-providers-primary .as-sso-provider-btn").trigger("click");
    expect((props.model as { value: string | undefined }).value).toBe("google");

    // A secondary chip must commit its id the same way.
    await wrapper.find(".as-sso-providers-secondary .as-sso-provider-chip").trigger("click");
    expect((props.model as { value: string | undefined }).value).toBe("discord");
  });

  it("clicking a provider emits the form action with the action id", async () => {
    // WHY: one-click must FIRE the `sso` action, not merely select. Mount the
    // component directly (not through the passthrough parent) so `.emitted()`
    // reads the component's own events.
    const model = reactive({ value: undefined as string | undefined });
    const wrapper = mount(AsSsoProviders, {
      props: {
        ...baseProps({ model, providers: sampleProviders }),
        formAction: { id: "sso", label: "Continue" },
      },
    });

    await wrapper.find(".as-sso-provider-btn").trigger("click");

    // Selected AND fired the action.
    expect(model.value).toBe("google");
    expect(wrapper.emitted("action")).toBeTruthy();
    expect(wrapper.emitted("action")?.[0]).toEqual(["sso"]);
  });

  it("clicking a provider with no formAction still selects but does not emit", async () => {
    // WHY: without a wired action there's nothing to fire — selection must
    // still commit, but we must never emit an `action` with an undefined id.
    const model = reactive({ value: undefined as string | undefined });
    const wrapper = mount(AsSsoProviders, {
      props: baseProps({ model, providers: sampleProviders }),
    });

    await wrapper.find(".as-sso-provider-btn").trigger("click");

    expect(model.value).toBe("google");
    expect(wrapper.emitted("action")).toBeUndefined();
  });

  it("does not render the shell footer action link (provider buttons ARE the action)", () => {
    // WHY: the field declares `@ui.form.action 'sso', 'Continue'`, so
    // AsFieldShell would render a redundant `as-field-action-link` "Continue"
    // footer button. Clicking it would fire the action with NO provider
    // selected — the provider buttons already auto-issue the action on click.
    // The component suppresses the footer via `:form-action="undefined"`; this
    // guards that the redundant control never reappears.
    const wrapper = mountInForm(
      baseProps({
        providers: sampleProviders,
        formAction: { id: "sso", label: "Continue" },
      }),
    );

    expect(wrapper.find(".as-field-action-link").exists()).toBe(false);
  });

  it("wraps all provider groups in a single stack container", () => {
    // WHY: AsFieldShell renders the default slot inside `as-field-input-row`, a
    // flex ROW. The primary stack, "or" divider, and secondary group must be a
    // SINGLE flex-column child (`as-sso-providers-stack`) — otherwise they lay
    // out side-by-side in the row (the layout regression). Assert the stack
    // exists and owns both populated groups.
    const wrapper = mountInForm(baseProps({ providers: sampleProviders }));

    expect(wrapper.find(".as-sso-providers-stack").exists()).toBe(true);
    expect(wrapper.find(".as-sso-providers-stack .as-sso-providers-primary").exists()).toBe(true);
    expect(wrapper.find(".as-sso-providers-stack .as-sso-providers-secondary").exists()).toBe(true);
  });

  it("renders the provider icon class when present and omits the span when absent", () => {
    // WHY: icon is optional. A stray empty span (or a missing class) would
    // mean broken / inconsistent branding. The secondary group has one
    // provider with an icon (discord) and one without (github).
    const wrapper = mountInForm(baseProps({ providers: sampleProviders }));

    // Primary "google" carries its brand glyph as a raw class on the span.
    const googleIcon = wrapper.find(
      ".as-sso-providers-primary .as-sso-provider-btn .i-logos-google-icon",
    );
    expect(googleIcon.exists()).toBe(true);
    expect(googleIcon.classes()).toContain("as-sso-provider-icon");

    // Secondary group: exactly one icon span (discord), github has none.
    const secondaryIcons = wrapper.findAll(".as-sso-providers-secondary .as-sso-provider-icon");
    expect(secondaryIcons).toHaveLength(1);
    expect(secondaryIcons[0].classes()).toContain("i-logos-discord-icon");
  });
});
