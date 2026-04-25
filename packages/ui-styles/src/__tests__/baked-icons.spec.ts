import { describe, expect, it } from "vitest";

import { bakedIcons } from "../generated/baked-icons";
import { defaultAsIconAliases } from "../preset";

describe("bakedIcons", () => {
  it("contains an entry for every key in defaultAsIconAliases", () => {
    const aliasKeys = Object.keys(defaultAsIconAliases).toSorted();
    const bakedKeys = Object.keys(bakedIcons).toSorted();
    expect(bakedKeys).toEqual(aliasKeys);
  });

  it("each value is a non-empty SVG string", () => {
    for (const [name, svg] of Object.entries(bakedIcons)) {
      expect(svg, `bakedIcons[${name}] must be a non-empty string`).toBeTruthy();
      expect(svg.trim().startsWith("<svg"), `bakedIcons[${name}] must start with <svg`).toBe(true);
      expect(svg.trim().endsWith("</svg>"), `bakedIcons[${name}] must close with </svg>`).toBe(
        true,
      );
    }
  });

  it("local-root SVGs (loading, value-help, sorters) are baked", () => {
    // These are the three custom SVGs we ship at .icons/<name>.svg —
    // they prove the bake step traverses bare-token aliases correctly.
    expect(bakedIcons.loading).toBeDefined();
    expect(bakedIcons["value-help"]).toBeDefined();
    expect(bakedIcons.sorters).toBeDefined();

    // The animated loading icon includes <animate ...> tags.
    expect(bakedIcons.loading).toContain("<animate");
  });

  it("Iconify-fetched SVGs use currentColor (processLocalSvg ran)", () => {
    // No hex/hsl/rgb literal colors should leak through — the loader
    // normalizes them to `currentColor` so the icons inherit text color.
    for (const [name, svg] of Object.entries(bakedIcons)) {
      expect(svg, `bakedIcons[${name}] should not contain literal hex colors`).not.toMatch(
        /#[0-9a-f]{6}\b/iu,
      );
    }
  });
});
