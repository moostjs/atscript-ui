import { describe, it, expect } from "vite-plus/test";
import { needsMfa } from "../server/workflows/auth/login.workflow";

describe("p6 login schema · MFA conditional", () => {
  it("skips MFA steps when ctx.mfaEnabled is false/undefined", () => {
    expect(needsMfa({ mfaEnabled: false })).toBe(false);
    expect(needsMfa({})).toBe(false);
  });
  it("runs MFA steps when ctx.mfaEnabled is true", () => {
    expect(needsMfa({ mfaEnabled: true })).toBe(true);
  });
});
