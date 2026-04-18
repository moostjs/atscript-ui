import type { Preset } from "unocss";

const tokensCss = `
:root {
  color-scheme: light;

  /* Typography */
  --as-font-ui: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --as-font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --as-fs-xs: 11px;
  --as-fs-sm: 12px;
  --as-fs-base: 13px;
  --as-fs-md: 14px;
  --as-fs-lg: 15px;
  --as-fs-xl: 17px;

  /* Radii */
  --as-radius-sm: 5px;
  --as-radius: 7px;
  --as-radius-lg: 10px;
  --as-radius-chip: 6px;

  /* Sizes & density (comfortable default) */
  --as-row-h: 32px;
  --as-input-h: 32px;
  --as-btn-h: 32px;

  /* Gaps */
  --as-gap-xs: 4px;
  --as-gap-sm: 8px;
  --as-gap: 12px;
  --as-gap-lg: 16px;
  --as-gap-xl: 20px;
  --as-pad-dialog: 20px;

  /* Shadow (design) */
  --as-shadow-dialog: 0 1px 2px rgba(15, 23, 42, 0.06),
                      0 8px 24px rgba(15, 23, 42, 0.10),
                      0 2px 6px rgba(15, 23, 42, 0.05);

  /* SVG chevron for bare <select> */
  --as-chevron-down: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
}

.dark,
[data-theme="dark"] {
  color-scheme: dark;

  --as-shadow-dialog: 0 1px 2px rgba(0, 0, 0, 0.4),
                      0 12px 32px rgba(0, 0, 0, 0.5),
                      0 2px 8px rgba(0, 0, 0, 0.3);
}

body {
  font-family: var(--as-font-ui);
  font-size: var(--as-fs-base);
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
}
`;

export function asTokensPreflight(): Preset {
  return {
    name: "@atscript/unocss-preset:tokens",
    preflights: [
      {
        getCSS: () => tokensCss,
      },
    ],
  };
}
