import { describe, expect, it } from "vitest";
import { createFormDef } from "./create-form-def";
import { getDeclaredFormActions } from "./form-actions";
import { FormWithAction } from "../__tests__/fixtures/create-form-def.as";

describe("getDeclaredFormActions", () => {
  it("yields a plain @ui.form.action as withData:false and skips data fields", () => {
    const def = createFormDef(FormWithAction);
    const actions = getDeclaredFormActions(def);

    // The `username` data field declares no action and must be skipped.
    expect(actions).toEqual([{ id: "resend", withData: false }]);
  });
});
