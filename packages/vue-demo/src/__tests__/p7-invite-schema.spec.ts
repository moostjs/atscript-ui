import { describe, it, expect } from "vite-plus/test";
import { InviteWorkflow } from "../server/workflows/users/invite.workflow";

describe("p7 invite schema", () => {
  it("InviteWorkflow class exists", () => {
    expect(InviteWorkflow).toBeTruthy();
    expect(typeof InviteWorkflow).toBe("function");
  });

  it("defines the four step methods on the prototype", () => {
    const proto = InviteWorkflow.prototype as unknown as Record<string, unknown>;
    // The @Step decorators attach metadata to these method names.
    expect(typeof proto.start).toBe("function");
    expect(typeof proto.sendInvite).toBe("function");
    expect(typeof proto.acceptInvite).toBe("function");
    expect(typeof proto.issueSession).toBe("function");
  });

  it("defines the schema registration `flow` method", () => {
    const proto = InviteWorkflow.prototype as unknown as Record<string, unknown>;
    expect(typeof proto.flow).toBe("function");
  });
});
