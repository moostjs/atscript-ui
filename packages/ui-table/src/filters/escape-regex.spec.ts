import { describe, expect, it } from "vitest";
import { escapeRegex } from "./escape-regex";

describe("escapeRegex", () => {
  it("escapes dots", () => {
    expect(escapeRegex("gmail.com")).toBe("gmail\\.com");
  });

  it("escapes asterisks and plus", () => {
    expect(escapeRegex("a*b+c")).toBe("a\\*b\\+c");
  });

  it("escapes question marks and carets", () => {
    expect(escapeRegex("what?^test")).toBe("what\\?\\^test");
  });

  it("escapes dollar signs", () => {
    expect(escapeRegex("$100")).toBe("\\$100");
  });

  it("escapes braces and brackets", () => {
    expect(escapeRegex("{a}[b](c)")).toBe("\\{a\\}\\[b\\]\\(c\\)");
  });

  it("escapes pipes and backslashes", () => {
    expect(escapeRegex("a|b\\c")).toBe("a\\|b\\\\c");
  });

  it("returns plain strings unchanged", () => {
    expect(escapeRegex("hello world")).toBe("hello world");
    expect(escapeRegex("abc123")).toBe("abc123");
  });

  it("handles empty string", () => {
    expect(escapeRegex("")).toBe("");
  });

  it("handles string with multiple special chars", () => {
    expect(escapeRegex("file.name (v2.0) [test]")).toBe("file\\.name \\(v2\\.0\\) \\[test\\]");
  });
});
