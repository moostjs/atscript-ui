// Section 6.8 — URL bridge: hand-written deep links (atscript-ui 0.1.147).
//
// Covers:
//   - 6.8.1 A typed `?status=in-progress` link filters the table. The value's
//     `-` used to make `@uniqu/url` reject the whole query string, and the
//     table silently dropped every part of the link.
//   - 6.8.2 A segment that does not parse is left out and reported (the
//     demo binds no `@unsupported-filter`, so the dev-mode warning is the
//     report); the rest of the link still applies.
//
// Read-only: compares against the server's own count at test time, so the
// mutating task suites (8b, 40) may run before or after it.

import { type Page, expect, test } from "../fixtures";

import { countRows, expectSinglePages } from "../helpers";

function collectWarnings(page: Page): string[] {
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  return warnings;
}

async function expectAllRowsInProgress(page: Page): Promise<void> {
  const badges = page.locator("table[data-as-main-table] tbody .as-status-badge");
  await expect(badges.first()).toBeVisible();
  for (const text of await badges.allTextContents()) expect(text.trim()).toBe("in-progress");
}

test.describe("Section 6.8 — Hand-written deep links", () => {
  test("6.8.1 /tasks?status=in-progress filters the table in one /pages", async ({ page }) => {
    const expected = await countRows(page, "tasks", "status=in-progress");
    expect(expected).toBeGreaterThan(0);
    const warnings = collectWarnings(page);

    const captured = await expectSinglePages(
      page,
      async () => {
        await page.goto("/tasks?status=in-progress");
        await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
      },
      { table: "tasks" },
    );
    expect(decodeURIComponent(captured.url)).toMatch(/status='?in-progress'?(?:&|$)/u);
    await expectAllRowsInProgress(page);
    expect(warnings.filter((w) => w.includes("URL filter left out"))).toEqual([]);
  });

  test("6.8.2 an unparsable segment is left out with a warning; the rest still applies", async ({
    page,
  }) => {
    const warnings = collectWarnings(page);

    const captured = await expectSinglePages(
      page,
      async () => {
        await page.goto("/tasks?status=in-progress&priority>>2");
        await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
      },
      { table: "tasks" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toMatch(/status='?in-progress'?(?:&|$)/u);
    expect(decoded).not.toMatch(/priority>/u);
    await expectAllRowsInProgress(page);
    expect(warnings.filter((w) => w.includes("URL filter left out"))).toEqual([
      expect.stringContaining("URL filter left out (syntax): priority>>2"),
    ]);
  });
});
