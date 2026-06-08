import { describe, it, expect } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mockColumn, mountTableState } from "./helpers";

/**
 * `selectWith` / `alwaysSelected` harvesting in `buildCurrentQuery`. The gate
 * is `allColumns` (full set, incl. hidden columns) — NEVER the visible set —
 * so access-narrowed meta (a dep missing from the table definition) silently
 * degrades instead of requesting a field the server won't project.
 */
function selectOf(pagesFn: ReturnType<typeof import("vitest").vi.fn>): string[] {
  return pagesFn.mock.calls[0][0].controls.$select;
}

describe("buildCurrentQuery selectWith / alwaysSelected", () => {
  it("unions a visible column's selectWith dep into $select", async () => {
    // Deps must resolve to column paths present in allColumns — model them as
    // hidden sibling columns (the access-narrowed gate is over allColumns).
    const { state, pagesFn } = mountTableState({
      columns: [
        mockColumn("fullName", { selectWith: ["firstName", "lastName"] }),
        mockColumn("age"),
        mockColumn("firstName", { visible: false }),
        mockColumn("lastName", { visible: false }),
      ],
    });
    state.query();
    await flushPromises();
    expect(selectOf(pagesFn)).toEqual(["fullName", "age", "firstName", "lastName"]);
  });

  it("includes a @ui.table.hidden dep (gate uses allColumns, not visible)", async () => {
    // `avatar` is hidden (visible:false) so it never enters columnNames, but it
    // IS in allColumns — so the gate admits it as a selectWith dep.
    const { state, pagesFn } = mountTableState({
      columns: [
        mockColumn("name", { selectWith: ["avatar"] }),
        mockColumn("avatar", { visible: false }),
      ],
    });
    state.query();
    await flushPromises();
    const sel = selectOf(pagesFn);
    expect(sel).toContain("avatar");
    // hidden column is not a rendered/visible column:
    expect(state.columnNames.value).not.toContain("avatar");
    expect(sel).toEqual(["name", "avatar"]);
  });

  it("drops a selectWith dep absent from meta (access-narrowed)", async () => {
    // `secret` is declared as a dep but is NOT among allColumns — simulating
    // meta the caller's access scope narrowed away. It must not leak into $select.
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
      columns: [
        mockColumn("fullName", { selectWith: ["firstName"] }),
        mockColumn("age"),
        mockColumn("firstName", { visible: false }),
      ],
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
      columns: [mockColumn("name"), mockColumn("tenant", { visible: false })],
      // `tenant` exists in meta → kept; `missing` is absent → gated out.
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
