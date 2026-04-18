import type { Preset } from "unocss";

const lightTokens = `
  --as-accent-50: #eff6ff;
  --as-accent-100: #dbeafe;
  --as-accent-200: #bfdbfe;
  --as-accent-500: #3b82f6;
  --as-accent-600: #2563eb;
  --as-accent-700: #1d4ed8;
  --as-accent: var(--as-accent-600);
  --as-accent-hover: var(--as-accent-700);
  --as-accent-soft: var(--as-accent-50);
  --as-accent-ring: rgba(37, 99, 235, 0.18);

  --as-bg: #f6f7f9;
  --as-surface: #ffffff;
  --as-surface-muted: #fafbfc;
  --as-surface-sunken: #f4f5f7;
  --as-border: #e5e7eb;
  --as-border-strong: #d1d5db;
  --as-border-subtle: #eef0f3;
  --as-text: #0f172a;
  --as-text-muted: #475569;
  --as-text-subtle: #64748b;
  --as-text-faint: #94a3b8;
  --as-danger: #dc2626;
  --as-danger-soft: #fef2f2;
  --as-hover: #f3f4f6;
  --as-selected: #eff6ff;

  --as-radius-sm: 5px;
  --as-radius: 7px;
  --as-radius-lg: 10px;
  --as-radius-chip: 6px;

  --as-row-h: 32px;
  --as-input-h: 32px;
  --as-btn-h: 32px;
  --as-gap-xs: 4px;
  --as-gap-sm: 8px;
  --as-gap: 12px;
  --as-gap-lg: 16px;
  --as-gap-xl: 20px;
  --as-pad-dialog: 20px;

  --as-font-ui: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --as-font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --as-fs-xs: 11px;
  --as-fs-sm: 12px;
  --as-fs-base: 13px;
  --as-fs-md: 14px;
  --as-fs-lg: 15px;
  --as-fs-xl: 17px;

  --as-shadow-dialog: 0 1px 2px rgba(15, 23, 42, 0.06),
                      0 8px 24px rgba(15, 23, 42, 0.10),
                      0 2px 6px rgba(15, 23, 42, 0.05);

  --as-chevron-down: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
`;

const darkTokens = `
  --as-bg: #0b0d10;
  --as-surface: #14171c;
  --as-surface-muted: #171b21;
  --as-surface-sunken: #10131a;
  --as-border: #252a33;
  --as-border-strong: #333944;
  --as-border-subtle: #1d2229;
  --as-text: #e7ebf2;
  --as-text-muted: #a0a9b8;
  --as-text-subtle: #7f8899;
  --as-text-faint: #5a6275;
  --as-hover: #1c2028;
  --as-selected: #152238;
  --as-accent-soft: #0f1e3a;
  --as-accent-ring: rgba(59, 130, 246, 0.32);
  --as-danger: #f87171;
  --as-danger-soft: #2a1617;
  --as-shadow-dialog: 0 1px 2px rgba(0, 0, 0, 0.4),
                      0 12px 32px rgba(0, 0, 0, 0.5),
                      0 2px 8px rgba(0, 0, 0, 0.3);
`;

const tokensCss = `
:root {${lightTokens}}
[data-theme="dark"] {${darkTokens}}
.dark {${darkTokens}}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not(.light) {${darkTokens}}
}

html, body { margin: 0; padding: 0; }
body {
  font-family: var(--as-font-ui);
  font-size: var(--as-fs-base);
  line-height: 1.45;
  color: var(--as-text);
  background: var(--as-bg);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
}
* { box-sizing: border-box; }
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
