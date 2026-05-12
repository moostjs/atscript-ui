// Section 34 — Adornments matrix.
//
// Demo target: `/forms-demo/adornments` — self-contained, no auth. Renders
// the `AdornmentsMatrix` schema, a 6×8 grid of (input-type × adornment
// permutation) covering every cross-product of:
//
//   sections (input type): strings, numbers, decimals, dates, datetimes, times
//   variants  (adornments): plain, prefixIcon, prefixText, prefixBoth,
//                           suffixIcon, suffixText, suffixBoth, fullHouse
//
// Per-variant adornment contract on every section:
//   plain         → none
//   prefixIcon    → @ui.form.prefix.icon 'i-as-search'
//   prefixText    → @ui.form.prefix '$'
//   prefixBoth    → both prefix-icon + prefix-text
//   suffixIcon    → @ui.form.suffix.icon 'i-as-check'
//   suffixText    → @ui.form.suffix 'USD'
//   suffixBoth    → suffix-text + suffix-icon
//   fullHouse     → all four adornments
//
// Renderer chrome observed when iterating live DOM (see Section 23 + 33 for
// the underlying composables):
//   • AsInput / AsNumber / AsDate / AsDatetime / AsTime → plain `<input>` when
//     no adornment is present, merged `.as-input-shell` (input/date/datetime/
//     time) or `.as-number` (numbers) when at least one adornment is wired.
//   • AsDecimal → ALWAYS paints the split `.as-decimal` shell, even on the
//     plain variant. The shell is the integer/decimal chrome, not the
//     adornment shell. So the "plain → no shell" assertion only applies to
//     strings/numbers/dates/datetimes/times — decimals exempt by design.
//
// Selector quirks (see earlier batches):
//   • Required-marker `*` leaks into accessible name via CSS `::after` — every
//     label regex tolerates `(\s*\*)?`. Strings/dates/datetimes/times are
//     required; numbers/decimals are not (atscript restricts @meta.required
//     to string | boolean), so the tail is optional either way.
//   • `.as-prefix-icon` / `.as-suffix-icon` are the icon spans (the user's
//     annotation value e.g. `i-as-search` is added to the span class list).
//   • `.as-prefix` / `.as-suffix` are the text-adornment spans.
//
// Don't assert on rendered glyph (mask-image) — only class presence on the
// span, mirroring the strategy used in sections 23 / 33.

import { expect, test, type Locator, type Page } from "../fixtures";

const SECTION_TITLES = [
  "Strings",
  "Numbers",
  "Decimals",
  "Dates",
  "Datetimes",
  "Times",
] as const;
type SectionTitle = (typeof SECTION_TITLES)[number];

const VARIANT_LABELS = [
  "Plain",
  "Prefix icon",
  "Prefix text",
  "Prefix both",
  "Suffix icon",
  "Suffix text",
  "Suffix both",
  "Full house",
] as const;
type VariantLabel = (typeof VARIANT_LABELS)[number];

const LABEL_TAIL = "(\\s*\\*)?";
function labelRegex(text: string): RegExp {
  // Escape regex metacharacters that may appear in our human-readable
  // labels (none right now, but cheap to be safe).
  const safe = text.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return new RegExp(`^${safe}${LABEL_TAIL}$`);
}

const form = (page: Page): Locator => page.getByTestId("adornments-form");

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/adornments");
  await page.waitForLoadState("networkidle");
  await expect(form(page)).toBeVisible();
}

// All matrix fields live inside the form. The schema renders each section
// as a nested `AsObject` block. Field labels are unique within their
// section but the same labels repeat across sections (e.g. "Plain"
// appears once per section), so every locator must be scoped to the
// section header first.
function sectionRoot(page: Page, title: SectionTitle): Locator {
  // Each nested AsObject renders as a collapsible `<details>` whose
  // `<summary>` carries `.as-collapsible-title` (root titles are
  // suppressed by `hide-root-title`). Match against the title text
  // directly so reordering can't break the lookup.
  return form(page)
    .locator(
      `details:has(> summary :is(.as-collapsible-title, .as-collapsible-title-nested):text-is("${title}"))`,
    )
    .first();
}

function fieldRow(page: Page, section: SectionTitle, variant: VariantLabel): Locator {
  return sectionRoot(page, section)
    .locator(".as-default-field", {
      has: page.locator(".as-field-label", { hasText: labelRegex(variant) }),
    })
    .first();
}

// Expand every section so the matrix is mounted in the DOM. `<details>`
// `open` flips via the `summary` click; idempotent on already-open
// elements via the `open` attribute guard.
async function expandAllSections(page: Page) {
  for (const title of SECTION_TITLES) {
    const sec = sectionRoot(page, title);
    await expect(sec).toBeAttached();
    const isOpen = (await sec.getAttribute("open")) !== null;
    if (!isOpen) {
      await sec.locator("> summary").first().click();
    }
    await expect(sec).toHaveAttribute("open", "");
  }
}

// Variant-permutation contract — what spans should be present in a given
// row. `null` means "must NOT exist", a string means "must exist with
// this expected text/class fragment".
type VariantSpec = {
  prefixIcon: string | null; // class fragment on `.as-prefix-icon` span
  prefixText: string | null; // exact text inside `.as-prefix` span
  suffixIcon: string | null;
  suffixText: string | null;
};
const VARIANT_SPECS: Record<Exclude<VariantLabel, "Plain">, VariantSpec> = {
  "Prefix icon": {
    prefixIcon: "i-as-search",
    prefixText: null,
    suffixIcon: null,
    suffixText: null,
  },
  "Prefix text": {
    prefixIcon: null,
    prefixText: "$",
    suffixIcon: null,
    suffixText: null,
  },
  "Prefix both": {
    prefixIcon: "i-as-search",
    prefixText: "$",
    suffixIcon: null,
    suffixText: null,
  },
  "Suffix icon": {
    prefixIcon: null,
    prefixText: null,
    suffixIcon: "i-as-check",
    suffixText: null,
  },
  "Suffix text": {
    prefixIcon: null,
    prefixText: null,
    suffixIcon: null,
    suffixText: "USD",
  },
  "Suffix both": {
    prefixIcon: null,
    prefixText: null,
    suffixIcon: "i-as-check",
    suffixText: "USD",
  },
  "Full house": {
    prefixIcon: "i-as-search",
    prefixText: "$",
    suffixIcon: "i-as-check",
    suffixText: "USD",
  },
};

async function assertVariant(row: Locator, spec: VariantSpec) {
  // `.as-prefix-icon`
  if (spec.prefixIcon === null) {
    await expect(row.locator(".as-prefix-icon")).toHaveCount(0);
  } else {
    const iconSpan = row.locator(".as-prefix-icon");
    await expect(iconSpan).toHaveCount(1);
    await expect(iconSpan).toHaveClass(new RegExp(spec.prefixIcon));
  }
  // `.as-prefix` (text)
  if (spec.prefixText === null) {
    await expect(row.locator(".as-prefix")).toHaveCount(0);
  } else {
    await expect(row.locator(".as-prefix")).toHaveText(spec.prefixText);
  }
  // `.as-suffix-icon`
  if (spec.suffixIcon === null) {
    await expect(row.locator(".as-suffix-icon")).toHaveCount(0);
  } else {
    const iconSpan = row.locator(".as-suffix-icon");
    await expect(iconSpan).toHaveCount(1);
    await expect(iconSpan).toHaveClass(new RegExp(spec.suffixIcon));
  }
  // `.as-suffix` (text)
  if (spec.suffixText === null) {
    await expect(row.locator(".as-suffix")).toHaveCount(0);
  } else {
    await expect(row.locator(".as-suffix")).toHaveText(spec.suffixText);
  }
}

test.describe("Section 34 — adornments matrix", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await expandAllSections(page);
  });

  // ── A. Initial render ─────────────────────────────────────────────

  test("page renders form testid + preview block", async ({ page }) => {
    await expect(form(page)).toBeVisible();
    await expect(page.getByTestId("adornments-preview")).toBeAttached();
  });

  test("all 6 section titles are visible", async ({ page }) => {
    // `sectionRoot` already matches by `text-is(title)` inside the
    // summary, so visibility on the `<details>` proves both presence
    // and label correctness.
    for (const title of SECTION_TITLES) {
      await expect(sectionRoot(page, title)).toBeVisible();
    }
  });

  // ── B. Plain variant — no adornment shell paints ──────────────────
  //
  // Strings / numbers / dates / datetimes / times must NOT paint the merged
  // adornment shell when no adornment is present. AsDecimal is exempt: its
  // split-input chrome (`.as-decimal`) always paints because the integer/
  // decimal halves *are* the renderer, not an adornment add-on. See header
  // notes + `packages/vue-form/src/components/defaults/as-decimal.vue`.

  test("plain variant: no adornment shell on strings/numbers/dates/datetimes/times (decimals exempt)", async ({
    page,
  }) => {
    for (const section of SECTION_TITLES) {
      const row = fieldRow(page, section, "Plain");
      await expect(row).toBeVisible();
      // Zero adornment spans across the board.
      await expect(row.locator(".as-prefix")).toHaveCount(0);
      await expect(row.locator(".as-suffix")).toHaveCount(0);
      await expect(row.locator(".as-prefix-icon")).toHaveCount(0);
      await expect(row.locator(".as-suffix-icon")).toHaveCount(0);

      if (section === "Decimals") {
        // Documented exception: `.as-decimal` always paints because the
        // split integer/decimal chrome is the renderer, not an adornment
        // shell. Asserting >= 1 instead of `0` so the rule survives any
        // future refactor that reuses the class name.
        await expect(row.locator(".as-decimal")).toHaveCount(1);
      } else if (section === "Numbers") {
        // AsNumber shell only paints when `hasAdornment` is true.
        await expect(row.locator(".as-number")).toHaveCount(0);
      } else {
        // AsInput / AsDate / AsDatetime / AsTime → no merged-input shell
        // when no adornment is wired.
        await expect(row.locator(".as-input-shell")).toHaveCount(0);
      }
    }
  });

  // ── C. Per-variant chrome — 7 parameterised tests ─────────────────
  //
  // For each adorned variant, walk all 6 sections and assert the exact
  // set of adornment spans (presence / class fragment / text).

  for (const variant of VARIANT_LABELS.slice(1) as Exclude<VariantLabel, "Plain">[]) {
    test(`variant "${variant}": chrome matches contract across all 6 sections`, async ({
      page,
    }) => {
      const spec = VARIANT_SPECS[variant];
      for (const section of SECTION_TITLES) {
        const row = fieldRow(page, section, variant);
        await expect(row).toBeVisible();
        await assertVariant(row, spec);
      }
    });
  }

  // ── D. Cross-renderer parity (Full house) ─────────────────────────
  //
  // The Full-house variant exercises icon + text on both ends. Every
  // section's row must paint exactly one of each of the four adornment
  // spans — proving icon adornments are wired identically across all
  // six renderers.

  test("fullHouse: each section paints exactly 1 of each adornment span", async ({ page }) => {
    for (const section of SECTION_TITLES) {
      const row = fieldRow(page, section, "Full house");
      await expect(row.locator(".as-prefix-icon")).toHaveCount(1);
      await expect(row.locator(".as-prefix")).toHaveCount(1);
      await expect(row.locator(".as-suffix")).toHaveCount(1);
      await expect(row.locator(".as-suffix-icon")).toHaveCount(1);
    }
  });
});
