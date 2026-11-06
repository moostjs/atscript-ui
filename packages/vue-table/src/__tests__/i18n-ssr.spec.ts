// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import type { Client } from "@atscript/db-client";
import { provideAsLocale } from "@atscript/vue-form";
import AsTableCellValue from "../components/defaults/as-table-cell-value.vue";
import { createTableState, useTableContext } from "../composables/use-table-state";
import { useTable } from "../composables/use-table";
import { resetDefaultClientFactory, setDefaultClientFactory } from "@atscript/ui";
import type { ReactiveTableState } from "../types";
import { mockColumn, mockTableDef } from "./helpers";

/**
 * A server renders many apps at once: what a table words — cells, the
 * built-in remove action, the default preset — comes from the app's texts,
 * never from module-global (English) ones, so the client hydrates the same text.
 */
const GERMAN: Record<string, string> = {
  UI_YES: "Ja",
  UI_ACTION_DELETE: "Löschen",
  UI_ACTION_DELETE_ONE: "Eintrag $1 löschen?",
  UI_PRESET_STANDARD: "Standardansicht",
};

describe("table texts on a server", () => {
  it("a boolean cell, the remove action and the default preset use the app's texts", async () => {
    let state!: ReactiveTableState;
    const client = { meta: vi.fn(), pages: vi.fn() } as unknown as Client;
    const Table = defineComponent({
      setup() {
        const { state: s, internals } = createTableState({
          client,
          query: { queryOnMount: false },
        });
        state = s;
        state.rowDelete.value = true;
        const def = mockTableDef([mockColumn("id")]);
        def.canRemove = true;
        internals.init(def);
        return () =>
          h(AsTableCellValue, {
            row: { active: true },
            column: mockColumn("active", { type: "boolean" }),
          });
      },
    });
    const app = createSSRApp(
      defineComponent({
        setup() {
          provideAsLocale(
            () => "de",
            (id) => GERMAN[id],
          );
          return () => h(Table);
        },
      }),
    );
    const html = await renderToString(app);
    expect(html).toContain("Ja");
    const remove = state.actions.row.find((a) => a.name === "__remove");
    expect(remove?.label).toBe("Löschen");
    expect(remove?.promptText).toEqual(["Eintrag $1 löschen?", "Delete $N items?"]);
    expect(state.preset.systemPresets.value[0]?.label).toBe("Standardansicht");
  });
});

// Why: every server render asked an uncached `/meta` per table, deserialized
// it and initialised the state after the HTML was written — nothing waited for it.
describe("useTable on a server", () => {
  it("asks no /meta, yet the state has its client (in the app's locale)", async () => {
    const meta = vi.fn(() => new Promise(() => {}));
    const built: unknown[] = [];
    setDefaultClientFactory(((url: string, opts?: unknown) => {
      built.push([url, opts]);
      return { meta, pages: vi.fn() } as unknown as Client;
    }) as never);
    try {
      let state!: ReactiveTableState;
      let client: Client | undefined;
      const Cell = defineComponent({
        setup() {
          client = useTableContext().client;
          return () => h("span");
        },
      });
      const app = createSSRApp(
        defineComponent({
          setup() {
            provideAsLocale(() => "de");
            return () =>
              h(
                defineComponent({
                  setup() {
                    state = useTable("/api/db/tables/products", { queryOnMount: false });
                    return () => h(Cell);
                  },
                }),
              );
          },
        }),
      );
      await renderToString(app);
      expect(meta).not.toHaveBeenCalled();
      expect(built).toEqual([["/api/db/tables/products", { metaStore: false, locale: "de" }]]);
      expect(client).toBeDefined();
      expect(state.loadingMetadata.value).toBe(true);
    } finally {
      resetDefaultClientFactory();
    }
  });
});
