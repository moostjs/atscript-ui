// Section 4 — Filtering: date conditions from a deep link, and `string.date` /
// `string.isoDate` columns (0.1.148).
//
// Every condition source reaches the server through one encoder. A deep link
// whose second range on a field the field-filter model cannot hold is carried
// as a residual condition: it used to be sent raw (`createdAt>='2026-10-01'`),
// which the server's integer guard answers with a 400. These specs run against
// the real filter-value guard of the demo's atscript-db server.
//
// Seed facts used (tasks): `dueOn` (`string.date`) is 2026-10-<i> for task i
// (rolling into November past the 31st), absent for every 5th task; `reviewedAt`
// (`string.isoDate`) is an ISO date-time, absent for every 4th task.

import type { Response } from "@playwright/test";

import { type Page, expect, test } from "../fixtures";

import { addFilterPill, commitPillInput, countRows, expectSinglePages } from "../helpers";

test.use({ timezoneId: "Europe/Berlin", locale: "en-US" });

const isPages = (table: string) => (r: Response) =>
  new RegExp(`/api/db/tables/${table}/pages\\?`, "u").test(r.url());

/** Open `url` and return the first `/pages` response of `table` (never a 400). */
async function openAndRead(page: Page, url: string, table: string) {
  const responsePromise = page.waitForResponse(isPages(table));
  await page.goto(url);
  const response = await responsePromise;
  await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
  return {
    response,
    wire: decodeURIComponent(response.url()),
    body: (await response.json()) as { count: number; data: Record<string, unknown>[] },
  };
}

test.describe("Section 4.14 — Date conditions from a deep link", () => {
  test("a two-sided range on a timestamp column is typed, not sent raw (no 400)", async ({
    page,
  }) => {
    const { response, wire, body } = await openAndRead(
      page,
      "/orders?createdAt>='2026-10-01'&createdAt<'2026-10-05'",
      "orders",
    );
    expect(response.status()).toBe(200);

    // Berlin midnights as epoch ms; the raw date text never reaches the wire.
    const from = Date.UTC(2026, 8, 30, 22); // Oct 1 00:00 CEST
    const to = Date.UTC(2026, 9, 4, 22); // Oct 5 00:00 CEST
    expect(wire).toContain(`createdAt>=${from}`);
    expect(wire).toContain(`createdAt<${to}`);
    expect(wire).not.toContain("2026-10-0");

    // The table shows what a direct query of the same range returns.
    expect(await countRows(page, "orders", `createdAt>=${from}&createdAt<${to}`)).toBe(body.count);
  });

  test("a single bound and a bare value from a link are typed too", async ({ page }) => {
    const gte = await openAndRead(page, "/orders?createdAt>='2026-10-01'", "orders");
    expect(gte.response.status()).toBe(200);
    expect(gte.wire).toContain(`createdAt>=${Date.UTC(2026, 8, 30, 22)}`);

    const eq = await openAndRead(page, "/orders?createdAt='2026-10-05'", "orders");
    expect(eq.response.status()).toBe(200);
    expect(eq.wire).toContain(`createdAt>=${Date.UTC(2026, 9, 4, 22)}`);
    expect(eq.wire).toContain(`createdAt<${Date.UTC(2026, 9, 5, 22)}`);
  });
});

test.describe("Section 4.15 — string.date and string.isoDate columns", () => {
  test("`string.date`: a deep-link range filters by calendar day (4 of the seeded tasks)", async ({
    page,
  }) => {
    const { response, wire, body } = await openAndRead(
      page,
      "/tasks?dueOn>='2026-10-03'&dueOn<'2026-10-08'",
      "tasks",
    );
    expect(response.status()).toBe(200);
    // days 3, 4, 6, 7 (task 5 has no due date)
    expect(body.count).toBe(4);
    expect(body.data.map((r) => r.dueOn as string).toSorted((a, b) => a.localeCompare(b))).toEqual([
      "2026-10-03",
      "2026-10-04",
      "2026-10-06",
      "2026-10-07",
    ]);
    expect(wire).toMatch(/dueOn>='2026-10-03'/u);
  });

  test("`string.date`: the filter bar and the dialog send day bounds and show a date chip", async ({
    page,
  }) => {
    await page.goto("/tasks");
    await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
    const pill = await addFilterPill(page, "Due on");
    await expect(pill.locator(".as-filter-field-search")).toHaveAttribute(
      "placeholder",
      "YYYY-MM-DD",
    );

    const response = page.waitForResponse(
      (r) => isPages("tasks")(r) && decodeURIComponent(r.url()).includes("dueOn"),
    );
    await commitPillInput(pill, "2026-10-06");
    const res = await response;
    expect(res.status()).toBe(200);
    const wire = decodeURIComponent(res.url());
    expect(wire).toContain("dueOn>='2026-10-06'");
    expect(wire).toContain("dueOn<'2026-10-07'");
    expect(((await res.json()) as { data: { dueOn: string }[] }).data.map((r) => r.dueOn)).toEqual([
      "2026-10-06",
    ]);
    await expect(pill.locator(".as-filter-field-chip")).toHaveText(/Oct 6, 2026/u);
  });

  test("`string.isoDate`: a deep-link range is sent as ISO instants and the server accepts it", async ({
    page,
  }) => {
    const { response, wire, body } = await openAndRead(
      page,
      "/tasks?reviewedAt>='2026-10-05'&reviewedAt<'2026-10-08'",
      "tasks",
    );
    expect(response.status()).toBe(200);
    // Berlin midnights as ISO strings
    const from = new Date(Date.UTC(2026, 9, 4, 22)).toISOString();
    const to = new Date(Date.UTC(2026, 9, 7, 22)).toISOString();
    expect(wire).toContain(`reviewedAt>='${from}'`);
    expect(wire).toContain(`reviewedAt<'${to}'`);
    expect(body.count).toBeGreaterThan(0);
    for (const row of body.data) {
      const t = Date.parse(row.reviewedAt as string);
      expect(t).toBeGreaterThanOrEqual(Date.parse(from));
      expect(t).toBeLessThan(Date.parse(to));
    }
  });

  test("`string.isoDate`: the date dialog filters in one /pages", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
    const pill = await addFilterPill(page, "Reviewed at");
    const captured = await expectSinglePages(page, () => commitPillInput(pill, ">=2026-10-10"), {
      table: "tasks",
    });
    expect(decodeURIComponent(captured.url)).toContain(
      `reviewedAt>='${new Date(Date.UTC(2026, 9, 9, 22)).toISOString()}'`,
    );
    await expect(pill.locator(".as-filter-field-chip")).toHaveText(/on or after Oct 10, 2026/u);
  });
});
