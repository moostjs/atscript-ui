import { readonly, ref } from "vue";
import { sharedFetch } from "./fetch";

export interface Me {
  userId: number;
  username: string;
  roleName: "admin" | "manager" | "viewer";
  permissions: Record<string, { read: boolean; write: boolean; columns?: string[] }>;
}

const _me = ref<Me | null>(null);
const _loading = ref(false);
const _error = ref<string | null>(null);
const _loaded = ref(false);

async function load() {
  _loading.value = true;
  _error.value = null;
  try {
    const res = await sharedFetch("/api/me");
    if (res.status === 401) {
      _me.value = null;
      return;
    }
    if (!res.ok) throw new Error(`/api/me ${res.status}`);
    _me.value = (await res.json()) as Me;
  } catch (e) {
    _error.value = (e as Error).message;
  } finally {
    _loading.value = false;
    _loaded.value = true;
  }
}

export function useMe() {
  if (!_loaded.value && !_loading.value && typeof window !== "undefined") void load();
  return {
    me: readonly(_me),
    loading: readonly(_loading),
    error: readonly(_error),
    loaded: readonly(_loaded),
    refresh: load,
    reset: () => {
      _me.value = null;
      _loaded.value = false;
      _error.value = null;
    },
  };
}
