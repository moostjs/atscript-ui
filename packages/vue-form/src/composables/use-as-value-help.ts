import {
  ValueHelpClient,
  getMetaEntry,
  resolveValueHelp,
  retainMetaEntry,
  type ClientFactory,
  type ResolvedValueHelp,
  type ValueHelpInfo,
} from "@atscript/ui";
import {
  type ComputedRef,
  type InjectionKey,
  type Ref,
  type ShallowRef,
  computed,
  getCurrentScope,
  inject,
  onScopeDispose,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useAsTexts, useUiLocaleKey } from "./use-as-locale";

/** Vue inject key used by `AsForm` to publish a per-form `ClientFactory` override. */
export const CLIENT_FACTORY_KEY: InjectionKey<ClientFactory> = Symbol("as-client-factory");

export interface UseAsValueHelpOptions {
  info: ValueHelpInfo;
  model: { value: unknown };
  onBlur: () => void;
}

export type UseAsValueHelpStatus = "loading" | "ready" | "error";

export interface UseAsValueHelpReturn {
  resolved: ShallowRef<ResolvedValueHelp | null>;
  status: Ref<UseAsValueHelpStatus>;
  searchText: Ref<string>;
  results: ShallowRef<Record<string, unknown>[]>;
  searching: Ref<boolean>;
  labelIsFkValue: ComputedRef<boolean>;
  kickoff: () => Promise<void>;
  selectItem: (item: Record<string, unknown>) => void;
  clear: () => void;
}

const DEBOUNCE_MS = 300;

export function useAsValueHelp(options: UseAsValueHelpOptions): UseAsValueHelpReturn {
  const { info, model, onBlur } = options;

  // Resolution order: nearest-ancestor prop override → app-wide default → built-in `new Client(url)`.
  // Only applied when this is the first consumer for `info.url` — the shared
  // meta cache reuses an existing Client if one was already created.
  const injectedFactory = inject(CLIENT_FACTORY_KEY, null) ?? undefined;
  // The app's texts pick the locale's entry and receive the texts `/meta` serves.
  const texts = useAsTexts();
  const scoped = !!getCurrentScope();
  // The picker works in the browser only (`kickoff` runs on mount): a server
  // render asks nothing — a `/meta` answered after the HTML was written would
  // only merge texts the page never showed.
  const browser = typeof window !== "undefined";
  let release: (() => void) | undefined;
  let vhClient: ValueHelpClient | undefined;
  /**
   * Binds the entry of the app's current locale — held while mounted, so
   * `kickoff`'s `resolveValueHelp` finds it (and its client).
   */
  function bindEntry(): void {
    const entry = getMetaEntry(info.url, injectedFactory, { texts });
    const previous = release;
    release = scoped ? retainMetaEntry(entry) : undefined;
    previous?.();
    vhClient = new ValueHelpClient(entry.client);
  }
  if (browser) bindEntry();
  if (scoped) onScopeDispose(() => release?.());

  const resolved = shallowRef<ResolvedValueHelp | null>(null);
  const status = ref<UseAsValueHelpStatus>("loading");
  const searchText = ref("");
  const results: ShallowRef<Record<string, unknown>[]> = shallowRef([]);
  const searching = ref(false);

  const labelIsFkValue = computed(
    () => !!resolved.value && info.targetField === resolved.value.labelField,
  );

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let kickoffPromise: Promise<void> | undefined;
  /** Bumped per kickoff: a superseded one (a previous locale's) never lands. */
  let kickoffSeq = 0;
  let lastSearchedText: string | undefined;
  /** Bumped per search: a superseded one (an older text or locale) never lands. */
  let searchSeq = 0;

  onUnmounted(() => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
  });

  async function kickoff(): Promise<void> {
    if (kickoffPromise) return kickoffPromise;
    const mine = ++kickoffSeq;
    kickoffPromise = resolveValueHelp(info.url, { texts, clientFactory: injectedFactory })
      .then((r) => {
        if (mine !== kickoffSeq) return;
        resolved.value = r;
        status.value = "ready";
      })
      .catch(() => {
        if (mine === kickoffSeq) status.value = "error";
      });
    return kickoffPromise;
  }

  // A locale switch without a remount — of the app's `provideAsLocale` getter
  // or of `setUiLocale`: from now on the picker asks in the new locale, through
  // the same factory; a started resolve restarts in it, and its arrival re-runs
  // the current search.
  function followLocale(): void {
    if (!browser) return;
    bindEntry();
    lastSearchedText = undefined;
    searchSeq++;
    if (!kickoffPromise) return;
    kickoffPromise = undefined;
    void kickoff();
  }
  // `sync`: a `setUiLocale` re-binds before its caller goes on.
  watch(useUiLocaleKey(texts), followLocale, { flush: "sync" });

  function scheduleSearch(text: string) {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void doSearch(text);
    }, DEBOUNCE_MS);
  }

  async function doSearch(text: string) {
    const r = resolved.value;
    if (!r || !vhClient) return;
    if (text === lastSearchedText) return;
    lastSearchedText = text;
    const mine = ++searchSeq;
    searching.value = true;
    try {
      const result = await vhClient.search(r, {
        text: text || undefined,
        mode: "form",
        limit: 20,
        // `@ui.valueHelp` scope + the field the picker commits (since 0.1.148)
        filter: info.filter,
        valueField: info.targetField,
      });
      if (mine === searchSeq) results.value = result.items;
    } catch {
      if (mine === searchSeq) results.value = [];
    } finally {
      if (mine === searchSeq) searching.value = false;
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
    searching.value = false;
    lastSearchedText = undefined;
    searchSeq++;
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
