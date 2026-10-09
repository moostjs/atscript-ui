import { readonly, ref } from "vue";
import { setMetaCacheIdentity } from "@atscript/ui";
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

/**
 * Every write to the current user goes through here: `/meta` (and the
 * value-help searches shared under it) is projected per user and role, so
 * the shared meta cache is bound to who is signed in.
 */
function setMe(me: Me | null) {
  _me.value = me;
  setMetaCacheIdentity(me ? `${me.userId}:${me.roleName}` : null);
}

function clear() {
  setMe(null);
  _loaded.value = false;
  _error.value = null;
}

async function load() {
  _loading.value = true;
  _error.value = null;
  try {
    const res = await sharedFetch("/api/me");
    if (res.status === 401) {
      setMe(null);
      return;
    }
    if (!res.ok) throw new Error(`/api/me ${res.status}`);
    setMe((await res.json()) as Me);
  } catch (e) {
    _error.value = (e as Error).message;
  } finally {
    _loading.value = false;
    _loaded.value = true;
  }
}

async function logout() {
  try {
    await sharedFetch("/api/auth/logout", { method: "POST" });
  } finally {
    clear();
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
    logout,
    reset: clear,
  };
}
