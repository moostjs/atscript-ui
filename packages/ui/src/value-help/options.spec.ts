import { describe, expect, it } from "vitest";
import { valueHelpOptions } from "./options";
import type { ResolvedValueHelp } from "./resolve";

const resolved = (over: Partial<ResolvedValueHelp> = {}): ResolvedValueHelp => ({
  url: "/cities",
  primaryKeys: ["id"],
  labelField: "name",
  descrField: undefined,
  attrFields: [],
  filterableFields: [],
  sortableFields: [],
  searchable: false,
  targetType: undefined as never,
  ...over,
});

describe("valueHelpOptions", () => {
  it("the committed value, the label (else the key) and the description", () => {
    const rows = [
      { id: 1, code: "BER", name: "Berlin", note: "capital" },
      { id: 2, code: "BON", name: "" },
    ];
    expect(
      valueHelpOptions(rows, resolved({ descrField: "note" }), { targetField: "code" }),
    ).toEqual([
      { key: "BER", label: "Berlin — capital", value: "BER" },
      { key: "BON", label: "BON", value: "BON" },
    ]);
    expect(valueHelpOptions(rows, resolved(), { targetField: "id" })[0]).toEqual({
      key: "1",
      label: "Berlin",
      value: 1,
    });
  });
});
