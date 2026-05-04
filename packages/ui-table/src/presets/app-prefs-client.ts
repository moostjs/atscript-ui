import { Client } from "@atscript/db-client";
import { getDefaultClientFactory } from "@atscript/ui";
import type { FilterExpr } from "@uniqu/core";

import type { AppConfData, AsPresetEntryRow } from "./preset-data-types";
import { appConfId } from "./preset-id";
import { isAuthError } from "./presets-client";

/**
 * Configuration for an `AppPrefsClient`. App-wide user prefs (`appConf`)
 * have no `tableKey` — they're scoped per `(user, app)` only.
 */
export interface AppPrefsClientConfig {
  /** Same controller URL the presets table is mounted on. */
  url: string;
  app: string;
  /** Pre-built Client (auth-configured by host). */
  client?: Client;
  /** Builds a Client when `client` is absent. Defaults to the app-wide `getDefaultClientFactory()`. */
  clientFactory?: (url: string) => Client;
}

export interface AppPrefsLoadResult {
  /** Full row (server-stamped id, user, timestamps), or `null` when none exists. */
  row: AsPresetEntryRow | null;
  /** Convenience accessor for `row.data` (the typed prefs payload), or `null`. */
  prefs: AppConfData | null;
  /** True when the controller responded 401/403. */
  denied: boolean;
}

type AppConfWritePayload = {
  id?: string;
  type?: "appConf";
  app?: string;
  data?: Partial<AppConfData>;
};

/**
 * Framework-agnostic wrapper for app-wide user preferences (`type='appConf'`).
 * Independent of the preset/userConf surface — devs use this directly to
 * read/write `appearance`, `language`, `density`, etc., without involving
 * any table.
 */
export class AppPrefsClient {
  private readonly app: string;
  private readonly client: Client;

  constructor(cfg: AppPrefsClientConfig) {
    if (!cfg.url) throw new Error("AppPrefsClient: `url` is required");
    if (!cfg.app) throw new Error("AppPrefsClient: `app` is required");
    this.app = cfg.app;
    this.client = cfg.client ?? (cfg.clientFactory ?? getDefaultClientFactory())(cfg.url);
  }

  /** Fetch the single `appConf` row for `(user, app)`. */
  async load(): Promise<AppPrefsLoadResult> {
    const filter: FilterExpr = {
      app: this.app,
      type: "appConf",
    } as unknown as FilterExpr;
    try {
      const rows = (await this.client.query({ filter } as never)) as unknown as AsPresetEntryRow[];
      const row = rows.length > 0 ? rows[0] : null;
      const prefs = row ? ((row.data ?? null) as AppConfData | null) : null;
      return { row, prefs, denied: false };
    } catch (err) {
      if (isAuthError(err)) {
        return { row: null, prefs: null, denied: true };
      }
      throw err;
    }
  }

  /**
   * Upsert the `appConf` row. Server forces `id` from session and shallow-
   * merges `data` so partial patches don't wipe unrelated fields. Caller
   * passes the prior `existing` row from `load()` so we pick the right verb.
   *
   * Returns the row id that owns the value after the write — useful for
   * state tracking after the first insert (subsequent saves take the
   * update path).
   */
  async save(
    existing: AsPresetEntryRow | null,
    patch: Partial<AppConfData>,
    user?: string,
  ): Promise<string | null> {
    if (existing) {
      const payload: AppConfWritePayload = { id: existing.id, data: patch };
      await this.client.update(payload as never);
      return existing.id;
    }
    const id = user ? appConfId(user, this.app) : undefined;
    const payload: AppConfWritePayload = {
      ...(id ? { id } : {}),
      type: "appConf",
      app: this.app,
      data: patch,
    };
    const result = (await this.client.insert(payload as never)) as
      | { insertedId?: unknown }
      | undefined;
    return typeof result?.insertedId === "string" ? result.insertedId : null;
  }
}
