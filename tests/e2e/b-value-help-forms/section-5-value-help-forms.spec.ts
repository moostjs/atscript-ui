// Section 5 (forms) — values of the form narrow a picker, picks fill other fields,
// a dropdown lists a small dictionary (0.1.190).
//
// Demo wiring (`packages/vue-demo/src/client/pages/forms-demo/schemas/value-help.as`,
// page `/forms-demo/value-help`), on the demo's attribute dictionary
// (`/api/db/tables/attribute-values`, composite key attribute + value):
//   - `value` — `@ui.valueHelp AttributeDict, 'value', `attribute = VariantPickerForm.attribute
//     and active = true``, fills `valueLabel` ← label and `attribute` ← attribute;
//   - `color` — `@ui.form.type 'select'` on `attribute = 'color'`, fills `colorLabel`.
// The form starts with `attribute: 'size'`. The page prints the form data
// (`value-help-preview`) and every committed edit (`value-help-changes`).

import { type Locator, type Page, expect, test } from "../fixtures";

const DICT = /\/api\/db\/tables\/attribute-values\/query\?/;

function fieldOf(page: Page, label: string): Locator {
  return page.getByTestId("value-help-form").locator(".as-default-field", {
    has: page.locator(".as-field-label", { hasText: new RegExp(`^${label}$`) }),
  });
}

const preview = (page: Page) => page.getByTestId("value-help-preview");
const changes = (page: Page) => page.getByTestId("value-help-changes");

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/value-help");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Value help", level: 1 })).toBeVisible();
}

test.describe("Section 5 (forms) — a picker narrowed by a value of the form", () => {
  test("the picker lists the chosen attribute's values; a pick commits at once and fills", async ({
    page,
  }) => {
    // the picker searches as soon as it mounts, with the host value
    const scoped = page.waitForRequest(
      (r) => DICT.test(r.url()) && decodeURIComponent(r.url()).includes("attribute=size"),
    );
    await gotoDemo(page);
    const value = fieldOf(page, "Value");
    const req = decodeURIComponent((await scoped).url());
    await value.locator(".as-no-data").click();
    expect(req).toContain("active=true");
    // the select of every value-help read: key, label, the committed field, columns, fill targets
    expect(req).toMatch(/\$select=.*label/);

    const input = value.locator(".as-ref-input");
    await input.click();
    const items = page.locator(".as-ref-item");
    // the active sizes only (the inactive XL is left out), no other attribute
    await expect(items).toHaveCount(3);
    await expect(items.filter({ hasText: /Red|Support|Extra large/ })).toHaveCount(0);

    await items.filter({ hasText: "Medium" }).click();
    // committed with the pick itself, not on a later blur; the fill is an edit of its own
    await expect(changes(page)).toContainText("update:value");
    await expect(changes(page)).toContainText("update:valueLabel");
    await expect(preview(page)).toContainText('"value": "M"');
    await expect(preview(page)).toContainText('"valueLabel": "Medium"');
    await expect(preview(page)).toContainText('"attribute": "size"');
  });

  test("a changed host value re-scopes the picker; × clears the filled label, keeps the host field", async ({
    page,
  }) => {
    await gotoDemo(page);
    const value = fieldOf(page, "Value");
    await value.locator(".as-no-data").click();
    const input = value.locator(".as-ref-input");
    await input.click();
    await page.locator(".as-ref-item", { hasText: "Large" }).click();
    await expect(preview(page)).toContainText('"valueLabel": "Large"');

    // the attribute changes: the next open lists the colours
    await page.keyboard.press("Escape");
    const recolored = page.waitForRequest(
      (r) => DICT.test(r.url()) && decodeURIComponent(r.url()).includes("attribute=color"),
    );
    await fieldOf(page, "Attribute").locator("select").selectOption("color");
    await input.click();
    await recolored;
    const items = page.locator(".as-ref-item");
    await expect(items).toHaveCount(4);
    await expect(items.filter({ hasText: "Blue" })).toHaveCount(1);
    await page.keyboard.press("Escape");

    await value.getByRole("button", { name: "Clear Value" }).click();
    await expect(preview(page)).not.toContainText('"valueLabel"');
    await expect(preview(page)).not.toContainText('"value": "L"');
    // the attribute narrows the picker (and was filled too): a clear keeps it
    await expect(preview(page)).toContainText('"attribute": "color"');
  });
});

test.describe("Section 5 (forms) — a dropdown from a dictionary", () => {
  test("lists the colours after an empty option; a choice fills the label; the empty option clears it", async ({
    page,
  }) => {
    // the dropdown reads its values as soon as it mounts: one read, capped one past 200
    const read = page.waitForRequest(
      (r) =>
        DICT.test(r.url()) &&
        decodeURIComponent(r.url()).includes("attribute=color") &&
        decodeURIComponent(r.url()).includes("$limit=201"),
    );
    await gotoDemo(page);
    const color = fieldOf(page, "Color");
    await read;
    await color.locator(".as-no-data").click();

    const select = color.locator("select");
    await expect(select.locator("option")).toHaveCount(5);
    await expect(select.locator("option").first()).toHaveText("");
    const labels = (await select.locator("option").allTextContents()).map((t) => t.trim());
    expect(labels.toSorted()).toEqual(["", "Black", "Blue", "Green", "Red"]);

    await select.selectOption("blue");
    await expect(preview(page)).toContainText('"color": "blue"');
    await expect(preview(page)).toContainText('"colorLabel": "Blue"');

    await select.selectOption({ index: 0 });
    await expect(preview(page)).not.toContainText('"color": "blue"');
    await expect(preview(page)).not.toContainText('"colorLabel"');
  });
});
