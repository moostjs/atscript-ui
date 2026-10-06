import { describe, it, expect } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { createTableDef, type MetaResponse } from "@atscript/ui";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import { mountTableStateDeferred } from "./helpers";

/**
 * A server-declared decoration (`@DbDecorations`) is a display-only column: it
 * rides in `$select` like any visible column, but offers no filter or sort.
 */
function decoratedMeta(): MetaResponse {
  const string = () => defineAnnotatedType().designType("string").$type;
  const row = defineAnnotatedType("object").prop("name", string()).prop("owner", string()).$type;
  const decorations = defineAnnotatedType("object").prop("ownerName", string()).$type;
  return {
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    primaryKeys: ["name"],
    preferredId: ["name"],
    crud: {},
    actions: [],
    relations: [],
    fields: {
      name: { sortable: true, filterable: true },
      owner: { sortable: true, filterable: true },
      ownerName: { sortable: false, filterable: false, decoration: true },
    },
    type: serializeAnnotatedType(row),
    decorations: serializeAnnotatedType(decorations),
  } as unknown as MetaResponse;
}

describe("buildCurrentQuery — decoration columns", () => {
  it("$select carries a visible decoration column, with no filter / sort affordance", async () => {
    const def = createTableDef(decoratedMeta());
    const deco = def.columns.find((c) => c.path === "ownerName")!;
    expect(deco).toMatchObject({ sortable: false, filterable: false });

    const { state, pagesFn, init } = mountTableStateDeferred({});
    init(def);
    state.query();
    await flushPromises();

    expect(pagesFn.mock.calls[0][0].controls.$select).toEqual(["name", "owner", "ownerName"]);
    // no filter field is offered for it, and it is not sortable
    expect(state.allColumns.value.find((c) => c.path === "ownerName")).toMatchObject({
      sortable: false,
      filterable: false,
    });
    expect(pagesFn.mock.calls[0][0].controls.$sort).toBeUndefined();

    // hiding it takes it out of $select again (a decoration is an ordinary visible column)
    pagesFn.mockClear();
    state.columnNames.value = ["name", "owner"];
    await flushPromises();
    expect(pagesFn.mock.calls[0][0].controls.$select).toEqual(["name", "owner"]);
  });
});
