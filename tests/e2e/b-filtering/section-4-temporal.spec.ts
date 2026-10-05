// Section 4 — Filtering: date / date-time filters on timestamp columns (0.1.148).
//
// `number.timestamp` columns (`createdAt`, `shippedAt` on /orders) used to get
// a text filter the server refuses (`$regex` on an integer, a date string
// against epoch ms). They now get a date filter: the model stays calendar
// terms (`2026-10-05`, `today-6`), and the query is encoded to epoch-ms bounds
// in the table's time zone. These specs run against the real filter-value
// guard of the demo's atscript-db server, so a 400 fails them.
//
// The browser runs in Europe/Berlin on a pinned clock; the expected bounds are
// derived independently here with `Intl` (a wall-clock midnight in the zone).

import { type Locator, type Page, expect, test } from "../fixtures";

import {
  addFilterPill,
  commitPillInput,
  countRows,
  expectNoPages,
  expectSinglePages,
  expectUrlQuery,
  gotoTable,
  resetSeed,
} from "../helpers";

test.use({ timezoneId: "Europe/Berlin", locale: "en-US" });

const ZONE = "Europe/Berlin";
/** Pinned browser clock: shortly before the seed's own clock reading. */
const NOW = Date.now();

/** Wall clock of `ms` in `zone`, as `YYYY-MM-DD HH:mm`. */
function wall(ms: number, zone = ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** The `field>=A` / `field<B` / `field>=A` integers of a wire URL. */
function bounds(url: string, field: string): { gte?: number; lt?: number } {
  const decoded = decodeURIComponent(url);
  const num = (re: RegExp) => {
    const m = re.exec(decoded);
    return m ? Number(m[1]) : undefined;
  };
  return {
    gte: num(new RegExp(`${field}>=(\\d+)`)),
    lt: num(new RegExp(`${field}<(\\d+)`)),
  };
}

async function openDialog(page: Page, label: string): Promise<{ pill: Locator; dialog: Locator }> {
  const pill = await addFilterPill(page, label);
  await pill.locator(".as-filter-field-search").focus();
  await pill.locator(".as-filter-field-f4").click();
  const dialog = page.locator(".as-filter-dialog-content");
  await expect(dialog).toBeVisible();
  return { pill, dialog };
}

async function apply(dialog: Locator) {
  await dialog.locator(".as-filter-btn-apply").click();
  await expect(dialog).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe("Section 4.12 — Date-time filters on timestamp columns", () => {
  test("Last 7 days: exact Berlin-midnight bounds, no 400, chip, relative URL, reload", async ({
    page,
  }) => {
    await gotoTable(page, "orders");
    const { pill, dialog } = await openDialog(page, "Created");
    await dialog.locator(".as-filter-shortcut-btn", { hasText: "Last 7 days" }).click();

    const responsePromise = page.waitForResponse(
      (r) => /\/pages\?/u.test(r.url()) && decodeURIComponent(r.url()).includes("createdAt>="),
    );
    const captured = await expectSinglePages(page, () => apply(dialog), { table: "orders" });
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    const { gte, lt } = bounds(captured.url, "createdAt");
    expect(typeof gte, captured.url).toBe("number");
    expect(typeof lt, captured.url).toBe("number");
    // Both bounds are Berlin midnights, a week apart (±1h across a DST change).
    expect(wall(gte!).endsWith("00:00")).toBe(true);
    expect(wall(lt!).endsWith("00:00")).toBe(true);
    expect(Math.abs((lt! - gte!) / 86_400_000 - 7)).toBeLessThanOrEqual(1 / 24 + 1e-9);
    // `lt` is the midnight after today on the pinned clock.
    expect(wall(lt! - 1).slice(0, 10)).toBe(wall(NOW).slice(0, 10));

    // The row count equals a direct query of the same range.
    const shown = ((await response.json()) as { count: number }).count;
    expect(await countRows(page, "orders", `createdAt>=${gte}&createdAt<${lt}`)).toBe(shown);

    await expect(pill.locator(".as-filter-field-chip")).toHaveText(/Last 7 days/u);

    // The URL carries the relative form, so a shared link stays relative.
    expectUrlQuery(page, ["createdAt>='today-6'", "createdAt<="]);
    expect(decodeURIComponent(page.url())).not.toMatch(/createdAt[<>=]+\d{9,}/u);

    // Reload restores the chip and sends the same bounds.
    const reloaded = page.waitForRequest(
      (r) =>
        /\/orders\/pages\?/u.test(r.url()) && decodeURIComponent(r.url()).includes("createdAt>="),
    );
    await page.reload();
    const again = bounds((await reloaded).url(), "createdAt");
    expect(again.gte).toBe(gte);
    expect(again.lt).toBe(lt);
    await expect(
      pill.or(page.locator(".as-filter-field")).locator(".as-filter-field-chip").first(),
    ).toHaveText(/Last 7 days/u);
  });

  test("a specific date through the date input: chip 'on <date>', bounds cover that day", async ({
    page,
  }) => {
    await gotoTable(page, "orders");
    const { pill, dialog } = await openDialog(page, "Created");
    const input = dialog.locator(".as-filter-input-temporal input[type=date]");
    await input.fill("2026-10-05");
    const captured = await expectSinglePages(page, () => apply(dialog), { table: "orders" });

    const { gte, lt } = bounds(captured.url, "createdAt");
    expect(gte).toBe(Date.UTC(2026, 9, 4, 22)); // Oct 5 00:00 CEST
    expect(lt).toBe(Date.UTC(2026, 9, 5, 22)); // Oct 6 00:00 CEST
    await expect(pill.locator(".as-filter-field-chip")).toHaveText(/on Oct 5, 2026/u);
  });

  test("the time toggle: 'after 2026-10-05 14:30' sends minute precision", async ({ page }) => {
    await gotoTable(page, "orders");
    const { pill, dialog } = await openDialog(page, "Created");
    await dialog.locator(".as-filter-condition-select").selectOption("gt");
    const toggle = dialog.locator(".as-filter-input-time-toggle");
    await expect(toggle).toHaveAttribute("aria-label", "Pick a time");
    await toggle.click();
    await dialog
      .locator(".as-filter-input-temporal input[type=datetime-local]")
      .fill("2026-10-05T14:30");
    const captured = await expectSinglePages(page, () => apply(dialog), { table: "orders" });

    // `after 14:30` starts at the end of that minute: 14:31 Berlin = 12:31Z.
    expect(bounds(captured.url, "createdAt").gte).toBe(Date.UTC(2026, 9, 5, 12, 31));
    await expect(pill.locator(".as-filter-field-chip")).toHaveText(/after Oct 5, 2026, 14:30/u);
  });

  test("a nullable timestamp offers 'is empty'; a required one does not", async ({ page }) => {
    await gotoTable(page, "orders");

    const created = await openDialog(page, "Created");
    const createdOps = await created.dialog
      .locator(".as-filter-condition-select option")
      .allTextContents();
    expect(createdOps).not.toContain("is empty");
    expect(createdOps).not.toContain("is not empty");
    await created.dialog.locator(".as-filter-dialog-close").click();
    await expect(created.dialog).toHaveCount(0);

    const shipped = await openDialog(page, "Shipped At");
    await shipped.dialog.locator(".as-filter-condition-select").selectOption("null");
    const captured = await expectSinglePages(page, () => apply(shipped.dialog), {
      table: "orders",
    });
    expect(decodeURIComponent(captured.url)).toMatch(/exists=shippedAt/u);
    expect(decodeURIComponent(captured.url)).toContain("!exists");
  });

  test("filter bar: '>=2026-01-01' applies; 'abc' sends nothing", async ({ page }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Created");
    await expect(pill.locator(".as-filter-field-search")).toHaveAttribute(
      "placeholder",
      "YYYY-MM-DD",
    );

    const captured = await expectSinglePages(page, () => commitPillInput(pill, ">=2026-01-01"), {
      table: "orders",
    });
    expect(bounds(captured.url, "createdAt").gte).toBe(Date.UTC(2025, 11, 31, 23));
    await expect(pill.locator(".as-filter-field-chip")).toHaveText(/on or after Jan 1, 2026/u);

    await expectNoPages(page, () => commitPillInput(pill, "abc"), { table: "orders" });
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(1);
  });

  test("changing the preferences time zone shifts the bounds", async ({ page }) => {
    try {
      // The table reads the zone from the user's app preferences (the cell
      // locale): write it to the server and mirror it into the paint cache.
      const post = await page.request.post("/api/db/_presets", {
        data: { type: "appConf", app: "vuedemo", data: { timezone: "Pacific/Auckland" } },
        headers: { "content-type": "application/json" },
      });
      expect(post.ok()).toBe(true);
      await page.addInitScript(() => {
        localStorage.setItem(
          "as-app-prefs:vuedemo",
          JSON.stringify({ timezone: "Pacific/Auckland" }),
        );
      });

      await gotoTable(page, "orders");
      const { dialog } = await openDialog(page, "Created");
      await dialog.locator(".as-filter-input-temporal input[type=date]").fill("2026-10-05");
      const captured = await expectSinglePages(page, () => apply(dialog), { table: "orders" });
      const { gte, lt } = bounds(captured.url, "createdAt");
      // Oct 5 in Auckland (NZDT, UTC+13) starts Oct 4 11:00Z.
      expect(gte).toBe(Date.UTC(2026, 9, 4, 11));
      expect(lt).toBe(Date.UTC(2026, 9, 5, 11));
    } finally {
      // Preferences live on the server (`_presets`): wipe them so the zone
      // does not leak into later specs.
      await resetSeed();
    }
  });
});

test.describe("Section 4.13 — Typed filter inputs (regressions)", () => {
  test("clearing a number input leaves no filter (never `= 0`)", async ({ page }) => {
    await gotoTable(page, "orders");
    const { pill, dialog } = await openDialog(page, "Total");
    const input = dialog
      .locator(".as-filter-input-temporal, .as-filter-input")
      .locator("visible=true")
      .first();
    await input.fill("5");
    await input.fill("");
    // Applying an unfilled box must not put `total = 0` on the wire.
    const sent: string[] = [];
    page.on("request", (r) => {
      if (/\/orders\/pages\?/u.test(r.url())) sent.push(decodeURIComponent(r.url()));
    });
    await apply(dialog);
    await page.waitForTimeout(900);
    expect(sent.filter((u) => /total[<>=!]/u.test(u))).toEqual([]);
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(0);
  });

  test("a numeric `ref` column (Customer) offers no pattern operators", async ({ page }) => {
    await gotoTable(page, "orders");
    const { dialog } = await openDialog(page, "Customer");
    await dialog.locator(".as-config-tab-trigger", { hasText: "Conditions" }).click();
    const ops = await dialog.locator(".as-filter-condition-select option").allTextContents();
    expect(ops).toContain("equals");
    for (const word of ["contains", "starts with", "ends with", "matches pattern"]) {
      expect(ops).not.toContain(word);
    }
  });
});
