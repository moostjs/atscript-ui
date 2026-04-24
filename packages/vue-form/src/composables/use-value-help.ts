import {
  ValueHelpClient,
  getMetaEntry,
  resolveValueHelp,
  type ClientFactory,
  type ResolvedValueHelp,
  type ValueHelpInfo,
} from "@atscript/ui";
import {
  type InjectionKey,
  type ShallowRef,
  computed,
  inject,
  onMounted,
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

export type UseValueHelpStatus = "loading" | "ready" | "error";

const DEBOUNCE_MS = 300;

export function useValueHelp(options: UseValueHelpOptions) {
  const { info, model, onBlur } = options;

  // Resolution order: nearest-ancestor prop override → app-wide default → built-in `new Client(url)`.
  // Only applied when this is the first consumer for `info.url` — the shared
  // meta cache reuses an existing Client if one was already created.
  const injectedFactory = inject(CLIENT_FACTORY_KEY, null) ?? undefined;
  const entry = getMetaEntry(info.url, injectedFactory);
  const vhClient = new ValueHelpClient(entry.client);

  const resolved = shallowRef<ResolvedValueHelp | null>(null);
  const status = ref<UseValueHelpStatus>("loading");
  const searchText = ref("");
  const results: ShallowRef<Record<string, unknown>[]> = shallowRef([]);
  const searching = ref(false);

  const labelIsFkValue = computed(
    () => !!resolved.value && info.targetField === resolved.value.labelField,
  );

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let kickoffPromise: Promise<void> | undefined;
  let lastSearchedText: string | undefined;

  onUnmounted(() => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
  });

  async function kickoff(): Promise<void> {
    if (kickoffPromise) return kickoffPromise;
    kickoffPromise = resolveValueHelp(info.url)
      .then((r) => {
        resolved.value = r;
        status.value = "ready";
      })
      .catch(() => {
        status.value = "error";
      });
    return kickoffPromise;
  }

  function scheduleSearch(text: string) {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void doSearch(text);
    }, DEBOUNCE_MS);
  }

  async function doSearch(text: string) {
    const r = resolved.value;
    if (!r) return;
    if (text === lastSearchedText) return;
    lastSearchedText = text;
    searching.value = true;
    try {
      const result = await vhClient.search(r, {
        text: text || undefined,
        mode: "form",
        limit: 20,
      });
      results.value = result.items;
    } catch {
      results.value = [];
    } finally {
      searching.value = false;
    }
  }

  watch(searchText, (text) => {
    if (resolved.value) scheduleSearch(text);
  });

  watch(resolved, (r) => {
    if (r) void doSearch(searchText.value);
  });

  onMounted(() => {
    void kickoff();
  });

  function selectItem(item: Record<string, unknown>) {
    const val = item[info.targetField];
    model.value = val;
    onBlur();
  }

  function clear() {
    model.value = undefined;
    searchText.value = "";
    results.value = [];
    lastSearchedText = undefined;
  }

  return {
    resolved,
    status,
    searchText,
    results,
    searching,
    labelIsFkValue,
    kickoff,
    selectItem,
    clear,
  };
}
