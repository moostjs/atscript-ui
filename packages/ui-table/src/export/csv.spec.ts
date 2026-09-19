import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("leaves plain text unquoted", () => {
    expect(csvCell("plain")).toBe("plain");
  });

  it("renders null/undefined as an empty field", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes and doubles embedded quotes", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes cells containing the delimiter or newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("cr\rlf")).toBe('"cr\rlf"');
  });

  it("escapes formula leaders with a leading apostrophe", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+49 555")).toBe("'+49 555");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@user")).toBe("'@user");
    expect(csvCell("\tlead")).toBe("'\tlead");
  });

  it("does not escape formulas when escapeFormulas is false", () => {
    expect(csvCell("=1+1", { escapeFormulas: false })).toBe("=1+1");
  });

  it("never escapes non-string cells, so numbers and booleans stay scalars", () => {
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(-0.5)).toBe("-0.5");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(false)).toBe("false");
    // The string form of the same value is user content, so it IS guarded.
    expect(csvCell("-5")).toBe("'-5");
  });

  it("honours a custom delimiter", () => {
    expect(csvCell("a;b", { delimiter: ";" })).toBe('"a;b"');
    expect(csvCell("a,b", { delimiter: ";" })).toBe("a,b");
  });
});

describe("toCsv", () => {
  it("writes a header + rows separated by CRLF and terminated with CRLF", () => {
    const csv = toCsv(
      ["id", "name"],
      [
        [1, "Ann"],
        [2, "Bob"],
      ],
    );
    expect(csv).toBe("id,name\r\n1,Ann\r\n2,Bob\r\n");
  });

  it("prepends a UTF-8 BOM only when asked", () => {
    expect(toCsv(["a"], [["b"]], { bom: true })).toBe("﻿a\r\nb\r\n");
    expect(toCsv(["a"], [["b"]]).startsWith("﻿")).toBe(false);
  });

  it("quotes header labels that need it", () => {
    expect(toCsv(["a,b"], [])).toBe('"a,b"\r\n');
  });
});
