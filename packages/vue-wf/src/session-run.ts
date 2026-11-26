/** The run a tab keeps for `persistToken: "session"`. */
export interface SessionRun {
  /** The link token the run started from. */
  link?: string;
  /** The token the run's next request sends. */
  token: string;
}

/**
 * One `sessionStorage` entry. Never throws: no browser (SSR — Node 25+ has a
 * process-wide `sessionStorage`, so `window` is the guard), disabled storage or
 * a full quota read as nothing saved and fail the write — the run goes on in
 * memory and only stops surviving a reload.
 */
export function sessionRunEntry(key: string) {
  return {
    load(): SessionRun | undefined {
      try {
        if (typeof window === "undefined") return undefined;
        const value = JSON.parse(
          sessionStorage.getItem(key) ?? "null",
        ) as Partial<SessionRun> | null;
        if (typeof value?.token !== "string" || !value.token) return undefined;
        return typeof value.link === "string"
          ? { link: value.link, token: value.token }
          : { token: value.token };
      } catch {
        return undefined;
      }
    },
    /** Writes (or, with no run, removes) the entry; `false` when storage refused. */
    save(run: SessionRun | undefined): boolean {
      try {
        if (typeof window === "undefined") return false;
        if (run) sessionStorage.setItem(key, JSON.stringify(run));
        else sessionStorage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}
