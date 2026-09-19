import { createGenerator } from "unocss";
import type { StringifiedUtil } from "unocss";
import { describe, expect, it } from "vitest";
import { asPresetVunor, createAsBaseUnoConfig } from "../preset";

/**
 * Drives a REAL UnoCSS generator through the atscript-ui preset. Everything
 * guarded here looked correct in the shortcut objects and only went wrong once
 * UnoCSS had compiled them — a composed vunor shortcut, an arbitrary value with
 * a nested `var()`, a variant that silently dropped.
 */

type TParsedToken = StringifiedUtil[];

async function parse(token: string): Promise<TParsedToken> {
  const uno = await createGenerator(createAsBaseUnoConfig());
  const utils = await uno.parseToken(token);
  if (!utils) throw new Error(`"${token}" compiled to nothing`);
  return utils as TParsedToken;
}

function parseBody(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of body.split(";")) {
    const colon = decl.indexOf(":");
    if (colon > 0) out[decl.slice(0, colon).trim()] = decl.slice(colon + 1).trim();
  }
  return out;
}

/** Effective declarations across every selector the token produced. */
function allDeclarations(utils: TParsedToken): Record<string, string> {
  const out: Record<string, string> = {};
  for (const util of utils) Object.assign(out, parseBody(util[2] || ""));
  return out;
}

describe("btn-square composes inside alias shortcuts (no marker-rule shadow)", () => {
  // Under vunor 0.2.x `btn-square` was an empty-body marker shortcut and the
  // preset registered a `$$noop` RULE of the same name to silence UnoCSS'
  // "unmatched utility" warning. vunor 0.3.0 gives it a real body, so the
  // workaround is gone — shortcuts resolve before rules, so it never actually
  // shadowed the body, but a same-named rule sitting on top of a live vunor
  // shortcut is one UnoCSS resolution-order change away from doing so. These
  // assertions pin the compiled square-button geometry either way.
  it("as-table-actions-more compiles the real btn-square body", async () => {
    const decls = allDeclarations(await parse("as-table-actions-more"));
    expect(decls.width).toBe("var(--v-fingertip)");
    expect(decls.height).toBe("var(--v-fingertip)");
    expect(decls["padding-left"]).toBe("0");
    expect(decls["padding-right"]).toBe("0");
    expect(decls["--btn-label-display"]).toBe("none");
    expect(decls["--btn-icon-fs"]).toBe("1.5em");
  });

  it("registers no btn-square marker rule — vunor 0.3.0 owns the real shortcut", () => {
    const marker = asPresetVunor().find((p) => p.name === "atscript-ui-marker-rules")!;
    const names = (marker.rules ?? []).map((r) => r[0]);
    expect(names).toContain("group");
    expect(names).not.toContain("btn-square");
  });

  it("the standalone btn-square token is not a no-op either", async () => {
    const decls = allDeclarations(await parse("btn-square"));
    expect(decls["--btn-label-display"]).toBe("none");
  });
});

describe("dropdown/popover viewport caps", () => {
  it("as-filter-field-dropdown caps width at the overridable --as-dropdown-max-w", async () => {
    const decls = allDeclarations(await parse("as-filter-field-dropdown"));
    // Nested `var()` inside `min()` must survive UnoCSS' arbitrary-value parsing.
    expect(decls["max-width"]).toBe(
      "min(var(--as-dropdown-max-w,64em),var(--reka-popper-available-width,64em))",
    );
  });

  // Every panel that composes the shared `popperCapped` recipe (table/_shared).
  it("the popper-capped panels bound their height to the popper space", async () => {
    for (const token of [
      "as-preset-picker-popover",
      "as-preset-picker-menu",
      "as-filters-overflow",
    ]) {
      const decls = allDeclarations(await parse(token));
      expect(decls["max-height"]).toBe("var(--reka-popper-available-height)");
      expect(decls["overflow-y"]).toBe("auto");
    }
  });
});

describe("as-filters overflow shortcuts", () => {
  // `<AsFilters>` has no wrapper element any more, so there is no bare
  // `as-filters` shortcut to compile — only the `-overflow*` family.
  it("no longer ships a display:contents root shortcut", async () => {
    const uno = await createGenerator(createAsBaseUnoConfig());
    expect(await uno.parseToken("as-filters")).toBeFalsy();
  });

  it("compiles the overflow trigger, badge and panel", async () => {
    const trigger = await parse("as-filters-overflow-trigger");
    // Only the root selector — `btn` also emits descendant rules (the loading
    // overlay) whose declarations would otherwise be merged in.
    const root: Record<string, string> = {};
    for (const util of trigger) {
      if (util[1] === ".as-filters-overflow-trigger") Object.assign(root, parseBody(util[2] || ""));
    }
    // `relative` anchors the count badge; `btn` supplies it and nothing later
    // in the shortcut body may drop it.
    expect(root.position).toBe("relative");
    expect(allDeclarations(await parse("as-filters-overflow-badge")).display).toBe("inline-flex");
    const panel = allDeclarations(await parse("as-filters-overflow"));
    expect(panel["max-height"]).toBe("var(--reka-popper-available-height)");
    expect(panel["overflow-y"]).toBe("auto");
  });
});

describe("collapsible dirty hook", () => {
  it("paints a left rail on a dirty section without scoping the whole subtree", async () => {
    const utils = await parse("as-collapsible-section");
    const before = utils.filter((u) => (u[1] || "").includes("[data-dirty]"));
    expect(before.length).toBeGreaterThan(0);
    // The rail lives on `::before` — the accent must NOT be declared on the
    // section root, or every descendant label inherits the "modified" look.
    for (const util of before) {
      expect(util[1]).toContain("::before");
    }
    const decls = allDeclarations(before);
    expect(decls.position).toBe("absolute");
    expect(decls.content).toBe('""');
  });

  it("marks the heading itself", async () => {
    const utils = await parse("as-collapsible-title");
    expect(utils.some((u) => (u[1] || "").includes("[data-dirty]"))).toBe(true);
  });
});

describe("as-field-status is visually hidden", () => {
  // It is now an alias for preset-wind3's `sr-only`; these pin the compiled
  // result so a preset swap that stops shipping `sr-only` fails loudly rather
  // than silently un-hiding the node in the footer row.
  it("clips the sr-only status node out of the layout", async () => {
    const decls = allDeclarations(await parse("as-field-status"));
    expect(decls.position).toBe("absolute");
    expect(decls.width).toBe("1px");
    expect(decls.height).toBe("1px");
    expect(decls.overflow).toBe("hidden");
    expect(decls["white-space"]).toBe("nowrap");
    expect(decls.clip).toBe("rect(0,0,0,0)");
  });

  it("resolves to exactly the sr-only body", async () => {
    expect(allDeclarations(await parse("as-field-status"))).toEqual(
      allDeclarations(await parse("sr-only")),
    );
  });
});

const iconsPresetName = (presets: ReturnType<typeof asPresetVunor>) =>
  presets.filter((p) => /icons/i.test(p.name ?? ""));

describe("asPresetVunor({ icons })", () => {
  it("registers the baked icons preset by default", () => {
    expect(iconsPresetName(asPresetVunor())).toHaveLength(1);
  });

  it("skips the baked icons preset when icons: false, keeping everything else", () => {
    const off = asPresetVunor({ icons: false });
    expect(iconsPresetName(off)).toHaveLength(0);
    // Same preset list otherwise — only the icons entry is gone.
    expect(off).toHaveLength(asPresetVunor().length - 1);
    expect(off.some((p) => p.name === "atscript-ui-extractors")).toBe(true);
    expect(off.some((p) => p.name === "atscript-ui-form-grid")).toBe(true);
  });

  it("still compiles shortcuts with icons off", async () => {
    const uno = await createGenerator({
      ...createAsBaseUnoConfig(),
      presets: asPresetVunor({ icons: false }),
    });
    expect(await uno.parseToken("as-table-actions-more")).toBeTruthy();
  });
});
