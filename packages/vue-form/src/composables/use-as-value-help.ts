import {
  ValueHelpClient,
  getMetaEntry,
  resolveValueHelp,
  retainMetaEntry,
  valueHelpFills,
  valueHelpScope,
  type ClientFactory,
  type ResolvedValueHelp,
  type ValueHelpInfo,
  type ValueHelpScope,
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
import { useAsData } from "./use-as-data";
import { useAsTexts, useUiLocaleKey } from "./use-as-locale";

/** Vue inject key used by `AsForm` to publish a per-form `ClientFactory` override. */
export const CLIENT_FACTORY_KEY: InjectionKey<ClientFactory> = Symbol("as-client-factory");

export interface UseAsValueHelpOptions {
  info: ValueHelpInfo;
  model: { value: unknown };
  onBlur: () => void;
  /**
   * Whether the picker's list is open. A changed host value
   * (`ValueHelpInfo.hostFilter`) searches again at once while it is, else on
   * the next open. Left out: at once. Since 0.1.190.
   */
  open?: Ref<boolean>;
  /** Rows per search. Default 20. Since 0.1.190. */
  limit?: number;
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
  /**
   * The one pick path: commits `item[info.targetField]`, writes the binding's
   * fills (`ValueHelpInfo.fill`) into their sibling fields as edits, and
   * validates the field (`onBlur`).
   */
  selectItem: (item: Record<string, unknown>) => void;
  /**
   * Clear the picker: set the model to `value` (`undefined` — unset — when
   * omitted) and empty the search text. A field this field's last pick filled
   * is cleared too (`undefined`) while it still holds what the pick wrote —
   * unless the binding also reads it as a host value (since 0.1.190).
   */
  clear: (value?: unknown) => void;
  /**
   * The scope the picker searches with: the binding's filter with the form's
   * host values, and the fields they pin (`valueHelpScope`). Since 0.1.190.
   */
  scope: ComputedRef<ValueHelpScope>;
}

const DEBOUNCE_MS = 300;

export function useAsValueHelp(options: UseAsValueHelpOptions): UseAsValueHelpReturn {
  const { info, model, onBlur, open } = options;
  const limit = options.limit ?? 20;

  // The form around the field: host values are read from it, fills written into it.
  const data = useAsData();
  const siblings = new Map<string, ComputedRef<unknown>>();
  const readSibling = (local: string): unknown => {
    let value = siblings.get(local);
    if (!value) siblings.set(local, (value = data.siblingValue(local)));
    return value.value;
  };
  const scope = computed(() => valueHelpScope(info, readSibling));
  /** Siblings the binding reads as host values: a clear never empties them. */
  const hostLocals = new Set(info.hostFilter?.map((h) => h.local));
  /** What this field's last pick wrote into each fill target. */
  const written = new Map<string, unknown>();

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
        limit,
        // `@ui.valueHelp` scope with the form's host values (since 0.1.190) + the
        // binding (the field the picker commits, its columns and fill targets)
        filter: scope.value.filter,
        info,
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

  // A changed host value re-scopes the picker: an open one searches again (also for an
  // unchanged text), a closed one on its next open.
  if (info.hostFilter?.length) {
    watch(scope, () => {
      lastSearchedText = undefined;
      if (resolved.value && (!open || open.value)) void doSearch(searchText.value);
    });
    if (open) {
      watch(open, (isOpen) => {
        if (isOpen && resolved.value && lastSearchedText === undefined) {
          void doSearch(searchText.value);
        }
      });
    }
  }

  onMounted(() => {
    void kickoff();
  });

  function selectItem(item: Record<string, unknown>) {
    const val = item[info.targetField];
    model.value = val;
    written.clear();
    for (const fill of valueHelpFills(info, item)) {
      written.set(fill.local, fill.value);
      // committed like an edit (tracked, re-validated); an unchanged value is not rewritten
      if (!Object.is(readSibling(fill.local), fill.value)) data.setSibling(fill.local, fill.value);
    }
    onBlur();
  }

  function clear(value?: unknown) {
    model.value = value;
    // Only what this field's last pick wrote, while the target still holds it — never a
    // field the binding reads as a host value (it scopes the picker, the user set it).
    for (const [local, wrote] of written) {
      if (wrote !== undefined && !hostLocals.has(local) && Object.is(readSibling(local), wrote)) {
        data.setSibling(local, undefined);
      }
    }
    written.clear();
    searchText.value = "";
    // Lists every match again (a search still running for the old text is
    // superseded), so the reopened list is not stuck on the old results.
    void doSearch("");
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
    scope,
  };
}
