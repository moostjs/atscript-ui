import type { TAtscriptPlugin } from "@atscript/core";
import { uiFnsAnnotations } from "./plugin/annotations";
import { uiPrimitives } from "./plugin/primitives";

/**
 * ATScript plugin that registers UI primitives (`ui.select`, `ui.radio`, etc.),
 * static `ui.*` annotations, `ui.fn.*` computed annotations, and `ui.validate`.
 *
 * Install in your `atscript.config.ts`:
 * ```ts
 * import { uiFnsPlugin } from '@atscript/ui-fns/plugin'
 *
 * export default {
 *   plugins: [uiFnsPlugin()],
 * }
 * ```
 */
export default function uiFnsPlugin(): TAtscriptPlugin {
  return {
    name: "ui-fns",
    config() {
      return { primitives: uiPrimitives, annotations: uiFnsAnnotations };
    },
  };
}
