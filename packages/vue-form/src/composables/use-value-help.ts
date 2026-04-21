import { ValueHelpClient, str, getDefaultClientFactory, type ClientFactory } from "@atscript/ui";
import type { ValueHelpInfo } from "@atscript/ui";
import {
  type InjectionKey,
  type Ref,
  type ShallowRef,
  inject,
  onUnmounted,
  ref,
  shallowRef,
  watch,
} from "vue";

/** Vue inject key used by `AsForm` to publish a per-form `ClientFactory` override. */
export const CLIENT_FACTORY_KEY: InjectionKey<ClientFactory> = Symbol("as-client-factory");

export interface UseValueHelpOptions {
  info: ValueHelpInfo;
  model: { value: unknown };
  onBlur: () => void;
}

export interface UseValueHelpReturn {
  searchText: Ref<string>;
  results: ShallowRef<Record<string, unknown>[]>;
  loading: Ref<boolean>;
  displayLabel: Ref<string>;
  accessible: Ref<boolean | undefined>;
  labelIsFkValue: boolean;
  selectFields: string[];
  displayValue: (val: unknown) => string;
  selectItem: (item: Record<string, unknown>) => void;
  clear: () => void;
  resolveLabel: (value: unknown) => Promise<void>;
  init: () => Promise<void>;
}

const DEBOUNCE_MS = 300;

export function useValueHelp(options: UseValueHelpOptions): UseValueHelpReturn {
  const { info, model, onBlur } = options;

  // Resolution order: nearest-ancestor prop override → app-wide default → built-in `new Client(url)`.
  const factory = inject(CLIENT_FACTORY_KEY, null) ?? getDefaultClientFactory();
  const dbClient = factory(info.path);
  const vhClient = new ValueHelpClient(dbClient);

  const labelIsFkValue = info.targetField === info.labelField;

  const selectFields = [
    ...new Set(
      [info.targetField, ...info.primaryKeys, info.labelField, info.descrField].filter(
        Boolean,
      ) as string[],
    ),
  ];

  const searchText = ref("");
  const results: ShallowRef<Record<string, unknown>[]> = shallowRef([]);
  const loading = ref(false);
  const displayLabel = ref("");
  const accessible = ref<boolean | undefined>(undefined);

  const labelCache = new Map<string, string>();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  onUnmounted(() => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
  });

  // ── Debounced search ─────────────────────────────────────
  function search(text: string) {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void doSearch(text);
    }, DEBOUNCE_MS);
  }

  async function doSearch(text: string) {
    loading.value = true;
    try {
      const result = await vhClient.search(info, {
        text: text || undefined,
        mode: "form",
        limit: 20,
      });
      for (const item of result.items) {
        const key = item[info.targetField];
        if (key != null) labelCache.set(str(key), str(item[info.labelField] ?? key));
      }
      results.value = result.items;
    } catch {
      results.value = [];
    } finally {
      loading.value = false;
    }
  }

  watch(searchText, (text) => {
    search(text);
  });

  // ── Selection ────────────────────────────────────────────
  function selectItem(item: Record<string, unknown>) {
    const val = item[info.targetField];
    model.value = val;
    const label = str(item[info.labelField] ?? val ?? "");
    displayLabel.value = label;
    labelCache.set(str(val), label);
    onBlur();
  }

  function clear() {
    model.value = undefined;
    displayLabel.value = "";
    searchText.value = "";
    results.value = [];
  }

  // ── Label resolution ─────────────────────────────────────
  async function resolveLabel(value: unknown) {
    if (value == null || value === "") {
      displayLabel.value = "";
      return;
    }

    const sval = str(value);
    if (labelCache.has(sval)) {
      displayLabel.value = labelCache.get(sval)!;
      return;
    }

    if (labelIsFkValue) {
      displayLabel.value = sval;
      labelCache.set(sval, sval);
      return;
    }

    try {
      const labels = await vhClient.resolveLabels(info, [value]);
      const label = labels.get(value) ?? sval;
      displayLabel.value = label;
      labelCache.set(sval, label);
    } catch {
      displayLabel.value = sval;
    }
  }

  function displayValue(val: unknown): string {
    if (val == null || val === "") return "";
    const sval = str(val);
    if (labelIsFkValue) return sval;
    return labelCache.get(sval) ?? sval;
  }

  async function init() {
    const labelPromise =
      model.value != null && model.value !== "" ? resolveLabel(model.value) : undefined;
    try {
      await vhClient.getMeta();
      accessible.value = true;
    } catch {
      accessible.value = false;
    }
    await labelPromise;
  }

  return {
    searchText,
    results,
    loading,
    displayLabel,
    accessible,
    labelIsFkValue,
    selectFields,
    displayValue,
    selectItem,
    clear,
    resolveLabel,
    init,
  };
}
