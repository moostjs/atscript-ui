import { Client, ClientError } from "@atscript/db-client";
import { getDefaultClientFactory } from "@atscript/ui";
import type { FilterExpr } from "@uniqu/core";

import type {
  AsPresetEntryRow,
  PresetCapabilities,
  PresetData,
  UserConfData,
} from "./preset-data-types";
import { userConfId } from "./preset-id";
import type { PresetSnapshot } from "./preset-types";
import { toWireSnapshot } from "./preset-wire";

/**
 * Configuration for a `PresetsClient`. Either pass a pre-built `client`
 * (already wired with auth/fetch by the consumer's `ClientFactory`), or
 * pass `clientFactory + url` so the wrapper builds one. The capabilities
 * endpoint is fetched outside the standard CRUD path; if your app uses
 * non-cookie auth, supply `fetch` so headers/credentials propagate.
 */
export interface PresetsClientConfig {
  /** Controller mount URL, e.g. `"/db/_presets"`. Required. */
  url: string;
  app: string;
  tableKey: string;
  /** Pre-built Client (auth-configured by the host). Wins over `clientFactory`. */
  client?: Client;
  /** Builds a Client for the given URL. Defaults to the app-wide `getDefaultClientFactory()`. */
  clientFactory?: (url: string) => Client;
  /**
   * Fetch implementation for the `GET /capabilities` side-channel. Defaults
   * to `globalThis.fetch`. Cookie-based auth needs no override.
   */
  fetch?: typeof globalThis.fetch;
}

export interface PresetsListResult {
  /** type='preset' rows. */
  presets: AsPresetEntryRow[];
  /** type='userConf' row for this `(user, app, tableKey)`, or null. */
  userConf: AsPresetEntryRow | null;
  /**
   * Server-issued capabilities. `null` when capabilities load failed (auth,
   * network). `undefined` when this call skipped the capabilities fetch
   * (refresh-after-mutation) — callers should leave their cached value
   * untouched.
   */
  capabilities: PresetCapabilities | null | undefined;
  /** True when the controller responded 401/403 — UI silently hides. */
  denied: boolean;
}

export interface PresetsSaveAsOptions {
  public?: boolean;
}

export interface PresetsSaveResult {
  id: string;
}

/** Shape sent on the wire for `type='preset'` writes (label optional on update). */
type PresetWritePayload = {
  id?: string;
  type?: "preset";
  app?: string;
  tableKey?: string;
  public?: boolean;
  data?: Partial<PresetData>;
};

type UserConfWritePayload = {
  id?: string;
  type?: "userConf";
  app?: string;
  tableKey?: string;
  data?: Partial<UserConfData>;
};

/**
 * Framework-agnostic wrapper over `@atscript/db-client`'s `Client` for the
 * `AsPresetEntry` table. Handles wire serialisation, list-splitting by
 * `type`, capabilities side-channel, and 401/403 → `denied` semantics.
 *
 * Stateless: every method is a fresh request. The Vue composable layer
 * holds reactive state; this class only translates intent → HTTP.
 */
export class PresetsClient {
  private readonly url: string;
  private readonly app: string;
  private readonly tableKey: string;
  private readonly client: Client;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(cfg: PresetsClientConfig) {
    if (!cfg.url) throw new Error("PresetsClient: `url` is required");
    if (!cfg.app) throw new Error("PresetsClient: `app` is required");
    if (!cfg.tableKey) throw new Error("PresetsClient: `tableKey` is required");
    this.url = cfg.url;
    this.app = cfg.app;
    this.tableKey = cfg.tableKey;
    this.client = cfg.client ?? (cfg.clientFactory ?? getDefaultClientFactory())(cfg.url);
    this.fetchImpl = cfg.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Lists owned + public preset rows AND the user's userConf row for this
   * `(app, tableKey)`. By default also fetches `capabilities` in parallel —
   * pass `{ capabilities: false }` for refresh-after-mutation calls (fav
   * toggle, default change, save/save-as, public toggle, rename, delete)
   * where role-derived capabilities can't have changed. Auth errors
   * (401/403) collapse to `denied: true` with empty data so the UI hides
   * itself silently.
   */
  async list(opts: { capabilities?: boolean } = {}): Promise<PresetsListResult> {
    const fetchCapabilities = opts.capabilities !== false;
    const filter: FilterExpr = {
      app: this.app,
      tableKey: this.tableKey,
      type: { $in: ["preset", "userConf"] },
    } as unknown as FilterExpr;
    try {
      const [rows, capabilities] = await Promise.all([
        this.client.query({ filter } as never) as unknown as Promise<AsPresetEntryRow[]>,
        fetchCapabilities
          ? this.loadCapabilities().catch((err) => {
              if (isAuthError(err)) throw err;
              // Capabilities is best-effort — UI degrades gracefully when null.
              return null;
            })
          : Promise.resolve(undefined),
      ]);
      const presets: AsPresetEntryRow[] = [];
      let userConf: AsPresetEntryRow | null = null;
      for (const row of rows) {
        if (row.type === "preset") presets.push(row);
        else if (row.type === "userConf") userConf = row;
      }
      return {
        presets,
        userConf,
        // `undefined` signals "leave existing capabilities untouched".
        capabilities: fetchCapabilities ? (capabilities as PresetCapabilities | null) : undefined,
        denied: false,
      };
    } catch (err) {
      if (isAuthError(err)) {
        return { presets: [], userConf: null, capabilities: null, denied: true };
      }
      throw err;
    }
  }

  /** GET `${url}/capabilities?app=…&tableKey=…`. Out-of-band of CRUD plumbing. */
  async loadCapabilities(): Promise<PresetCapabilities> {
    const params = new URLSearchParams({ app: this.app, tableKey: this.tableKey });
    const target = `${this.url.replace(/\/+$/, "")}/capabilities?${params.toString()}`;
    const res = await this.fetchImpl(target, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new PresetsHttpError(res.status, `Capabilities fetch failed (${res.status})`);
    }
    return (await res.json()) as PresetCapabilities;
  }

  /**
   * Overwrite the active preset's content. Server shallow-merges `data` so
   * `label` is preserved on the row regardless — the caller sends it
   * anyway because the client-side validator can't pick the preset
   * variant of the `data` union without `label` present (it's required
   * on that variant).
   */
  async savePreset(id: string, label: string, snapshot: PresetSnapshot): Promise<void> {
    const payload: PresetWritePayload = {
      id,
      data: { label, content: toWireSnapshot(snapshot) },
    };
    await this.client.update(payload as never);
  }

  /**
   * Create a new preset row. Server stamps `user`, generates a UUID `id`,
   * and derives `aspects` from the snapshot keys.
   */
  async savePresetAs(
    label: string,
    snapshot: PresetSnapshot,
    opts: PresetsSaveAsOptions = {},
  ): Promise<PresetsSaveResult> {
    const payload: PresetWritePayload = {
      type: "preset",
      app: this.app,
      tableKey: this.tableKey,
      public: opts.public === true,
      data: { label, content: toWireSnapshot(snapshot) },
    };
    const result = (await this.client.insert(payload as never)) as
      | { insertedId?: unknown }
      | undefined;
    const id = result?.insertedId;
    if (typeof id !== "string" || id.length === 0) {
      throw new Error("PresetsClient.savePresetAs: server did not return an id");
    }
    return { id };
  }

  /** Update only the label. Server re-stamps top-level `label` + `publicLabel`. */
  async renamePreset(id: string, label: string): Promise<void> {
    const payload: PresetWritePayload = { id, data: { label } };
    await this.client.update(payload as never);
  }

  /** Toggle `public`. Server re-stamps `publicLabel` accordingly. */
  async setPublic(id: string, value: boolean): Promise<void> {
    const payload: PresetWritePayload = { id, public: value };
    await this.client.update(payload as never);
  }

  async deletePreset(id: string): Promise<void> {
    await this.client.remove(id as never);
  }

  /**
   * Upsert the userConf row keyed on `${USER_CONF_PREFIX}${user}:${app}:${tableKey}`.
   * Caller must know whether the row exists from a prior `list()` so we
   * pick the right verb. Server forces `user` and `id` on insert.
   */
  async upsertUserConf(
    existing: AsPresetEntryRow | null,
    patch: Partial<UserConfData>,
    user?: string,
  ): Promise<void> {
    if (existing) {
      const payload: UserConfWritePayload = { id: existing.id, data: patch };
      await this.client.update(payload as never);
      return;
    }
    const id = user ? userConfId(user, this.app, this.tableKey) : undefined;
    const payload: UserConfWritePayload = {
      // `id` is server-forced from session; including it is harmless and
      // avoids round-tripping just to learn the user identity.
      ...(id ? { id } : {}),
      type: "userConf",
      app: this.app,
      tableKey: this.tableKey,
      data: patch,
    };
    await this.client.insert(payload as never);
  }
}

/**
 * Error raised for non-2xx responses on the capabilities side-channel.
 * Standard CRUD errors flow through `Client`'s `ClientError`.
 */
export class PresetsHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "PresetsHttpError";
  }
}

/** True for HTTP 401/403 across both `ClientError` and `PresetsHttpError`. */
export function isAuthError(err: unknown): boolean {
  if (err instanceof ClientError && (err.status === 401 || err.status === 403)) return true;
  if (err instanceof PresetsHttpError && (err.status === 401 || err.status === 403)) return true;
  return false;
}
