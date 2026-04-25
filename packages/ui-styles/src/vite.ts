import type { ComponentResolverObject } from "unplugin-vue-components";

import { componentPackages, primaryComponents } from "./generated/component-classes";
import { kebabize } from "./kebab";

const PKG_TO_NPM = {
  form: "@atscript/vue-form",
  table: "@atscript/vue-table",
  wf: "@atscript/vue-wf",
} as const;

const AS_TAG = /^As[A-Z]/;

/**
 * Auto-imports Tier-1 primary components only — the ones users tag
 * directly in templates (`<AsForm>`, `<AsTable>`, `<AsTableRoot>`,
 * `<AsFilters>`, `<AsField>`, `<AsIterator>`, `<AsWfForm>`). Tier-2
 * default implementations (`AsInput`, `AsFilterDialog`, …) are public
 * and importable via subpath or barrel, but are NOT auto-resolved —
 * users import them explicitly when composing custom defaults.
 * Composables (`useTable`, …) are not handled by `unplugin-vue-components`
 * at all and must be imported explicitly.
 */
export function AsResolver(): ComponentResolverObject {
  return {
    type: "component",
    resolve(name) {
      if (!AS_TAG.test(name)) return;
      const kebab = kebabize(name);
      if (!primaryComponents.has(kebab)) return;
      const pkg = componentPackages[kebab];
      if (!pkg) return;
      return { name: "default", from: `${PKG_TO_NPM[pkg]}/${kebab}` };
    },
  };
}
