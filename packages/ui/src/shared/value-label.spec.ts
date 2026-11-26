import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { arrangeText, valueLabelOf } from "./value-label";

describe("arrangeText (since 0.1.190)", () => {
  it("arranges a code with its text", () => {
    expect(arrangeText("BER", "Berlin")).toBe("Berlin (BER)");
    expect(arrangeText("BER", "Berlin", "textKey")).toBe("Berlin (BER)");
    expect(arrangeText("BER", "Berlin", "keyText")).toBe("BER (Berlin)");
    expect(arrangeText("BER", "Berlin", "text")).toBe("Berlin");
  });

  it("an empty text yields the key; an empty key yields nothing", () => {
    for (const text of [undefined, null, ""]) {
      expect(arrangeText("BER", text, "text")).toBe("BER");
      expect(arrangeText("BER", text)).toBe("BER");
    }
    expect(arrangeText("", "Berlin")).toBe("");
    // a text of another type is shown as text
    expect(arrangeText("7", 42)).toBe("42 (7)");
  });
});

describe("valueLabelOf (since 0.1.190)", () => {
  it("reads the annotation, the arrangement defaulted", () => {
    const city = defineAnnotatedType()
      .designType("string")
      .annotate("ui.valueLabel" as never, { field: "cityName" } as never).$type;
    expect(valueLabelOf(city)).toEqual({ field: "cityName", arrangement: "textKey" });
    const login = defineAnnotatedType()
      .designType("string")
      .annotate("ui.valueLabel" as never, { field: "name", arrangement: "text" } as never).$type;
    expect(valueLabelOf(login)).toEqual({ field: "name", arrangement: "text" });
    expect(valueLabelOf(defineAnnotatedType().designType("string").$type)).toBeUndefined();
  });
});
