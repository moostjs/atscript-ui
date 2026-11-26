// Section 5 (forms) — the picker dialog of a reference field, and codes shown with their
// text (0.1.190).
//
// Demo wiring (`packages/vue-demo/src/client/pages/forms-demo/schemas/value-help.as`,
// page `/forms-demo/value-help`, second form `value-help-dialog-form`, `AsRefPicker` for
// the `ref` type), on the demo's city dictionary (`/api/db/tables/cities`, 30 cities,
// searchable by name):
//   - `city` — `@ui.valueHelp CityDict, 'code', `country = OfficePickerForm.country``,
//     columns code / name / country / region, fills `cityName` and `country`,
//     `@ui.valueLabel 'cityName'`;
//   - `headOffice` — read-only, `@ui.valueLabel 'headOfficeName', 'keyText'`.
// The form starts with `country: 'DE'`, `city: 'MUC'` (Munich), `headOffice: 'BER'`.
// Below it, the offices table (`/api/db/tables/offices`): its City column is a code
// shown with its name, and the page exports it (`offices-export`).

import { type Locator, type Page, expect, test } from "../fixtures";

const CITIES = /\/api\/db\/tables\/cities\/(query|pages)\?/;

function fieldOf(page: Page, label: string): Locator {
  return page.getByTestId("value-help-dialog-form").locator(".as-default-field", {
    has: page.locator(".as-field-label", { hasText: new RegExp(`^${label}$`) }),
  });
}

const preview = (page: Page) => page.getByTestId("value-help-dialog-preview");
const dialog = (page: Page) => page.locator(".as-value-help-dialog-content");

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/value-help");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Value help", level: 1 })).toBeVisible();
}

test.describe("Section 5 (forms) — the picker dialog of a reference field", () => {
  test("lists the country's cities with the binding's columns; a double-click picks and fills", async ({
    page,
  }) => {
    // the combobox searches as soon as it mounts: wait for it from before the navigation
    const combobox = page.waitForRequest((r) => CITIES.test(r.url()));
    await gotoDemo(page);
    await combobox;

    const scoped = page.waitForRequest(
      (r) =>
        /\/api\/db\/tables\/cities\/pages\?/.test(r.url()) &&
        decodeURIComponent(r.url()).includes("country=DE"),
    );
    await fieldOf(page, "City").getByRole("button", { name: "Browse City" }).click();
    await expect(dialog(page)).toBeVisible();
    // the select rule: the committed field, the dictionary view, the columns, the fills
    expect(decodeURIComponent((await scoped).url())).toMatch(/\$select=.*region/);
    await expect(dialog(page).getByRole("heading", { name: "City" })).toBeVisible();
    const headers = dialog(page).locator("thead th");
    await expect(headers.filter({ hasText: /^Code$/ })).toHaveCount(1);
    await expect(headers.filter({ hasText: /^Region$/ })).toHaveCount(1);
    // the German cities only
    const rows = dialog(page).locator("tbody tr", { hasText: /[A-Z]{3}/ });
    await expect(rows.filter({ hasText: "Hamburg" })).toHaveCount(1);
    await expect(rows.filter({ hasText: /Paris|Rome|Madrid/ })).toHaveCount(0);

    await rows.filter({ hasText: "Hamburg" }).dblclick();
    await expect(dialog(page)).toHaveCount(0);
    await expect(preview(page)).toContainText('"city": "HAM"');
    await expect(preview(page)).toContainText('"cityName": "Hamburg"');
    await expect(preview(page)).toContainText('"country": "DE"');
    // the field reads as the code with its text again
    await expect(fieldOf(page, "City").locator(".as-ref-input")).toHaveValue("Hamburg (HAM)");
  });

  test("“See all” under the list carries the typed text into the dialog's search; Enter picks", async ({
    page,
  }) => {
    const combobox = page.waitForRequest((r) => CITIES.test(r.url()));
    await gotoDemo(page);
    await combobox;
    const input = fieldOf(page, "City").locator(".as-ref-input");
    await input.click();
    await input.fill("Leipzig");
    await expect(page.locator(".as-ref-item", { hasText: "Leipzig" })).toHaveCount(1);

    const searched = page.waitForRequest(
      (r) =>
        /\/api\/db\/tables\/cities\/pages\?/.test(r.url()) &&
        decodeURIComponent(r.url()).includes("Leipzig"),
    );
    // no count: the entry is there however many cities match
    await page.getByRole("button", { name: "See all" }).click();
    await searched;
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator(".as-filter-value-help-search")).toHaveValue("Leipzig");
    await expect(page.locator(".as-ref-content")).toHaveCount(0);

    const search = dialog(page).locator(".as-filter-value-help-search");
    await expect(dialog(page).locator("tbody tr", { hasText: "Leipzig" })).toHaveCount(1);
    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(dialog(page)).toHaveCount(0);
    await expect(preview(page)).toContainText('"city": "LEJ"');
    await expect(preview(page)).toContainText('"cityName": "Leipzig"');
  });
});

test.describe("Section 5 (forms) — a code shown with its text (@ui.valueLabel)", () => {
  test("the reference field shows the text while not focused, the code while focused; read-only too", async ({
    page,
  }) => {
    await gotoDemo(page);
    const input = fieldOf(page, "City").locator(".as-ref-input");
    await expect(input).toHaveValue("Munich (MUC)");
    await input.focus();
    await expect(input).toHaveValue("MUC");
    await page.keyboard.press("Escape");
    await fieldOf(page, "Country").locator("select").focus();
    await expect(input).toHaveValue("Munich (MUC)");
    // read-only, code first
    await expect(fieldOf(page, "Head office").locator("input")).toHaveValue("BER (Berlin)");
  });

  test("a table column shows the code with its text and exports it so; an empty text shows the code", async ({
    page,
  }) => {
    const offices = page.waitForRequest((r) => /\/api\/db\/tables\/offices\/pages\?/.test(r.url()));
    await gotoDemo(page);
    // the text is fetched with the code
    expect(decodeURIComponent((await offices).url())).toMatch(/\$select=.*cityName/);
    const table = page.getByTestId("offices-table");
    await expect(table.locator("tbody td", { hasText: /^Berlin \(BER\)$/ })).toHaveCount(1);
    await expect(table.locator("tbody td", { hasText: /^Lyon \(LYS\)$/ })).toHaveCount(1);
    await expect(table.locator("tbody td", { hasText: /^MAD$/ })).toHaveCount(1);
    // the text is no column of its own
    await expect(table.locator("thead th", { hasText: /^City name$/ })).toHaveCount(0);

    await table.getByRole("button", { name: "Export CSV" }).click();
    const csv = page.getByTestId("offices-export");
    await expect(csv).toContainText("Berlin (BER)");
    await expect(csv).toContainText("Hamburg (HAM)");
    await expect(csv).toContainText("MAD");
  });
});
