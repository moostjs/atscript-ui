import { installDynamicResolver } from "@atscript/ui-fns";
import { beforeAll, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { NormalizedSignup } from "./fixtures/normalized-emits.as";
import { mountForm } from "./helpers";

beforeAll(() => installDynamicResolver());

const MISMATCH = "Logins must match";

describe("actions carry the data a submit sends", () => {
  // Why: an action emitted the raw form data while `@submit` emitted the
  // normalized data — a host saving on an action stored "  Ann " where a
  // submit would have sent "ann".
  it("an action button emits the normalized data; the form keeps what was typed", async () => {
    const { wrapper, formData } = mountForm(NormalizedSignup, {
      initialValue: { login: "  Ann ", repeat: "ANN" },
    });
    await wrapper.find("button.as-field-action-link").trigger("click");
    expect(wrapper.emitted("action")).toEqual([["check", { login: "ann", repeat: "ann" }]]);
    expect(formData.value.login).toBe("  Ann ");
  });

  it("the exposed action() emits the same normalized data", () => {
    const { wrapper } = mountForm(NormalizedSignup, {
      initialValue: { login: " Bob", repeat: "bob" },
    });
    (wrapper.vm as unknown as { action: (name: string) => void }).action("check");
    (wrapper.vm as unknown as { action: (name: string) => void }).action("nope");
    expect(wrapper.emitted("action")).toEqual([["check", { login: "bob", repeat: "bob" }]]);
    expect(wrapper.emitted("unsupported-action")).toEqual([
      ["nope", { login: "bob", repeat: "bob" }],
    ]);
  });
});

describe("live validation sees the data a submit validates", () => {
  // Why: a rule reading a sibling got the raw data live but the normalized
  // data on submit — "Ann " vs "ann" failed live while the submit passed.
  it("a rule reading a sibling judges the normalized sibling, live as on submit", async () => {
    const { wrapper } = mountForm(NormalizedSignup, {
      initialValue: { login: "  Ann ", repeat: "" },
    });
    const repeat = wrapper.findAll("input")[1]!;
    await repeat.setValue("ann");
    await nextTick();
    expect(wrapper.text()).not.toContain(MISMATCH);

    await repeat.setValue("bob");
    await nextTick();
    expect(wrapper.text()).toContain(MISMATCH);

    // the sibling changes: the rule re-runs on its normalized value
    await wrapper.findAll("input")[0]!.setValue(" BOB ");
    await nextTick();
    expect(wrapper.text()).not.toContain(MISMATCH);

    await wrapper.find("form").trigger("submit");
    expect(wrapper.emitted("submit")).toEqual([[{ login: "bob", repeat: "bob" }]]);
  });

  // Why: a container rule (`@ui.form.validate` on the interface) judged the raw
  // value live and the normalized one on submit.
  it("a container rule judges the normalized value live, as on submit", async () => {
    const { wrapper } = mountForm(NormalizedSignup, {
      initialValue: { login: "Admin ", repeat: "admin" },
    });
    await wrapper.find("form").trigger("submit");
    await nextTick();
    expect(wrapper.emitted("error")?.[0]?.[0]).toEqual([
      { path: "__form", message: "Reserved login" },
    ]);
    // live (after the first submit), the banner keeps judging the normalized value
    await wrapper.findAll("input")[1]!.setValue(" ADMIN");
    await nextTick();
    expect(wrapper.find('[role="alert"].as-form-error').text()).toContain("Reserved login");
  });
});
