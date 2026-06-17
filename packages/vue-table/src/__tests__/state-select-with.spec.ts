import { describe, it, expect } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mockColumn, mountTableState } from "./helpers";

/**
 * `selectWith` / `alwaysSelected` harvesting in `buildCurrentQuery`. The gate
 * is `tableDef.fetchableFields` (every server-returnable field, including
 * `@ui.table.exclude` fields that are never columns) — NEVER the visible
 * column set — so access-narrowed meta (a dep missing from the field set)
 * silently degrades instead of requesting a field the server won't project.
 */
function selectOf(pagesFn: ReturnType<typeof import("vitest").vi.fn>): string[] {
  return pagesFn.mock.calls[0][0].controls.$select;
}

describe("buildCurrentQuery selectWith / alwaysSelected", () => {
  it("unions a visible column's selectWith dep into $select", async () => {
    // Deps must resolve to paths present in `fetchableFields` — model them as
    // excluded (fetchable-but-not-column) sibling fields.
    const { state, pagesFn } = mountTableState({
      columns: [
        mockColumn("fullName", { selectWith: ["firstName", "lastName"] }),
        mockColumn("age"),
      ],
      fetchableExtra: ["firstName", "lastName"],
    });
    state.query();
    await flushPromises();
    expect(selectOf(pagesFn)).toEqual(["fullName", "age", "firstName", "lastName"]);
  });

  it("includes a @ui.table.exclude dep (gate uses fetchableFields, not columns)", async () => {
    // `avatar` is excluded so it never becomes a column / enters columnNames,
    // but it IS in `fetchableFields` — so the gate admits it as a selectWith dep.
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("name", { selectWith: ["avatar"] })],
      fetchableExtra: ["avatar"],
    });
    state.query();
    await flushPromises();
    const sel = selectOf(pagesFn);
    expect(sel).toContain("avatar");
    // excluded field is not a rendered column:
    expect(state.columnNames.value).not.toContain("avatar");
    expect(sel).toEqual(["name", "avatar"]);
  });

  it("drops a selectWith dep absent from meta (access-narrowed)", async () => {
    // `secret` is declared as a dep but is NOT among fetchableFields —
    // simulating meta the caller's access scope narrowed away. It must not
    // leak into $select.
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("name", { selectWith: ["secret"] }), mockColumn("age")],
    });
    state.query();
    await flushPromises();
    const sel = selectOf(pagesFn);
    expect(sel).not.toContain("secret");
    expect(sel).toEqual(["name", "age"]);
  });

  it("drops selectWith deps when their owning column is toggled out", async () => {
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("fullName", { selectWith: ["firstName"] }), mockColumn("age")],
      fetchableExtra: ["firstName"],
    });
    // Bootstrap first so the columnNames watcher re-queries on the next mutation.
    state.query();
    await flushPromises();
    expect(selectOf(pagesFn)).toEqual(["fullName", "age", "firstName"]);
    pagesFn.mockClear();

    // Hide `fullName` — its selectWith dep must disappear from $select too,
    // since harvesting walks VISIBLE columns only.
    state.columnNames.value = ["age"];
    await flushPromises();
    const sel = pagesFn.mock.calls[0][0].controls.$select;
    expect(sel).toEqual(["age"]);
    expect(sel).not.toContain("firstName");
  });

  it("unions alwaysSelected paths into $select and gates absent ones", async () => {
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("name")],
      // `tenant` is fetchable (excluded field) → kept; `missing` is absent → gated out.
      fetchableExtra: ["tenant"],
      alwaysSelected: ["tenant", "missing"],
    });
    state.query();
    await flushPromises();
    const sel = selectOf(pagesFn);
    expect(sel).toContain("tenant");
    expect(sel).not.toContain("missing");
    expect(sel).toEqual(["name", "tenant"]);
  });
});
