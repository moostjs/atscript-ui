import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AsPasswordRules from "../components/as-password-rules.vue";

type Policy = { rule: string; description?: string; errorMessage?: string };

function baseProps(overrides: Record<string, unknown> = {}) {
  // Display-only component: `model` is unused, but `TAsComponentProps`
  // requires it. Mirror the AsConsentArray test shape so the prop surface
  // stays consistent across sibling aooth components.
  return {
    onBlur: () => {},
    model: { value: undefined },
    type: "password-rules",
    path: "passwordRules",
    inputId: "pwrules-input",
    errorId: "pwrules-input-err",
    descId: "pwrules-input-desc",
    ...overrides,
  };
}

describe("AsPasswordRules", () => {
  it("renders one row per policy", () => {
    // WHY: the contract is one visible row per backend-supplied policy.
    // A mismatch silently hides rules from the user, so they can't tell
    // why their password is being rejected.
    const policies: Policy[] = [
      { rule: "(p) => p.length >= 8", description: "Minimum length 8" },
      { rule: "(p) => /\\d/.test(p)", description: "At least one digit" },
      { rule: "(p) => /[A-Z]/.test(p)", description: "At least one uppercase letter" },
    ];
    const wrapper = mount(AsPasswordRules, {
      props: baseProps({ policies, password: "" }),
    });
    const rows = wrapper.findAll(".as-password-rules-row");
    expect(rows).toHaveLength(policies.length);
    expect(rows.map((r) => r.text())).toEqual([
      "Minimum length 8",
      "At least one digit",
      "At least one uppercase letter",
    ]);
  });

  it("marks a rule as passed when the password matches", () => {
    // WHY: the FNPool deserialize-and-call IS the entire component. If
    // it's broken, EVERY render is wrong and users get no feedback.
    const policies: Policy[] = [{ rule: "(p) => p.length >= 8", description: "Minimum length 8" }];
    const wrapper = mount(AsPasswordRules, {
      props: baseProps({ policies, password: "abcdefgh" }),
    });
    const row = wrapper.find(".as-password-rules-row");
    expect(row.attributes("data-passed")).toBe("true");
  });

  it("marks a rule as unmet when the password is shorter than the minimum", () => {
    // WHY: symmetry with "passes when matches" — a stuck-on-true
    // implementation would pass both tests if we didn't also assert
    // the false branch.
    const policies: Policy[] = [{ rule: "(p) => p.length >= 8", description: "Minimum length 8" }];
    const wrapper = mount(AsPasswordRules, {
      props: baseProps({ policies, password: "abc" }),
    });
    const row = wrapper.find(".as-password-rules-row");
    expect(row.attributes("data-passed")).toBe("false");
  });

  it("marks ALL rules as unmet when the password is empty", () => {
    // WHY: empty password is the user's starting state. Even a trivially
    // truthy rule (`() => true`) must read as unmet, otherwise we mislead
    // the user into thinking they've already satisfied requirements they
    // haven't typed anything against.
    const policies: Policy[] = [
      { rule: "() => true", description: "Always true rule" },
      { rule: "(p) => p.length >= 8", description: "Minimum length 8" },
    ];
    const wrapper = mount(AsPasswordRules, {
      props: baseProps({ policies, password: "" }),
    });
    const rows = wrapper.findAll(".as-password-rules-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].attributes("data-passed")).toBe("false");
    expect(rows[1].attributes("data-passed")).toBe("false");
  });

  it("renders nothing when policies is an empty array", () => {
    // WHY: zero-policy is a real state on a freshly-loaded form before the
    // server has populated the workflow context. Rendering any placeholder
    // (label, border, dashed empty box) reserves layout space and reads as
    // a broken/empty field; rendering nothing keeps the form clean until
    // real rules arrive. Asserting the root `as-password-rules` class is
    // absent proves the entire `AsFieldShell` (chrome + label + slot) was
    // skipped, not just the inner list.
    const wrapper = mount(AsPasswordRules, {
      props: baseProps({ policies: [], password: "" }),
    });
    expect(wrapper.find(".as-password-rules").exists()).toBe(false);
    expect(wrapper.find(".as-password-rules-list").exists()).toBe(false);
  });

  it("renders nothing when policies is undefined", () => {
    // WHY: defensive against transient renders before `@ui.form.fn.attr`
    // resolves its sibling/context read. The component must not crash on
    // `policies = undefined` AND must not flash an empty shell. Distinct
    // from the empty-array case because the input path is different
    // (`?? []` fallback vs. preserved empty array).
    const wrapper = mount(AsPasswordRules, {
      props: baseProps({ password: "" }),
    });
    expect(wrapper.find(".as-password-rules").exists()).toBe(false);
    expect(wrapper.find(".as-password-rules-list").exists()).toBe(false);
  });
});
