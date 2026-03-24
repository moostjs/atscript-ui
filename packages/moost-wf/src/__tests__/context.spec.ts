import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { extractPassContext, getFormActions } from "../context";
import { objectType, phantomProp, stringProp } from "./helpers";

describe("extractPassContext", () => {
  it("extracts whitelisted keys from workflow context", () => {
    const type = objectType(
      { name: stringProp() },
      { "wf.context.pass": ["email", "passwordRules"] },
    );
    const wfContext = {
      email: "alice@example.com",
      passwordRules: ["min 8 chars"],
      internalSecret: "should-not-leak",
    };

    const result = extractPassContext(type, wfContext);

    expect(result).toEqual({
      email: "alice@example.com",
      passwordRules: ["min 8 chars"],
    });
    expect(result).not.toHaveProperty("internalSecret");
  });

  it("returns empty object when no @wf.context.pass declared", () => {
    const type = objectType({ name: stringProp() });
    expect(extractPassContext(type, { email: "alice@example.com" })).toEqual({});
  });

  it("ignores context keys not present in workflow state", () => {
    const type = objectType({ name: stringProp() }, { "wf.context.pass": ["missing"] });
    expect(extractPassContext(type, { email: "alice@example.com" })).toEqual({});
  });

  it("handles single passContext key", () => {
    const type = objectType({ name: stringProp() }, { "wf.context.pass": ["token"] });
    expect(extractPassContext(type, { token: "abc123" })).toEqual({ token: "abc123" });
  });
});

describe("getFormActions", () => {
  it("reads @ui.form.action fields as stateless actions", () => {
    const type = objectType({
      code: stringProp(),
      resendAction: phantomProp({ "ui.form.action": { id: "resend", label: "Resend Code" } }),
      switchAction: phantomProp({ "ui.form.action": { id: "switchMethod" } }),
    });

    const { actions, actionsWithData } = getFormActions(type);
    expect(actions).toEqual(["resend", "switchMethod"]);
    expect(actionsWithData).toEqual([]);
  });

  it("reads @wf.action.withData fields", () => {
    const type = objectType({
      code: stringProp(),
      saveDraft: phantomProp({ "wf.action.withData": "saveDraft" }),
    });

    const { actions, actionsWithData } = getFormActions(type);
    expect(actions).toEqual([]);
    expect(actionsWithData).toEqual(["saveDraft"]);
  });

  it("reads mixed action types", () => {
    const type = objectType({
      code: stringProp(),
      resendAction: phantomProp({ "ui.form.action": { id: "resend" } }),
      saveDraft: phantomProp({ "wf.action.withData": "saveDraft" }),
    });

    const { actions, actionsWithData } = getFormActions(type);
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

  it("returns empty arrays when no actions declared", () => {
    const type = objectType({ name: stringProp(), email: stringProp() });
    const { actions, actionsWithData } = getFormActions(type);
    expect(actions).toEqual([]);
    expect(actionsWithData).toEqual([]);
  });
});
