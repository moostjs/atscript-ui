import { installDynamicResolver } from "@atscript/ui-fns";
import { UI_FORM_VALIDATE, getFieldMeta } from "@atscript/ui";
import { beforeAll, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { AccountHost, SignupForm } from "./fixtures/form-level-validate.as";
import { mountForm } from "./helpers";

// Interface-level `@ui.form.validate`: on the form's root interface it is a
// form-level rule (the `__form` banner); used as a nested object prop it
// reports at that prop's path. Neither blocks nor duplicates field errors.

const MATCH = "Passwords must match";

const banner = (wrapper: ReturnType<typeof mountForm>["wrapper"]) =>
  wrapper.find('[role="alert"].as-form-error');

const bannerText = (wrapper: ReturnType<typeof mountForm>["wrapper"]) =>
  banner(wrapper).find(".as-form-error-message").text();

async function submit(wrapper: ReturnType<typeof mountForm>["wrapper"]) {
  await wrapper.find("form").trigger("submit");
  await nextTick();
}

describe("interface-level @ui.form.validate", () => {
  beforeAll(() => installDynamicResolver());

  it("compiles onto the interface's own metadata and a referencing prop's", () => {
    expect(getFieldMeta(SignupForm, UI_FORM_VALIDATE)).toHaveLength(1);
    const signupProp = AccountHost.type.props.get("signup")!;
    expect(getFieldMeta(signupProp, UI_FORM_VALIDATE)).toHaveLength(1);
  });

  describe("on the root interface", () => {
    it("shows the failing rule in the form-level banner on submit", async () => {
      const { wrapper } = mountForm(SignupForm, {
        initialValue: { password: "a", confirm: "b" },
      });
      expect(banner(wrapper).exists()).toBe(false);

      await submit(wrapper);
      expect(bannerText(wrapper)).toBe(MATCH);
      expect(wrapper.emitted("submit")).toBeUndefined();
      expect(wrapper.emitted("error")?.[0]?.[0]).toEqual([{ path: "__form", message: MATCH }]);
    });

    it("submits when the rule passes", async () => {
      const { wrapper } = mountForm(SignupForm, {
        initialValue: { password: "a", confirm: "a" },
      });
      await submit(wrapper);
      expect(banner(wrapper).exists()).toBe(false);
      expect(wrapper.emitted("submit")).toHaveLength(1);
    });

    it("keeps field errors on their fields, without duplicating the banner", async () => {
      const { wrapper } = mountForm(SignupForm, {
        initialValue: { password: "", confirm: "b" },
      });
      await submit(wrapper);

      expect(bannerText(wrapper)).toBe(MATCH);
      const slots = wrapper.findAll(".as-error-slot").map((s) => s.text());
      expect(slots).toEqual(["Password is required"]);
      const errors = wrapper.emitted("error")?.[0]?.[0] as { path: string }[];
      expect(errors.map((e) => e.path).toSorted()).toEqual(["__form", "password"]);
    });

    it("re-evaluates live after the first submit and clears when fixed", async () => {
      const { wrapper } = mountForm(SignupForm, {
        initialValue: { password: "a", confirm: "b" },
      });
      await submit(wrapper);
      expect(banner(wrapper).exists()).toBe(true);

      await wrapper.findAll("input")[1]!.setValue("a");
      await nextTick();
      expect(banner(wrapper).exists()).toBe(false);

      await wrapper.findAll("input")[1]!.setValue("ab");
      await nextTick();
      expect(bannerText(wrapper)).toBe(MATCH);
    });

    it("dismisses until the next submit", async () => {
      const { wrapper } = mountForm(SignupForm, {
        initialValue: { password: "a", confirm: "b" },
      });
      await submit(wrapper);
      await banner(wrapper).find(".as-form-error-dismiss").trigger("click");
      expect(banner(wrapper).exists()).toBe(false);

      await submit(wrapper);
      expect(bannerText(wrapper)).toBe(MATCH);
    });

    it("clearErrors / reset re-arm a dismissed banner", async () => {
      for (const op of ["clearErrors", "reset"] as const) {
        const { wrapper, formData } = mountForm(SignupForm, {
          initialValue: { password: "a", confirm: "b" },
        });
        await submit(wrapper);
        await banner(wrapper).find(".as-form-error-dismiss").trigger("click");
        await (wrapper.vm as unknown as Record<typeof op, () => unknown>)[op]();
        await nextTick();
        expect(banner(wrapper).exists()).toBe(false);

        // Replacing the whole value re-touches the root field: its rule goes
        // live again and the banner shows without a submit.
        formData.value = { password: "x", confirm: "y" };
        await nextTick();
        await nextTick();
        expect(bannerText(wrapper)).toBe(MATCH);
      }
    });

    it("takes precedence over an external `__form` error", async () => {
      const { wrapper } = mountForm(SignupForm, {
        initialValue: { password: "a", confirm: "b" },
        errors: { __form: "Server said no" },
      });
      expect(bannerText(wrapper)).toBe("Server said no");
      await submit(wrapper);
      expect(bannerText(wrapper)).toBe(MATCH);
    });
  });

  describe("on a nested object prop", () => {
    it("reports at the prop's path, not as the form-level banner", async () => {
      const { wrapper } = mountForm(AccountHost, {
        initialValue: { title: "", signup: { password: "a", confirm: "b" } },
      });
      await submit(wrapper);

      expect(banner(wrapper).exists()).toBe(false);
      expect(wrapper.find(".as-collapsible-error").text()).toBe(MATCH);
      expect(wrapper.findAll(".as-error-slot").map((s) => s.text())).toEqual(["Title is required"]);
      const errors = wrapper.emitted("error")?.[0]?.[0] as { path: string; message: string }[];
      expect(errors).toContainEqual({ path: "signup", message: MATCH });
      expect(errors.map((e) => e.path)).not.toContain("__form");
    });
  });
});
