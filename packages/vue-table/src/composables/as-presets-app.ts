import { type InjectionKey, inject } from "vue";

/**
 * App-wide injection key for the presets system. The host app calls
 * `app.provide(AS_PRESETS_APP, '<your-app>')` once at boot; every
 * `<AsTableRoot>`, `usePresets`, and `useAppPrefs` call below it pulls the
 * value via `inject(AS_PRESETS_APP)` unless an explicit `app` option
 * overrides it.
 *
 * The string identifies the application namespace on the server side —
 * one Moost backend can serve many apps; rows are scoped by `(app,
 * tableKey)`.
 */
export const AS_PRESETS_APP: InjectionKey<string> = Symbol("AS_PRESETS_APP");

/**
 * Resolve the app name with these precedence rules:
 *
 * 1. `explicit` argument (composable option) — wins.
 * 2. `inject(AS_PRESETS_APP)` from the Vue tree.
 * 3. Throws — composable can't run without an app namespace.
 *
 * Throws a clear error when neither is available so misconfiguration
 * surfaces at setup time, not when the first network round-trip fails.
 */
export function injectPresetsApp(explicit?: string): string {
  if (explicit && explicit.length > 0) return explicit;
  const fromProvide = inject(AS_PRESETS_APP, undefined);
  if (fromProvide && fromProvide.length > 0) return fromProvide;
  throw new Error(
    "[vue-table] AS_PRESETS_APP not provided. Call `app.provide(AS_PRESETS_APP, '<your-app>')` once at boot, or pass `app` to the composable.",
  );
}
