import { describe, expect, it } from "vitest";
import type { UiT } from "@atscript/ui";
import { textAround } from "./text-around";

const plural: UiT = (_id, p) =>
  `${String(p?.count)} von ${String(p?.total)} Spalte${p?.count === 1 ? "" : "n"} sichtbar`;
const reordered: UiT = (_id, p) =>
  `Von ${String(p?.total)} Spalten sind ${String(p?.count)} sichtbar`;

describe("textAround", () => {
  it("words the text with the real value, so a translator can pick a plural form", () => {
    expect(textAround(plural, "UI_TABLE_COLUMNS_VISIBLE", "count", { count: 1, total: 3 })).toEqual(
      ["", "1", " von 3 Spalte sichtbar"],
    );
  });

  it("finds the param where the template puts it, even when the value repeats", () => {
    expect(textAround(reordered, "X", "count", { count: 3, total: 3 })).toEqual([
      "Von 3 Spalten sind ",
      "3",
      " sichtbar",
    ]);
  });

  it("the whole text when the translation leaves the param out", () => {
    expect(textAround(() => "Keine Treffer", "X", "term", { term: "zz" })).toEqual([
      "Keine Treffer",
      "",
      "",
    ]);
  });
});
