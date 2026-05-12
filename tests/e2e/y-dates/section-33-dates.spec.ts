// Section 33 — Dates Showcase.
//
// Exercises the AsDate / AsDatetime / AsTime default renderers rendered in
// `packages/vue-demo/src/client/pages/forms-demo/dates.vue` against the
// `DatesShowcaseForm` schema. Coverage:
//
//   birthDate   string  @ui.type 'date'     required   → <input type=date>
//   eventDate   number  @ui.type 'date'     optional   → <input type=date>
//                       (number.timestamp, explicit override wins per
//                        precedence chain `uiType ?? ... ?? tagType`)
//   meetingAt   number                       optional   → <input type=datetime-local>
//                       (number.timestamp default — no override needed)
//   appointment string  @ui.type 'datetime' optional   → <input type=datetime-local>
//   openingTime string  @ui.type 'time'     optional   → <input type=time>
//   closingTime string  @ui.type 'time'     required   → <input type=time>
//   range       [DateString, DateString]    optional   → tuple of 2 date inputs
//   milestones  DateString[]                optional   → array of date inputs
//
// Storage-shape contract (use-as-date.ts):
//   - Empty input commits null → optional clears, required leaves empty.
//   - 'time' kind ALWAYS commits string (HH:mm). Numeric storage isn't
//     meaningful for naked time-of-day.
//   - For 'date' / 'datetime', if previous value was a `string`, commit
//     stays a string; otherwise commits epoch-ms `number`. Atscript's
//     `number.timestamp` primitive flows undefined initially → first
//     commit lands as `number`.
//
// Preview block: `data-testid="dates-preview"` — `formData` is the
// `{ value: <domainData> }` wrapper, unwrap `.value`.
//
// Selector quirks (see earlier batches):
//   - Required-marker `*` leaks into accessible name via CSS `::after`,
//     so every label match tolerates `(\s*\*)?`.
//   - Optional primitives render `.as-no-data` placeholder; click to
//     reveal the editable input.
//   - Optional tuple / array render `.as-object-empty-add` "Add <Label>".

import { expect, test, type Locator, type Page } from "../fixtures";

const SEL_SUBMIT = ".as-submit-btn";
const SEL_ERROR_SLOT = ".as-error-slot";
const SEL_EMPTY_ADD = ".as-object-empty-add";
const SEL_NO_DATA = ".as-no-data, .as-no-data-textarea";
const SEL_FIELD_LABEL = ".as-field-label";
const SEL_REMOVE_BTN = ".as-field-remove-btn";

const LABEL_TAIL = "(\\s*\\*)?";

function labelRegex(text: string): RegExp {
  return new RegExp(`^${text}${LABEL_TAIL}$`);
}

const form = (page: Page): Locator => page.getByTestId("dates-form");

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/dates");
  await page.waitForLoadState("networkidle");
  await expect(form(page).locator(SEL_SUBMIT)).toBeVisible();
}

async function readPreview(page: Page): Promise<Record<string, unknown>> {
  const raw = (await page.getByTestId("dates-preview").textContent()) ?? "{}";
  const parsed = JSON.parse(raw) as { value?: Record<string, unknown> };
  return parsed.value ?? {};
}

function fieldByLabel(page: Page, labelText: string): Locator {
  return form(page).getByLabel(labelRegex(labelText));
}

function fieldWrapperByLabel(page: Page, labelText: string): Locator {
  return form(page)
    .locator(".as-default-field", {
      has: page.locator(SEL_FIELD_LABEL, { hasText: labelRegex(labelText) }),
    })
    .first();
}

// Click the `.as-no-data` empty-state to reveal an optional primitive input.
async function enablePrimitive(page: Page, labelText: string): Promise<Locator> {
  await fieldWrapperByLabel(page, labelText).locator(SEL_NO_DATA).click();
  return fieldByLabel(page, labelText);
}

// `.as-object-empty-add` button text reads "Add <Label>".
function emptyAddBtn(page: Page, label: string): Locator {
  return form(page)
    .locator(SEL_EMPTY_ADD, { hasText: `Add ${label}` })
    .first();
}

// Open `<details>` for a revealed tuple/array by visible title.
function sectionByTitle(page: Page, title: string): Locator {
  return form(page)
    .locator(
      `details:has(> summary :is(.as-collapsible-title, .as-collapsible-title-nested):text-is("${title}"))`,
    )
    .first();
}

async function submit(page: Page): Promise<void> {
  await form(page).locator(SEL_SUBMIT).click();
}

async function expectErrorSlot(page: Page, hasText: string): Promise<void> {
  await expect(form(page).locator(SEL_ERROR_SLOT, { hasText })).toHaveCount(1);
}

// Returns the underlying HTML `type` attribute of an input matched by label.
async function inputTypeOf(page: Page, label: string): Promise<string | null> {
  return await fieldByLabel(page, label).getAttribute("type");
}

// Reveal an optional primitive, fill it, and commit on blur. Returns the input.
async function enableAndFill(page: Page, label: string, value: string): Promise<Locator> {
  const input = await enablePrimitive(page, label);
  await input.fill(value);
  await input.blur();
  return input;
}

// Click the optional-clear button and confirm the placeholder returned.
async function clearOptional(page: Page, label: string): Promise<void> {
  const wrapper = fieldWrapperByLabel(page, label);
  await wrapper.locator(SEL_REMOVE_BTN).click();
  await expect(wrapper.locator(SEL_NO_DATA)).toBeVisible();
}

// Open an optional tuple/array via its "Add <Label>" placeholder and return
// the revealed `<details>` section locator.
async function openCollection(page: Page, label: string): Promise<Locator> {
  await emptyAddBtn(page, label).click();
  const section = sectionByTitle(page, label);
  await expect(section).toBeVisible();
  return section;
}

test.describe("Section 33 — dates", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // ── Initial render & dispatch ────────────────────────────────────

  test("page renders form testid, preview block, and submit button", async ({ page }) => {
    await expect(form(page)).toBeVisible();
    await expect(page.getByTestId("dates-preview")).toBeAttached();
    await expect(form(page).locator(SEL_SUBMIT)).toBeVisible();
  });

  test("initial preview is minimal: only required string-storage fields auto-fill, optionals absent", async ({
    page,
  }) => {
    const preview = await readPreview(page);
    // Required string fields (birthDate, closingTime) auto-fill with the
    // empty-string default. Required number fields would auto-fill with 0
    // but there are none here. All other keys must be absent.
    expect(preview.eventDate ?? undefined).toBeUndefined();
    expect(preview.meetingAt ?? undefined).toBeUndefined();
    expect(preview.appointment ?? undefined).toBeUndefined();
    expect(preview.openingTime ?? undefined).toBeUndefined();
    expect(preview.range ?? undefined).toBeUndefined();
    expect(preview.milestones ?? undefined).toBeUndefined();
  });

  test("birthDate (required, @ui.type 'date' on string) renders <input type=date>", async ({
    page,
  }) => {
    const input = fieldByLabel(page, "Birth date");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("type", "date");
  });

  test("closingTime (required, @ui.type 'time' on string) renders <input type=time>", async ({
    page,
  }) => {
    const input = fieldByLabel(page, "Closing time");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("type", "time");
  });

  test("optional date/datetime/time fields render placeholders, not inputs, initially", async ({
    page,
  }) => {
    // eventDate / meetingAt / appointment / openingTime → AsNoData
    // placeholder (4 fields). range / milestones → AsObject/Array empty-add (2).
    await expect(form(page).locator(SEL_NO_DATA)).toHaveCount(4);
    await expect(form(page).locator(SEL_EMPTY_ADD)).toHaveCount(2);
  });

  // ── Type dispatch per optional field ────────────────────────────

  test("Event date placeholder → reveals <input type=date> (override beats number.timestamp tag)", async ({
    page,
  }) => {
    await enablePrimitive(page, "Event date");
    expect(await inputTypeOf(page, "Event date")).toBe("date");
  });

  test("Meeting at placeholder → reveals <input type=datetime-local> (default for number.timestamp)", async ({
    page,
  }) => {
    await enablePrimitive(page, "Meeting at");
    expect(await inputTypeOf(page, "Meeting at")).toBe("datetime-local");
  });

  test("Appointment placeholder → reveals <input type=datetime-local> (@ui.type 'datetime')", async ({
    page,
  }) => {
    await enablePrimitive(page, "Appointment");
    expect(await inputTypeOf(page, "Appointment")).toBe("datetime-local");
  });

  test("Opening time placeholder → reveals <input type=time>", async ({ page }) => {
    await enablePrimitive(page, "Opening time");
    expect(await inputTypeOf(page, "Opening time")).toBe("time");
  });

  // ── String storage shape (birthDate) ────────────────────────────

  test("birthDate fill → preview.value.birthDate is the literal YYYY-MM-DD string", async ({
    page,
  }) => {
    const input = fieldByLabel(page, "Birth date");
    await input.fill("2026-05-15");
    await input.blur();
    const preview = await readPreview(page);
    expect(preview.birthDate).toBe("2026-05-15");
    expect(typeof preview.birthDate).toBe("string");
  });

  // ── Numeric storage shape (eventDate / meetingAt) ───────────────

  test("eventDate (number.timestamp): enable + fill → preview.value.eventDate commits as a number", async ({
    page,
  }) => {
    await enableAndFill(page, "Event date", "2026-06-20");
    const preview = await readPreview(page);
    expect(typeof preview.eventDate).toBe("number");
    // Local-TZ midnight on the picked date. Assert via the `Date` round-trip
    // using local-TZ getters so the test isn't TZ-sensitive.
    const d = new Date(preview.eventDate as number);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June (0-indexed)
    expect(d.getDate()).toBe(20);
  });

  test("meetingAt (number.timestamp default datetime): enable + fill → preview.value.meetingAt is a number", async ({
    page,
  }) => {
    await enableAndFill(page, "Meeting at", "2026-07-01T10:30");
    const preview = await readPreview(page);
    expect(typeof preview.meetingAt).toBe("number");
    const d = new Date(preview.meetingAt as number);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(10);
    expect(d.getMinutes()).toBe(30);
  });

  // ── String datetime / time ──────────────────────────────────────

  test("appointment (datetime, string storage): enable + fill → preview value is the literal datetime string", async ({
    page,
  }) => {
    await enableAndFill(page, "Appointment", "2026-08-10T14:00");
    const preview = await readPreview(page);
    expect(preview.appointment).toBe("2026-08-10T14:00");
    expect(typeof preview.appointment).toBe("string");
  });

  test("openingTime (time, optional): enable + fill → preview value is the HH:mm string", async ({
    page,
  }) => {
    await enableAndFill(page, "Opening time", "09:30");
    const preview = await readPreview(page);
    expect(preview.openingTime).toBe("09:30");
    expect(typeof preview.openingTime).toBe("string");
  });

  test("closingTime (time, required): fill → preview value is the HH:mm string", async ({
    page,
  }) => {
    const input = fieldByLabel(page, "Closing time");
    await input.fill("18:00");
    await input.blur();
    const preview = await readPreview(page);
    expect(preview.closingTime).toBe("18:00");
    expect(typeof preview.closingTime).toBe("string");
  });

  // ── Validation ──────────────────────────────────────────────────

  test("submit empty form → both required errors surface", async ({ page }) => {
    await submit(page);
    await expectErrorSlot(page, "Birth date is required");
    await expectErrorSlot(page, "Closing time is required");
  });

  test("submit with both required fields filled → no error slots", async ({ page }) => {
    await fieldByLabel(page, "Birth date").fill("2026-05-15");
    await fieldByLabel(page, "Birth date").blur();
    await fieldByLabel(page, "Closing time").fill("18:00");
    await fieldByLabel(page, "Closing time").blur();
    await submit(page);
    await expect(form(page).locator(SEL_ERROR_SLOT)).toHaveCount(0);
  });

  // ── Optional clear ──────────────────────────────────────────────

  test("eventDate: enable + fill + clear → preview value absent", async ({ page }) => {
    await enableAndFill(page, "Event date", "2026-06-20");
    let preview = await readPreview(page);
    expect(typeof preview.eventDate).toBe("number");

    await clearOptional(page, "Event date");
    preview = await readPreview(page);
    expect(preview.eventDate ?? undefined).toBeUndefined();
  });

  test("openingTime: enable + fill + clear → preview value absent", async ({ page }) => {
    await enableAndFill(page, "Opening time", "09:30");
    let preview = await readPreview(page);
    expect(preview.openingTime).toBe("09:30");

    await clearOptional(page, "Opening time");
    preview = await readPreview(page);
    expect(preview.openingTime ?? undefined).toBeUndefined();
  });

  // ── Range tuple ─────────────────────────────────────────────────

  test("range: Add Date range reveals tuple of two <input type=date> elements", async ({
    page,
  }) => {
    const rangeSection = await openCollection(page, "Date range");
    await expect(rangeSection.locator('input[type="date"]')).toHaveCount(2);
  });

  test("range: fill both positions → preview.value.range === ['2026-09-01', '2026-09-30']", async ({
    page,
  }) => {
    const rangeSection = await openCollection(page, "Date range");
    const inputs = rangeSection.locator('input[type="date"]');
    await inputs.nth(0).fill("2026-09-01");
    await inputs.nth(1).fill("2026-09-30");
    await inputs.nth(1).blur();
    const preview = await readPreview(page);
    expect(preview.range).toEqual(["2026-09-01", "2026-09-30"]);
  });

  // ── Array of dates ──────────────────────────────────────────────

  test("milestones: Add Milestones reveals one <input type=date> seeded from the alias", async ({
    page,
  }) => {
    const milestones = await openCollection(page, "Milestones");
    // First item seeded by handleEnableOptional. The DateString alias carries
    // `@ui.type 'date'` so the input renders as a date picker.
    await expect(milestones.locator('input[type="date"]')).toHaveCount(1);
  });

  test("milestones: fill first + add second → preview.value.milestones reflects both", async ({
    page,
  }) => {
    const milestones = await openCollection(page, "Milestones");
    const first = milestones.locator('input[type="date"]').first();
    await first.fill("2026-10-15");
    await first.blur();

    // Inline "Add milestone" inside the open array.
    await milestones.locator(".as-array-add-btn", { hasText: /Add milestone/ }).click();
    const inputs = milestones.locator('input[type="date"]');
    await expect(inputs).toHaveCount(2);
    await inputs.nth(1).fill("2026-11-20");
    await inputs.nth(1).blur();

    const preview = await readPreview(page);
    expect(preview.milestones).toEqual(["2026-10-15", "2026-11-20"]);
  });
});
