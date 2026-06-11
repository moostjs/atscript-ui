<script setup lang="ts">
import { computed } from "vue";
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";
import { compileFieldFn } from "@atscript/ui-fns";
import type { AsPasswordRulesPolicy } from "../types";

const props = defineProps<
  TAsComponentProps & {
    policies?: AsPasswordRulesPolicy[];
    password?: string;
  }
>();

// Track which rule sources we've already warned about, to keep debug output
// useful (one log line per broken policy) without flooding the console on
// every keystroke re-evaluation.
const warned = new Set<string>();

function evalRule(rule: string, password: string): boolean {
  try {
    // The aooth wire-format rule is `(password, context?) => boolean`.
    // `compileFieldFn` invokes the user's function positionally as
    // `(v, data, context, entry)` — so the rule's first positional arg
    // (`password`) receives our `v`. Extras are ignored.
    // `entry` must be present on the scope object — `compileFieldFn` wraps
    // the rule in a `with(__ctx__)` block, so referenced identifiers need
    // a defined property even when the rule body ignores them.
    return !!compileFieldFn<boolean>(rule)({
      v: password,
      data: {},
      context: {},
      entry: undefined,
    });
  } catch (err) {
    if (!warned.has(rule)) {
      warned.add(rule);
      console.warn("[AsPasswordRules] failed to evaluate rule", { rule, error: err });
    }
    return false;
  }
}

interface EvaluatedPolicy {
  description: string;
  passed: boolean;
}

const evaluated = computed<EvaluatedPolicy[]>(() => {
  const list = props.policies ?? [];
  const password = props.password ?? "";
  const hasPassword = password.length > 0;
  const out: EvaluatedPolicy[] = [];
  for (const policy of list) {
    out.push({
      description: policy.description ?? "",
      // Empty password ⇒ nothing is passed yet, even if a no-op rule would
      // technically return true. This avoids misleading the user at the
      // initial "I haven't typed anything" state.
      passed: hasPassword && evalRule(policy.rule, password),
    });
  }
  return out;
});
</script>

<template>
  <AsFieldShell
    v-if="evaluated.length > 0"
    v-bind="$props"
    :chromeless="true"
    field-class="as-password-rules"
  >
    <div class="as-password-rules-list">
      <div
        v-for="(policy, index) in evaluated"
        :key="index"
        class="as-password-rules-row"
        :data-passed="policy.passed ? 'true' : 'false'"
      >
        <span class="as-password-rules-icon" aria-hidden="true" />
        <span class="as-password-rules-text">{{ policy.description }}</span>
      </div>
    </div>
  </AsFieldShell>
</template>
