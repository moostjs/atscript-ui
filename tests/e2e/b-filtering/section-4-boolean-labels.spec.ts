// Section 4 — Boolean labels (`users.mfaEnabled`: `@ui.literalLabel 'true', 'Enabled'` /
// `'false', 'Disabled'`). A boolean column is a two-value picker worded by its labels;
// the filter it sends stays a real boolean, and the cells read the labels.

import type { Locator, Page, Request } from "@playwright/test";

import { expect, test } from "../fixtures";

import { addFilterPill, gotoTable } from "../helpers";

/** The next `users` page query whose filter mentions `mfaEnabled`, decoded. */
function nextMfaQuery(page: Page): Promise<Request> {
  return page.waitForRequest(
    (req) =>
      req.url().includes("/api/db/tables/users/pages") &&
      decodeURIComponent(req.url()).includes("mfaEnabled"),
  );
}

/** Non-empty cell texts (selection / filler cells carry none). */
async function cellTexts(cells: Locator): Promise<string[]> {
  return (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean);
}

test.describe("Section 4 — Boolean labels", () => {
  test("4.70: the picker lists the labels; typing a label + Enter filters by the boolean", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "MFA Enabled");
    const input = pill.locator(".as-filter-field-search");
    await input.click();

    const dropdown = page.locator(".as-filter-field-dropdown");
    await expect(dropdown).toBeVisible();
    await expect
      .poll(() => cellTexts(dropdown.locator("tbody tr td")))
      .toEqual(["Enabled", "Disabled"]);

    const query = nextMfaQuery(page);
    await input.pressSequentially("Disa");
    await input.press("Enter");
    expect(decodeURIComponent((await query).url())).toContain("mfaEnabled=false");
    await page.keyboard.press("Escape");
    await expect(pill.locator(".as-filter-field-chip")).toHaveText(["Disabled"]);

    // the MFA column's cells read the label of `false`, not a check mark (once the
    // filtered page has rendered)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const th = document.querySelector("th[data-column-path='mfaEnabled']");
          if (!th?.parentElement) return [];
          const index = [...th.parentElement.children].indexOf(th);
          return [
            ...new Set(
              [...document.querySelectorAll("tbody tr")]
                .map((tr) => tr.children[index]?.textContent?.trim() ?? "")
                .filter(Boolean),
            ),
          ];
        }),
      )
      .toEqual(["Disabled"]);
  });

  test("4.71: text the picker does not list is a condition (`!=Enabled`)", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "MFA Enabled");
    const input = pill.locator(".as-filter-field-search");
    await input.click();

    const query = nextMfaQuery(page);
    await input.pressSequentially("!=Enabled");
    await input.press("Enter");
    expect(decodeURIComponent((await query).url())).toContain("mfaEnabled!=true");
    await page.keyboard.press("Escape");
    await expect(pill.locator(".as-filter-field-chip")).toHaveText(["!=Enabled"]);
  });
});
