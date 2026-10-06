// Section 4 — Filter bar: an array of a literal union on SQLite (`tasks.labels`).
//
// SQL adapters store arrays as JSON: the column is existence-only (`filterable: false`,
// `filterOps: ['$exists']`), so the bar offers the empty / not-empty input, never the
// value picker (its `eq` would be a 400).

import { expect, test } from "../fixtures";

import { addFilterPill, gotoTable } from "../helpers";

test.describe("Section 4 — Array of a union in the filter bar", () => {
  test("4.60: an existence-only array column shows the exists input, no picker, no 400", async ({
    page,
  }) => {
    const rejected: string[] = [];
    page.on("response", (res) => {
      if (res.status() === 400) rejected.push(res.url());
    });

    await gotoTable(page, "tasks");
    const pill = await addFilterPill(page, "Labels");
    const input = pill.locator(".as-filter-field-search");
    await input.click();

    await expect(page.locator(".as-filter-field-dropdown")).toHaveCount(0);
    // the plain free-text input, not the picker's combobox
    await expect(input).not.toHaveAttribute("role", "combobox");
    expect(rejected).toEqual([]);
  });
});
