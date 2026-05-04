import { describe, expect, it } from "vitest";
import {
  APP_CONF_PREFIX,
  RESERVED_ID_PREFIXES,
  STANDARD_PRESET_ID,
  SYSTEM_PRESET_PREFIX,
  USER_CONF_PREFIX,
  appConfId,
  isSystemPresetId,
  normaliseSystemPresetId,
  userConfId,
} from "./preset-id";

describe("preset-id constants", () => {
  it("uses canonical prefixes", () => {
    expect(SYSTEM_PRESET_PREFIX).toBe("sys:");
    expect(USER_CONF_PREFIX).toBe("uc:");
    expect(APP_CONF_PREFIX).toBe("ac:");
    expect(STANDARD_PRESET_ID).toBe("sys:standard");
  });

  it("RESERVED_ID_PREFIXES covers all three namespaces", () => {
    expect(RESERVED_ID_PREFIXES).toEqual(["sys:", "uc:", "ac:"]);
  });
});

describe("userConfId / appConfId", () => {
  it("formats userConfId as uc:user:app:tableKey", () => {
    expect(userConfId("alice", "demo", "products")).toBe("uc:alice:demo:products");
  });

  it("formats appConfId as ac:user:app", () => {
    expect(appConfId("alice", "demo")).toBe("ac:alice:demo");
  });
});

describe("isSystemPresetId", () => {
  it("recognises sys: prefix", () => {
    expect(isSystemPresetId("sys:standard")).toBe(true);
    expect(isSystemPresetId("sys:monitoring")).toBe(true);
  });

  it("rejects other ids", () => {
    expect(isSystemPresetId("preset_abc")).toBe(false);
    expect(isSystemPresetId("uc:alice:demo:products")).toBe(false);
    expect(isSystemPresetId(null)).toBe(false);
    expect(isSystemPresetId(undefined)).toBe(false);
    expect(isSystemPresetId("")).toBe(false);
  });
});

describe("normaliseSystemPresetId", () => {
  it("auto-prefixes bare ids", () => {
    expect(normaliseSystemPresetId("monitoring")).toBe("sys:monitoring");
    expect(normaliseSystemPresetId("standard")).toBe("sys:standard");
  });

  it("returns already-prefixed ids unchanged", () => {
    expect(normaliseSystemPresetId("sys:monitoring")).toBe("sys:monitoring");
    expect(normaliseSystemPresetId("sys:standard")).toBe("sys:standard");
  });
});
