import type { TAtscriptAnnotatedType, TAtscriptTypeObject } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import {
  UI_DICT_ATTR,
  UI_DICT_DESCR,
  UI_DICT_FILTERABLE,
  UI_DICT_LABEL,
  UI_DICT_SEARCHABLE,
  UI_DICT_SORTABLE,
} from "../shared/annotation-keys";

function getProp(type: TAtscriptAnnotatedType, name: string): TAtscriptAnnotatedType {
  return (type.type as TAtscriptTypeObject).props.get(name)!;
}

describe("@ui.dict.* capability annotations", () => {
  it("records @ui.dict.filterable on a prop", async () => {
    const { DictCaps } = await import("../__tests__/fixtures/ui-dict-capabilities.as");
    const name = getProp(DictCaps, "name");
    const description = getProp(DictCaps, "description");
    const weight = getProp(DictCaps, "weight");

    expect(name.metadata.get(UI_DICT_FILTERABLE)).toBe(true);
    expect(description.metadata.get(UI_DICT_FILTERABLE)).toBe(true);
    expect(weight.metadata.has(UI_DICT_FILTERABLE)).toBe(false);
  });

  it("records @ui.dict.sortable on a prop", async () => {
    const { DictCaps } = await import("../__tests__/fixtures/ui-dict-capabilities.as");
    const name = getProp(DictCaps, "name");
    const description = getProp(DictCaps, "description");
    const weight = getProp(DictCaps, "weight");

    expect(name.metadata.get(UI_DICT_SORTABLE)).toBe(true);
    expect(description.metadata.has(UI_DICT_SORTABLE)).toBe(false);
    expect(weight.metadata.get(UI_DICT_SORTABLE)).toBe(true);
  });

  it("records prop-level @ui.dict.searchable", async () => {
    const { DictCaps } = await import("../__tests__/fixtures/ui-dict-capabilities.as");
    const name = getProp(DictCaps, "name");
    expect(name.metadata.get(UI_DICT_SEARCHABLE)).toBe(true);
  });

  it("records interface-level @ui.dict.searchable", async () => {
    const { DictCaps } = await import("../__tests__/fixtures/ui-dict-capabilities.as");
    expect((DictCaps as unknown as TAtscriptAnnotatedType).metadata.get(UI_DICT_SEARCHABLE)).toBe(
      true,
    );
  });

  it("coexists with existing @ui.dict.label / descr / attr keys", async () => {
    const { DictCaps } = await import("../__tests__/fixtures/ui-dict-capabilities.as");
    const name = getProp(DictCaps, "name");
    const description = getProp(DictCaps, "description");

    expect(name.metadata.get(UI_DICT_LABEL)).toBe(true);
    expect(description.metadata.get(UI_DICT_DESCR)).toBe(true);
    expect(name.metadata.has(UI_DICT_ATTR)).toBe(false);
  });
});
