import type { PresetSnapshot } from "@atscript/ui-table";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useLocalDraft,
  type StorageLike,
  type UseLocalDraftReturn,
} from "../composables/use-local-draft";

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  has(k: string): boolean {
    return this.map.has(k);
  }
  size(): number {
    return this.map.size;
  }
}

const ALL_ASPECTS = ["columns", "filters", "filterOps", "sorters", "itemsPerPage"] as const;

function setupComposable(opts: {
  enabled: boolean;
  storage: MemoryStorage;
  current?: () => PresetSnapshot;
  preset?: () => PresetSnapshot;
  debounceMs?: number;
  scope?: import("vue").Ref<string | undefined>;
}) {
  let captured: UseLocalDraftReturn | null = null;
  const Cmp = defineComponent({
    setup() {
      const draft = useLocalDraft({
        app: "demo",
        tableKey: "products",
        enabled: opts.enabled,
        availableAspects: ALL_ASPECTS,
        storage: opts.storage,
        debounceMs: opts.debounceMs ?? 0,
        scope: opts.scope,
      });
      captured = draft;
      if (opts.current && opts.preset) {
        draft.watchAndPersist(opts.current, opts.preset);
      }
      return () => h("div");
    },
  });
  const wrapper = mount(Cmp);
  return { wrapper, draft: captured as unknown as UseLocalDraftReturn };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useLocalDraft.hydrate", () => {
  it("returns the applied snapshot unchanged when disabled", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "as-table-draft:demo:products",
      JSON.stringify({ columns: { columnNames: ["x"] } }),
    );
    const { draft } = setupComposable({ enabled: false, storage });
    const out = draft.hydrate({ columns: { columnNames: ["a", "b"] } });
    expect(out).toEqual({ columns: { columnNames: ["a", "b"] } });
  });

  it("layers the draft over the applied snapshot when enabled", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "as-table-draft:demo:products",
      JSON.stringify({ columns: { columnNames: ["x", "y"] } }),
    );
    const { draft } = setupComposable({ enabled: true, storage });
    const out = draft.hydrate({
      columns: { columnNames: ["a", "b"] },
      filters: ["status"],
    });
    expect(out).toEqual({
      columns: { columnNames: ["x", "y"] },
      filters: ["status"],
    });
  });

  it("returns input unchanged when storage entry is empty draft", () => {
    const storage = new MemoryStorage();
    storage.setItem("as-table-draft:demo:products", "{}");
    const { draft } = setupComposable({ enabled: true, storage });
    const out = draft.hydrate({ columns: { columnNames: ["a"] } });
    expect(out).toEqual({ columns: { columnNames: ["a"] } });
  });

  it("swallows corrupted JSON with console.warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = new MemoryStorage();
    storage.setItem("as-table-draft:demo:products", "{not json");
    const { draft } = setupComposable({ enabled: true, storage });
    const out = draft.hydrate({ columns: { columnNames: ["a"] } });
    expect(out).toEqual({ columns: { columnNames: ["a"] } });
    expect(warn).toHaveBeenCalled();
  });
});

describe("useLocalDraft.watchAndPersist", () => {
  it("debounces writes to localStorage", async () => {
    const storage = new MemoryStorage();
    const current = ref<PresetSnapshot>({ columns: { columnNames: ["a"] } });
    const preset = ref<PresetSnapshot>({ columns: { columnNames: ["a", "b"] } });
    setupComposable({
      enabled: true,
      storage,
      current: () => current.value,
      preset: () => preset.value,
      debounceMs: 100,
    });

    // First state mutation
    current.value = { columns: { columnNames: ["x"] } };
    await flushPromises();
    // Storage hasn't been written yet — debounce in flight.
    expect(storage.has("as-table-draft:demo:products")).toBe(false);

    // Second mutation within the debounce window
    current.value = { columns: { columnNames: ["x", "y"] } };
    await flushPromises();
    expect(storage.has("as-table-draft:demo:products")).toBe(false);

    // Flush debounce
    vi.advanceTimersByTime(150);
    await flushPromises();
    expect(storage.has("as-table-draft:demo:products")).toBe(true);
    const entry = JSON.parse(storage.getItem("as-table-draft:demo:products")!);
    expect(entry).toEqual({ columns: { columnNames: ["x", "y"] } });
  });

  it("removes the entry when current matches preset's persisted aspects", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "as-table-draft:demo:products",
      JSON.stringify({ columns: { columnNames: ["pre-existing"] } }),
    );
    const current = ref<PresetSnapshot>({ columns: { columnNames: ["a"] } });
    const preset = ref<PresetSnapshot>({ columns: { columnNames: ["a", "b"] } });
    setupComposable({
      enabled: true,
      storage,
      current: () => current.value,
      preset: () => preset.value,
      debounceMs: 0,
    });

    // Mutation 1: state diverges -> draft written
    current.value = { columns: { columnNames: ["x"] } };
    await flushPromises();
    vi.advanceTimersByTime(10);
    await flushPromises();
    expect(storage.has("as-table-draft:demo:products")).toBe(true);

    // Mutation 2: state goes back to matching the preset -> entry removed
    current.value = { columns: { columnNames: ["a", "b"] } };
    await flushPromises();
    vi.advanceTimersByTime(10);
    await flushPromises();
    expect(storage.has("as-table-draft:demo:products")).toBe(false);
  });

  it("never persists filterOps even when present in current", async () => {
    const storage = new MemoryStorage();
    const current = ref<PresetSnapshot>({
      columns: { columnNames: ["a"] },
      filterOps: { status: [{ type: "eq", value: ["active"] }] },
    });
    const preset = ref<PresetSnapshot>({ columns: { columnNames: ["b"] } });
    setupComposable({
      enabled: true,
      storage,
      current: () => current.value,
      preset: () => preset.value,
      debounceMs: 0,
    });

    current.value = {
      columns: { columnNames: ["a", "b"] },
      filterOps: { status: [{ type: "eq", value: ["new"] }] },
    };
    await flushPromises();
    vi.advanceTimersByTime(10);
    await flushPromises();
    const stored = JSON.parse(storage.getItem("as-table-draft:demo:products")!);
    expect(stored).not.toHaveProperty("filterOps");
    expect(stored).toHaveProperty("columns");
  });
});

describe("useLocalDraft.clear", () => {
  it("removes the entry", () => {
    const storage = new MemoryStorage();
    storage.setItem("as-table-draft:demo:products", "{}");
    const { draft } = setupComposable({ enabled: true, storage });
    draft.clear();
    expect(storage.has("as-table-draft:demo:products")).toBe(false);
  });
});

// Regression: the draft key had no identity in it, so on a shared browser a
// different signed-in user restored the previous user's draft.
describe("useLocalDraft — scope", () => {
  const snapshot: PresetSnapshot = { filters: ["status"] };

  it("keeps the unscoped key when no scope is given", () => {
    const storage = new MemoryStorage();
    const { draft } = setupComposable({ enabled: true, storage });
    draft.watchAndPersist(
      () => snapshot,
      () => ({}),
    );
    expect(draft.hydrate({})).toEqual({});
    storage.setItem("as-table-draft:demo:products", JSON.stringify({ filters: ["status"] }));
    expect(draft.readDraft()).toEqual({ filters: ["status"] });
  });

  it("two scopes never see each other's drafts", () => {
    const storage = new MemoryStorage();
    storage.setItem("as-table-draft:demo:alice:products", JSON.stringify({ filters: ["a"] }));
    storage.setItem("as-table-draft:demo:bob:products", JSON.stringify({ filters: ["b"] }));

    const alice = setupComposable({ enabled: true, storage, scope: ref("alice") });
    const bob = setupComposable({ enabled: true, storage, scope: ref("bob") });

    expect(alice.draft.hydrate({})).toEqual({ filters: ["a"] });
    expect(bob.draft.hydrate({})).toEqual({ filters: ["b"] });
    // The unscoped key is a third, independent bucket.
    expect(storage.has("as-table-draft:demo:products")).toBe(false);
  });

  it("re-reads from the new key when the scope changes at runtime", () => {
    const storage = new MemoryStorage();
    storage.setItem("as-table-draft:demo:alice:products", JSON.stringify({ filters: ["a"] }));
    storage.setItem("as-table-draft:demo:bob:products", JSON.stringify({ filters: ["b"] }));
    const scope = ref<string | undefined>("alice");
    const { draft } = setupComposable({ enabled: true, storage, scope });

    expect(draft.hydrate({})).toEqual({ filters: ["a"] });
    scope.value = "bob";
    expect(draft.hydrate({})).toEqual({ filters: ["b"] });
  });

  it("writes and clears under the scoped key only", async () => {
    const storage = new MemoryStorage();
    const scope = ref<string | undefined>("alice");
    const current = ref<PresetSnapshot>({});
    const { draft } = setupComposable({
      enabled: true,
      storage,
      scope,
      current: () => current.value,
      preset: () => ({}),
    });

    current.value = { columns: { columnNames: ["a"] } };
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1);
    expect(storage.has("as-table-draft:demo:alice:products")).toBe(true);
    expect(storage.has("as-table-draft:demo:products")).toBe(false);

    // Switching identity writes the new user's draft without touching the old.
    scope.value = "bob";
    current.value = { columns: { columnNames: ["b"] } };
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1);
    expect(storage.has("as-table-draft:demo:bob:products")).toBe(true);
    expect(JSON.parse(storage.getItem("as-table-draft:demo:alice:products")!)).toEqual({
      columns: { columnNames: ["a"] },
    });

    draft.clear();
    expect(storage.has("as-table-draft:demo:bob:products")).toBe(false);
    expect(storage.has("as-table-draft:demo:alice:products")).toBe(true);
  });

  // Regression: `scope` used to be a source of the state watcher, so flipping
  // identity SCHEDULED a write — and a write already pending from the old
  // user landed under the new user's key (the key is resolved at flush time).
  it("a pending debounced write never lands under the new scope's key", async () => {
    const storage = new MemoryStorage();
    const scope = ref<string | undefined>("alice");
    const current = ref<PresetSnapshot>({});
    setupComposable({
      enabled: true,
      storage,
      scope,
      debounceMs: 50,
      current: () => current.value,
      preset: () => ({}),
    });

    // Alice edits…
    current.value = { columns: { columnNames: ["alice-col"] } };
    await flushPromises();
    // …and the identity flips before the debounce window closes.
    scope.value = "bob";
    await flushPromises();
    await vi.advanceTimersByTimeAsync(100);

    expect(storage.has("as-table-draft:demo:bob:products")).toBe(false);
    expect(storage.has("as-table-draft:demo:alice:products")).toBe(false);
    expect(storage.size()).toBe(0);
  });

  it("adopts the new scope's own draft instead of overwriting it", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "as-table-draft:demo:bob:products",
      JSON.stringify({ columns: { columnNames: ["bob-col"] } }),
    );
    const scope = ref<string | undefined>("alice");
    const current = ref<PresetSnapshot>({});
    setupComposable({
      enabled: true,
      storage,
      scope,
      debounceMs: 50,
      current: () => current.value,
      preset: () => ({}),
    });

    current.value = { columns: { columnNames: ["alice-col"] } };
    await flushPromises();
    scope.value = "bob";
    await flushPromises();
    await vi.advanceTimersByTimeAsync(100);

    expect(JSON.parse(storage.getItem("as-table-draft:demo:bob:products")!)).toEqual({
      columns: { columnNames: ["bob-col"] },
    });
  });
});
