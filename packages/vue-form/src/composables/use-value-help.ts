import type { ValueHelpInfo } from "@atscript/ui";
import type { Client } from "@atscript/db-client";
import { type Ref, type ShallowRef, inject, onUnmounted, ref, shallowRef, watch } from "vue";

/** Factory that creates a Client from a URL path. Same type as vue-table's TableClientFactory. */
export type ValueHelpClientFactory = (url: string) => Client;

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

/** Safely stringify a value that may be string, number, or other primitive. */
function str(v: unknown): string {
  return `${v as string | number}`;
}

export function useValueHelp(options: UseValueHelpOptions): UseValueHelpReturn {
  const { info, model, onBlur } = options;

  const factory = inject<ValueHelpClientFactory>("__as_vh_client_factory");
  if (!factory) {
    throw new Error(
      "useValueHelp requires a clientFactory. Provide it via the valueHelpClientFactory prop on AsForm.",
    );
  }
  const client = factory(info.path);

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
      const query: Record<string, unknown> = {
        controls: { $select: selectFields, $limit: 20 },
      };
      if (text) {
        const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.filter = {
          $or: [{ [info.labelField]: { $regex: `^${escaped}` } }, { [info.targetField]: text }],
        };
      }
      const items = await client.query(query as any);
      const resultItems = items as Record<string, unknown>[];
      for (const item of resultItems) {
        const key = item[info.targetField];
        if (key != null) labelCache.set(str(key), str(item[info.labelField] ?? key));
      }
      results.value = resultItems;
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
      const item = await client.one(value as any, {
        controls: { $select: selectFields as any },
      });
      if (item) {
        const label = str((item as Record<string, unknown>)[info.labelField] ?? value);
        displayLabel.value = label;
        labelCache.set(sval, label);
      } else {
        displayLabel.value = sval;
      }
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
      const meta = await client.meta();
      accessible.value = meta !== undefined;
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
