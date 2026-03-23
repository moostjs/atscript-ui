import type { TAtscriptPlugin } from "@atscript/core";
import { uiAnnotations } from "./plugin/annotations";
import { uiPrimitives } from "./plugin/primitives";

/**
 * ATScript plugin that registers static UI annotations (`@ui.*`)
 * and UI primitive types (`ui.select`, `ui.radio`, etc.).
 *
 * Install in your `atscript.config.ts`:
 * ```ts
 * import uiPlugin from '@atscript/ui/plugin'
 *
 * export default {
 *   plugins: [uiPlugin()],
 * }
 * ```
 */
export default function uiPlugin(): TAtscriptPlugin {
  return {
    name: "ui",
    config() {
      return { primitives: uiPrimitives, annotations: uiAnnotations };
    },
  };
}
