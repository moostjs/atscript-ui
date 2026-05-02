import { describe, it, expect } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import {
  createTableDef,
  UI_TABLE_CLASSES,
  UI_TABLE_STYLES,
  type ColumnDef,
  type MetaResponse,
} from "@atscript/ui";
import { useCellResolver } from "../composables/use-cell-resolver";

function stringProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("string");
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
  return h.$type;
}

function buildTableDef(props: Record<string, ReturnType<typeof stringProp>>) {
  const objectType = defineAnnotatedType("object");
  for (const [name, prop] of Object.entries(props)) objectType.prop(name, prop);
  const meta: MetaResponse = {
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    primaryKeys: [],
    preferredId: [],
    crud: {},
    actions: [],
    relations: [],
    fields: Object.fromEntries(
      Object.keys(props).map((k) => [k, { sortable: false, filterable: true }]),
    ),
    type: serializeAnnotatedType(objectType.$type),
  };
  return createTableDef(meta, objectType.$type);
}

function runResolver(
  def: ReturnType<typeof buildTableDef>,
  column: ColumnDef,
  row: Record<string, unknown>,
  rowIndex = 0,
) {
  let result: ReturnType<ReturnType<typeof useCellResolver>["resolve"]> | undefined;
  const Probe = defineComponent({
    setup() {
      const { resolve } = useCellResolver(() => def);
      result = resolve(column, row, rowIndex);
      return () => h("div");
    },
  });
  mount(Probe);
  return result!;
}

function runHasAny(def: ReturnType<typeof buildTableDef>): boolean {
  let result = false;
  const Probe = defineComponent({
    setup() {
      const { hasAnyCellBindings } = useCellResolver(() => def);
      result = hasAnyCellBindings.value;
      return () => h("div");
    },
  });
  mount(Probe);
  return result;
}

// These cases exercise the static-resolver path (the default StaticFieldResolver
// returns the raw static value for known keys). The dynamic-fn paths are
// covered indirectly through the form-side dynamic-resolver tests.

describe("useCellResolver — static @ui.table.* annotations", () => {
  it("returns the static @ui.table.classes value as-is", () => {
    const def = buildTableDef({
      name: stringProp({ [UI_TABLE_CLASSES]: ["font-bold"] }),
    });
    const col = def.columns.find((c) => c.path === "name")!;
    const out = runResolver(def, col, { name: "Alice" });
    expect(out.class).toEqual(["font-bold"]);
    expect(out.style).toBeUndefined();
  });

  it("returns the static @ui.table.styles value as-is", () => {
    const def = buildTableDef({
      name: stringProp({ [UI_TABLE_STYLES]: ["padding-left: 12px"] }),
    });
    const col = def.columns.find((c) => c.path === "name")!;
    const out = runResolver(def, col, { name: "Bob" });
    expect(out.style).toEqual(["padding-left: 12px"]);
    expect(out.class).toBeUndefined();
  });

  it("returns an empty bag for columns with no annotations", () => {
    const def = buildTableDef({ name: stringProp() });
    const col = def.columns.find((c) => c.path === "name")!;
    const out = runResolver(def, col, { name: "Cleo" });
    expect(out.class).toBeUndefined();
    expect(out.style).toBeUndefined();
    expect(Object.keys(out)).toHaveLength(0);
  });

  it("merges static `@ui.table.attr` into the cell binding bag", () => {
    const def = buildTableDef({
      name: stringProp({ "ui.table.attr": [{ name: "data-row", value: "user" }] as never }),
    });
    const col = def.columns.find((c) => c.path === "name")!;
    const out = runResolver(def, col, { name: "Drew" });
    expect(out["data-row"]).toBe("user");
  });
});

describe("useCellResolver — hasAnyCellBindings", () => {
  it("is false when no column has cell-level annotations", () => {
    const def = buildTableDef({ name: stringProp(), age: stringProp() });
    expect(runHasAny(def)).toBe(false);
  });

  it("is true when any column has @ui.table.classes / styles / attr", () => {
    const def = buildTableDef({
      name: stringProp(),
      tag: stringProp({ [UI_TABLE_CLASSES]: ["font-bold"] }),
    });
    expect(runHasAny(def)).toBe(true);
  });
});
