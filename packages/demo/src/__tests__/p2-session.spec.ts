import { describe, it, expect } from "vite-plus/test";
import { encodeSession, decodeSession } from "../server/auth/session-codec";
import { SESSION_COOKIE } from "../server/auth/session-payload";

describe("p2 session codec", () => {
  it("round-trips a payload and rejects tampering", () => {
    const secret = "unit-test-secret";
    const token = encodeSession({ userId: 1, roleName: "admin" }, secret);
    expect(decodeSession(token, secret)).toEqual({ userId: 1, roleName: "admin" });
    expect(decodeSession(token, "wrong-secret")).toBeNull();
    const [body, sig] = token.split(".");
    expect(decodeSession(`${body}.${sig.slice(0, -1)}A`, secret)).toBeNull();
  });
});

describe("p2 session guard decode", () => {
  it("decodes a signed cookie using the same secret", () => {
    const secret = "dev-secret-change-me";
    const token = encodeSession(
      { userId: 1, username: "admin", roleId: 1, roleName: "admin", issuedAt: 0 },
      secret,
    );
    const round = decodeSession<{ userId: number; roleName: string }>(token, secret);
    expect(round?.userId).toBe(1);
    expect(round?.roleName).toBe("admin");
  });
  it("constant exposes the cookie name", () => {
    expect(SESSION_COOKIE).toBe("demo.sid");
  });
});
