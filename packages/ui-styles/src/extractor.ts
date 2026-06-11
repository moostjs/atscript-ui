import type { Extractor } from "unocss";
import { expandComponentClasses } from "./companions";
import {
  type AsComponentName,
  componentClasses,
  componentCompanions,
  helperAliases,
} from "./generated/component-classes";
import { kebabize } from "./kebab";

export interface AsExtractorOptions {
  /**
   * Kebab-case component names whose classes should NEVER be added to the
   * safelist, even when the extractor matches them. Use to drop styles for
   * default components the consumer has replaced with their own implementation.
   *
   * Typed against {@link AsComponentName} — a union generated from the
   * published component set — so editors autocomplete the names and typos
   * fail the build instead of silently no-opping.
   *
   * Companions are veto-able too: components a matched component pulls in
   * (statically or lazily — see `componentCompanions`) are expanded
   * per-component, so excluding e.g. `as-config-dialog` / `as-filter-dialog` /
   * `as-preset-dialog` sheds those dialogs' CSS even when you only tag
   * `<AsTableRoot>` — useful when the app never opens them or supplies its
   * own implementations.
   */
  excludeComponents?: AsComponentName[];
}

export function createAsExtractor(opts: AsExtractorOptions = {}): Extractor {
  const exclude = new Set<string>(opts.excludeComponents ?? []);
  const helperNames = Object.keys(helperAliases);
  // Leading `(?:^|[^.\w])` instead of `\b` so member calls like
  // `obj.createDefaultTypes()` don't trigger expansion.
  const helperPattern = helperNames.length
    ? new RegExp(`(?:^|[^.\\w])(${helperNames.join("|")})\\s*\\(`, "g")
    : null;

  return {
    name: "atscript-ui-components",
    order: -1,
    extract({ code }) {
      if (!code) return undefined;

      // Cheap short-circuit: if none of the discriminating substrings are
      // present, no pattern can match. Saves five regex passes on the typical
      // module that has nothing to do with atscript.
      if (
        !code.includes("@atscript/") &&
        !code.includes("<As") &&
        !code.includes("<as-") &&
        !helperNames.some((name) => code.includes(name))
      ) {
        return undefined;
      }

      // Collect matched component names first, then expand companions once
      // at the end via the shared walk (tracked components a match pulls in,
      // e.g. lazily-mounted dialogs, each independently veto-able via
      // `excludeComponents`).
      const names = new Set<string>();
      const addClassesFor = (kebab: string) => {
        names.add(kebab);
      };

      for (const [, name] of code.matchAll(
        /['"]@atscript\/(?:vue-form|vue-table|vue-wf|vue-aooth)\/(as-[\w-]+)['"]/g,
      ))
        addClassesFor(name);

      for (const [, names] of code.matchAll(
        /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"]@atscript\/(?:vue-form|vue-table|vue-wf|vue-aooth)['"]/g,
      )) {
        for (const ident of names.split(",")) {
          const name = ident.trim().split(/\s+as\s+/)[0];
          if (/^As[A-Z]/.test(name)) addClassesFor(kebabize(name));
        }
      }

      for (const [, name] of code.matchAll(/<(as-[\w-]+|As[A-Z][\w]*)/g))
        addClassesFor(name.startsWith("As") ? kebabize(name) : name);

      if (helperPattern) {
        for (const [, helper] of code.matchAll(helperPattern)) {
          for (const kebab of helperAliases[helper] ?? []) addClassesFor(kebab);
        }
      }

      const matched = expandComponentClasses(
        [...names],
        componentClasses,
        componentCompanions,
        exclude,
      );
      return matched.size > 0 ? matched : undefined;
    },
  };
}
