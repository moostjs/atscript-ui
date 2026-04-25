import { describe, it, expect } from "vite-plus/test";
import { hashPassword, verifyPassword } from "../server/auth/password";

describe("p6 password", () => {
  it("hashes + verifies round-trip", async () => {
    const { hash, salt } = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", hash, salt)).toBe(true);
    expect(await verifyPassword("wrong", hash, salt)).toBe(false);
  });
  it("same password yields different hashes (random salt)", async () => {
    const a = await hashPassword("x");
    const b = await hashPassword("x");
    expect(a.hash).not.toBe(b.hash);
    expect(a.salt).not.toBe(b.salt);
  });
  it("verify returns false on empty hash/salt", async () => {
    expect(await verifyPassword("anything", "", "")).toBe(false);
  });
});
