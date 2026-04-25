import type { ComponentResolverObject } from "unplugin-vue-components";

import { componentPackages } from "./generated/component-classes";
import { kebabize } from "./kebab";

const PKG_TO_NPM = {
  form: "@atscript/vue-form",
  table: "@atscript/vue-table",
  wf: "@atscript/vue-wf",
} as const;

const AS_TAG = /^As[A-Z]/;

/**
 * Tag-only — composables (`useTable`, `useFormState`, …) are not resolved
 * by `unplugin-vue-components` by design and must be imported explicitly.
 */
export function AsResolver(): ComponentResolverObject {
  return {
    type: "component",
    resolve(name) {
      if (!AS_TAG.test(name)) return;
      const kebab = kebabize(name);
      const pkg = componentPackages[kebab];
      if (!pkg) return;
      return { name: "default", from: `${PKG_TO_NPM[pkg]}/${kebab}` };
    },
  };
}
