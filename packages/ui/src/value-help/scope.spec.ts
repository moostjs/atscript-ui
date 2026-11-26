import { describe, expect, it } from "vitest";
import { valueHelpFills, valueHelpScope } from "./scope";
import type { ValueHelpInfo } from "./types";

const info: ValueHelpInfo = {
  url: "/cities",
  targetField: "code",
  filter: { region: { $eq: "north" } },
  pinned: ["region"],
  hostFilter: [
    { target: "country", local: "country" },
    { target: "kind", local: "cityKind" },
  ],
  fill: [
    { local: "cityName", target: "name" },
    { local: "country", target: "country" },
  ],
};

describe("valueHelpScope", () => {
  it("adds a condition per host value and pins its target", () => {
    const form: Record<string, unknown> = { country: "DE", cityKind: 2 };
    expect(valueHelpScope(info, (local) => form[local])).toEqual({
      filter: { $and: [{ region: { $eq: "north" } }, { country: "DE" }, { kind: 2 }] },
      pinned: ["region", "country", "kind"],
    });
  });

  it("an empty host field leaves its condition out (undefined, null, '')", () => {
    for (const empty of [undefined, null, ""]) {
      const form: Record<string, unknown> = { country: empty, cityKind: 1 };
      expect(valueHelpScope(info, (local) => form[local])).toEqual({
        filter: { $and: [{ region: { $eq: "north" } }, { kind: 1 }] },
        pinned: ["region", "kind"],
      });
    }
  });

  it("anything but one value leaves its condition out (an array, an object)", () => {
    const form: Record<string, unknown> = { country: ["DE", "FR"], cityKind: { a: 1 } };
    expect(valueHelpScope(info, (local) => form[local])).toEqual({
      filter: { region: { $eq: "north" } },
      pinned: ["region"],
    });
  });

  it("flattens a literal `$and` with the host conditions; a binding without host refs is unchanged", () => {
    const anded: ValueHelpInfo = {
      ...info,
      filter: { $and: [{ a: { $eq: 1 } }, { b: { $eq: 2 } }] } as never,
    };
    expect(valueHelpScope(anded, () => "x").filter).toEqual({
      $and: [{ a: { $eq: 1 } }, { b: { $eq: 2 } }, { country: "x" }, { kind: "x" }],
    });
    const plain: ValueHelpInfo = { url: "/c", targetField: "id", filter: { a: { $eq: 1 } } };
    expect(valueHelpScope(plain, () => "x")).toEqual({ filter: { a: { $eq: 1 } }, pinned: [] });
    expect(valueHelpScope({ url: "/c", targetField: "id" }, () => "x")).toEqual({ pinned: [] });
    // host values alone: one condition, no `$and`
    const hostOnly: ValueHelpInfo = {
      url: "/c",
      targetField: "id",
      hostFilter: [{ target: "country", local: "country" }],
    };
    expect(valueHelpScope(hostOnly, () => "DE")).toEqual({
      filter: { country: "DE" },
      pinned: ["country"],
    });
  });
});

describe("valueHelpFills", () => {
  it("the row's target value per fill, in order (a missing one is undefined)", () => {
    expect(valueHelpFills(info, { code: "B", name: "Berlin" })).toEqual([
      { local: "cityName", value: "Berlin" },
      { local: "country", value: undefined },
    ]);
    expect(valueHelpFills({ url: "/c", targetField: "id" }, { id: 1 })).toEqual([]);
  });
});
