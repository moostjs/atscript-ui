import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, type Component } from "vue";
import { setUiLocale, type UiTranslate } from "@atscript/ui";
import { provideAsLocale } from "@atscript/vue-form";
import AsTableStatus from "../components/internal/as-table-status.vue";
import AsFilterConditions from "../components/internal/as-filter-conditions.vue";
import AsSelectCell from "../components/internal/as-select-cell.vue";
import AsFilters from "../components/as-filters.vue";
import { formatCellValue } from "../utils/format-cell";
import { queryTargetGate } from "../composables/state/intent-scope";
import { mockColumn, mountWithTableContext } from "./helpers";

/** A German translator for the codes the tests read. */
const GERMAN: Record<string, string> = {
  UI_TABLE_NO_MATCHING: "Keine passenden Werte",
  UI_TABLE_NO_MATCH_SEARCH: "Keine Einträge für {term} gefunden.",
  UI_FILTER_DATE_EQ: "am",
  UI_DATE_TODAY: "Heute",
  UI_DATE_LAST_7_DAYS: "Letzte 7 Tage",
  UI_FILTER_ADD_CONDITION: "+ Bedingung",
  UI_FILTER_OR: "oder",
  UI_FILTER_CHIP: "{field} {condition} {value}",
  UI_FILTER_COND_EQ: "ist",
  UI_FILTER_CUSTOM: "Eigener Filter",
  UI_FILTER_BEFORE_DATE: "vor {date}",
  UI_FILTER_MONTHS_AGO: "vor {count} Monaten",
  UI_TABLE_SELECT_ROW_REASON: "Zeile wählen ({reason})",
  UI_ACTION_QUERY_UNSUPPORTED: "Nicht für alle Treffer",
  UI_YES: "Ja",
};
const de: UiTranslate = (id, params) =>
  Object.hasOwn(GERMAN, id)
    ? GERMAN[id].replace(/\{(\w+)\}/g, (m, k: string) =>
        params && k in params ? String(params[k]) : m,
      )
    : undefined;

/** `inner` rendered under `provideAsLocale(() => "de", de)`. */
function german(inner: Component, props: Record<string, unknown>): Component {
  return defineComponent({
    setup() {
      provideAsLocale(() => "de", de);
      return () => h(inner, props);
    },
  });
}

const created = mockColumn("created", { label: "Created", type: "date", valueKind: "isoDate" });
const name = mockColumn("name", { label: "Name" });

afterEach(() => setUiLocale(undefined));

describe("table components read the app's UI texts", () => {
  it("status texts, with the search term kept as markup inside the sentence", () => {
    const props = {
      queryError: null,
      isEmpty: true,
      querying: false,
      columns: [name],
      hasActiveFilters: false,
      searchTerm: "zz",
    };
    const { wrapper } = mountWithTableContext(german(AsTableStatus, props), { columns: [name] });
    expect(wrapper.find(".as-vh-empty-title").text()).toBe("Keine passenden Werte");
    const body = wrapper.find(".as-vh-empty-body");
    expect(body.text()).toBe('Keine Einträge für "zz" gefunden.');
    expect(body.find(".as-vh-empty-code").text()).toBe('"zz"');
  });

  it("condition names and date shortcuts", () => {
    const { wrapper } = mountWithTableContext(
      german(AsFilterConditions, {
        column: created,
        modelValue: [{ type: "eq", value: [] }],
      }),
      { columns: [created] },
    );
    const options = wrapper.findAll(".as-filter-condition-select option").map((o) => o.text());
    expect(options[0]).toBe("am");
    const shortcuts = wrapper.findAll(".as-filter-shortcut-btn").map((b) => b.text());
    expect(shortcuts.slice(0, 3)).toEqual(["Heute", "Yesterday", "Letzte 7 Tage"]);
    expect(wrapper.find(".as-filter-add-condition").text()).toBe("+ Bedingung");
  });

  it("filter chips and residual filters", async () => {
    const { wrapper, state } = mountWithTableContext(
      german(AsFilters, { filterFields: ["created", "name"] }),
      { columns: [created, name] },
    );
    state.filters.value = {
      created: [
        { type: "bw", value: ["today-6", "today"] },
        { type: "lt", value: ["month-2"] },
      ],
    };
    state.setResidualFilters([{ $or: [{ name: "a" }, { name: "b" }] }]);
    await wrapper.vm.$nextTick();
    const html = wrapper.html();
    expect(html).toContain("Letzte 7 Tage");
    expect(html).toContain("vor vor 2 Monaten");
    expect(wrapper.find(".as-residual-filter-label").text()).toBe("Eigener Filter");
    expect(wrapper.find(".as-residual-filter-text").text()).toBe("Name ist a oder Name ist b");
  });

  it("per-row controls", () => {
    const props = {
      row: { id: 1 },
      index: 0,
      selected: false,
      select: "multi",
      selectOn: "check",
      verdict: { ok: false, reason: "gesperrt" },
    };
    const { wrapper } = mountWithTableContext(german(AsSelectCell, props));
    expect(wrapper.find("[aria-label]").attributes("aria-label")).toBe("Zeile wählen (gesperrt)");
  });

  it("code outside components reads the global texts (setUiLocale)", () => {
    setUiLocale("de", de);
    expect(formatCellValue(true, "boolean")).toBe("Ja");
    expect(queryTargetGate(10)({ name: "x" } as never)).toBe("Nicht für alle Treffer");
  });
});
