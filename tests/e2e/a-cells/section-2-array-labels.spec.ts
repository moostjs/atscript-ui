// Section 2 — Cells: an array of a labelled literal union (`tasks.labels`).
//
// `labels?: ('bug' | 'feature' | 'chore')[]` carries `@ui.literalLabel` labels for two of
// its three literals. The column takes the literal options from the array's element type,
// so each cell lists the labels of its elements (the unlabelled `chore` keeps its raw text).
//
// Seed facts used (tasks): labels cycle `[bug]`, `[feature]`, `[bug, feature]`, `[chore]` by
// task id, and every 5th task has none.

import { expect, test } from "../fixtures";

import { columnCellIndex, gotoTable } from "../helpers";

test.describe("Section 2 — Array of a labelled union", () => {
  test("2.20: each cell lists the labels of the array's elements", async ({ page }) => {
    await gotoTable(page, "tasks");
    const table = page.locator("table.as-table").first();
    const idx = await columnCellIndex(table, "labels");
    const labelsOf = async (n: number) => {
      const row = table.locator("tbody tr").filter({ hasText: new RegExp(` #${n}(?!\\d)`, "u") });
      await expect(row).toHaveCount(1);
      return (await row.locator("td").nth(idx).locator(".as-cell-chip").allInnerTexts()).join(", ");
    };

    expect(await labelsOf(1)).toBe("Defect");
    expect(await labelsOf(2)).toBe("Feature request");
    expect(await labelsOf(3)).toBe("Defect, Feature request");
    // an unlabelled literal keeps its raw text
    expect(await labelsOf(4)).toBe("chore");
  });
});
