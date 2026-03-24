import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { extractPassContext, getFormActions } from "../context";
import { objectType, phantomProp, stringProp } from "./helpers";

describe("extractPassContext", () => {
  it("extracts whitelisted keys from workflow context", async () => {
    const { ContextPassForm } = await import("./fixtures/wf-forms.as");
    const wfContext = {
      email: "alice@example.com",
      passwordRules: ["min 8 chars"],
      internalSecret: "should-not-leak",
    };

    const result = extractPassContext(ContextPassForm, wfContext);

    expect(result).toEqual({
      email: "alice@example.com",
      passwordRules: ["min 8 chars"],
    });
    expect(result).not.toHaveProperty("internalSecret");
  });

  it("returns empty object when no @wf.context.pass declared", async () => {
    const { NoContextForm } = await import("./fixtures/wf-forms.as");
    expect(extractPassContext(NoContextForm, { email: "alice@example.com" })).toEqual({});
  });

  it("ignores context keys not present in workflow state", async () => {
    const { MissingContextForm } = await import("./fixtures/wf-forms.as");
    expect(extractPassContext(MissingContextForm, { email: "alice@example.com" })).toEqual({});
  });

  it("handles single passContext key", async () => {
    const { SingleContextForm } = await import("./fixtures/wf-forms.as");
    expect(extractPassContext(SingleContextForm, { token: "abc123" })).toEqual({ token: "abc123" });
  });
});

describe("getFormActions", () => {
  it("reads @ui.form.action fields as stateless actions", async () => {
    const { ActionForm } = await import("./fixtures/wf-forms.as");

    const { actions, actionsWithData } = getFormActions(ActionForm);
    expect(actions).toEqual(["resend", "switchMethod"]);
    expect(actionsWithData).toEqual([]);
  });

  it("reads @wf.action.withData fields", async () => {
    const { WithDataForm } = await import("./fixtures/wf-forms.as");

    const { actions, actionsWithData } = getFormActions(WithDataForm);
    expect(actions).toEqual([]);
    expect(actionsWithData).toEqual(["saveDraft"]);
  });

  it("reads mixed action types", async () => {
    const { MixedActionForm } = await import("./fixtures/wf-forms.as");

    const { actions, actionsWithData } = getFormActions(MixedActionForm);
    expect(actions).toEqual(["resend"]);
    expect(actionsWithData).toEqual(["saveDraft"]);
  });

  it("reads legacy @ui.altAction as stateless action", () => {
    const type = objectType({
      code: stringProp(),
      resetAction: phantomProp({ "ui.altAction": { id: "reset" } }),
    });

    const { actions } = getFormActions(type);
    expect(actions).toEqual(["reset"]);
  });

  it("reads @ui.form.action with string value", () => {
    const type = objectType({
      code: stringProp(),
      resendAction: phantomProp({ "ui.form.action": "resend" }),
    });

    expect(getFormActions(type).actions).toEqual(["resend"]);
  });

  it("returns empty arrays for non-object types", () => {
    const type = defineAnnotatedType().designType("string").$type;
    const { actions, actionsWithData } = getFormActions(type);
    expect(actions).toEqual([]);
    expect(actionsWithData).toEqual([]);
  });

  it("returns empty arrays when no actions declared", async () => {
    const { NoActionsForm } = await import("./fixtures/wf-forms.as");
    const { actions, actionsWithData } = getFormActions(NoActionsForm);
    expect(actions).toEqual([]);
    expect(actionsWithData).toEqual([]);
  });
});
