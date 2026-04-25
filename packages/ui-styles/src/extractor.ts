import type { Extractor } from "unocss";
import { componentClasses, helperAliases } from "./generated/component-classes";
import { kebabize } from "./kebab";

export interface AsExtractorOptions {
  /**
   * Kebab-case component names whose classes should NEVER be added to the
   * safelist, even when the extractor matches them. Use to drop styles for
   * default components the consumer has replaced with their own implementation.
   */
  excludeComponents?: string[];
}

export function createAsExtractor(opts: AsExtractorOptions = {}): Extractor {
  const exclude = new Set(opts.excludeComponents ?? []);
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

      const matched = new Set<string>();
      const addClassesFor = (kebab: string) => {
        if (exclude.has(kebab)) return;
        const list = componentClasses[kebab];
        if (!list) return;
        for (const cls of list) matched.add(cls);
      };

      for (const [, name] of code.matchAll(
        /['"]@atscript\/(?:vue-form|vue-table|vue-wf)\/(as-[\w-]+)['"]/g,
      ))
        addClassesFor(name);

      for (const [, names] of code.matchAll(
        /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"]@atscript\/(?:vue-form|vue-table|vue-wf)['"]/g,
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

      return matched.size > 0 ? matched : undefined;
    },
  };
}
