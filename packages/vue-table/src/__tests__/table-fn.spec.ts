import { beforeAll, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import {
  createTableDef,
  UI_TABLE_FN_ATTR,
  UI_TABLE_FN_CLASSES,
  UI_TABLE_FN_STYLES,
  type MetaResponse,
  type UiTranslate,
} from "@atscript/ui";
import { installDynamicResolver } from "@atscript/ui-fns";
import { provideAsLocale } from "@atscript/vue-form/locale";
import { useCellResolver } from "../composables/use-cell-resolver";

beforeAll(() => installDynamicResolver());

const de: UiTranslate = (id, params) =>
  id === "Status: {status}" ? `Zustand: ${String(params?.status)}` : undefined;

function tableDef(meta: Record<string, unknown>) {
  const prop = defineAnnotatedType().designType("string");
  for (const [k, v] of Object.entries(meta)) prop.annotate(k as keyof AtscriptMetadata, v as never);
  const type = defineAnnotatedType("object").prop("status", prop.$type).$type;
  const response: MetaResponse = {
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    primaryKeys: [],
    preferredId: [],
    crud: {},
    actions: [],
    relations: [],
    fields: { status: { sortable: false, filterable: true } },
    type: serializeAnnotatedType(type),
  };
  return createTableDef(response, type);
}

/** The cell bindings of the `status` column for `row`, under `provideAsLocale`. */
function cellOf(
  meta: Record<string, unknown>,
  row: Record<string, unknown>,
  translate?: UiTranslate,
) {
  const def = tableDef(meta);
  let out: Record<string, unknown> | undefined;
  const Cell = defineComponent({
    setup() {
      const { resolve } = useCellResolver(() => def);
      out = resolve(def.columns.find((c) => c.path === "status")!, row, 3);
      return () => h("div");
    },
  });
  mount(
    defineComponent({
      setup() {
        provideAsLocale(() => "de", translate);
        return () => h(Cell);
      },
    }),
  );
  return out!;
}

describe("@ui.table.fn.* — (row, ctx, t) per cell", () => {
  it("classes and styles are functions of the row", () => {
    const meta = {
      [UI_TABLE_FN_CLASSES]: "(row) => row.status === 'paid' ? 'text-success' : ''",
      [UI_TABLE_FN_STYLES]: "(row, ctx) => ({ order: ctx.rowIndex })",
    };
    expect(cellOf(meta, { status: "paid" })).toEqual({
      class: "text-success",
      style: { order: 3 },
    });
    expect(cellOf(meta, { status: "open" }).class).toBe("");
  });

  it("attrs get the app's `t`", () => {
    const meta = {
      [UI_TABLE_FN_ATTR]: [
        { name: "title", fn: "(row, ctx, t) => t('Status: {status}', { status: row.status })" },
        { name: "data-row", fn: "(row, ctx) => ctx.rowIndex" },
      ],
    };
    expect(cellOf(meta, { status: "paid" }, de)).toEqual({
      title: "Zustand: paid",
      "data-row": 3,
    });
    expect(cellOf(meta, { status: "paid" }).title).toBe("Status: paid");
  });
});
