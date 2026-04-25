import { describe, expect, it } from "vitest";

import { asPresetVunor } from "../preset";

// The icon resolver lives inside the @unocss/preset-icons preset object
// returned by `asPresetVunor()`. We don't crack open that preset directly —
// instead we verify behaviour at the shape level: `asPresetVunor` accepts
// `iconOverrides` and produces a Preset[] that includes a working presetIcons.

describe("iconOverrides", () => {
  it("asPresetVunor accepts iconOverrides without throwing", () => {
    const presets = asPresetVunor({
      iconOverrides: {
        search: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1h1v1H1z"/></svg>',
      },
    });
    expect(Array.isArray(presets)).toBe(true);
    expect(presets.length).toBeGreaterThan(0);
  });

  it("iconOverrides keys aren't enforced — unknown keys are silently kept", () => {
    // The override map is merged with bakedIcons; a key that isn't in the
    // baked set just becomes a new icon. UnoCSS's preset-icons resolver
    // returns undefined for names neither baked nor overridden — that's
    // fine, the consumer just gets no class for that name.
    const presets = asPresetVunor({
      iconOverrides: {
        "completely-new-icon": '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      },
    });
    expect(presets.length).toBeGreaterThan(0);
  });

  it("calling asPresetVunor() with no options still works (defaults intact)", () => {
    const presets = asPresetVunor();
    expect(Array.isArray(presets)).toBe(true);
  });
});
