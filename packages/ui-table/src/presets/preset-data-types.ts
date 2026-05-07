import type { PresetAspect } from "./preset-aspects";
import type { PresetSnapshotWire } from "./preset-wire-types";

/**
 * Wire-shape `data` payload for `type='preset'` rows on `AsPresetEntry`. The
 * server validates `content` against the wire shape; the client converts to
 * dict-form `PresetSnapshot` via `fromWireSnapshot` for in-memory use.
 */
export interface PresetData {
  /** User-visible label. Public-name uniqueness within `(app, tableKey)`. */
  label: string;
  /**
   * Wire-form snapshot. The set of present top-level keys drives the
   * top-level `aspects` column on the row — derived automatically on every
   * preset write so picker queries can project `aspects` without loading
   * `data`.
   */
  content?: PresetSnapshotWire;
}

/**
 * Per-user, per-table configuration row (`type='userConf'`, deterministic
 * id `uc:${user}:${app}:${tableKey}`). Carries preferences that are
 * inherently per-table (preset pins / favorites); app-wide prefs live on
 * `AppConfData`.
 */
export interface UserConfData {
  /**
   * Stable preset id (or `'sys:<id>'` for system presets) pinned as the
   * default for this table. Resolution is tolerant — a stale id is left
   * intact and may reactivate if the referenced preset returns.
   */
  defaultPresetId?: string;
  favPresetIds?: string[];
}

/**
 * Per-user, app-wide configuration row (`type='appConf'`, deterministic id
 * `ac:${user}:${app}`). Holds preferences that are inherently app-scoped —
 * duplicating per-table would let them drift.
 */
export interface AppConfData {
  appearance?: "system" | "light" | "dark";
  /** BCP-47 language tag (`'en'`, `'en-US'`). Max 5 chars. */
  language?: string;
  /** IANA timezone name (`'America/New_York'`). Max 64 chars. */
  timezone?: string;
  density?: "compact" | "cozy" | "comfortable";
  dateFormat?: "iso" | "us" | "eu";
  /** 0 = Sunday, 1 = Monday, 6 = Saturday. */
  firstDayOfWeek?: 0 | 1 | 6;
  /** Escape hatch for app-specific user prefs. Capped at 1024 chars. */
  customJson?: string;
}

export type AsPresetEntryData = PresetData | UserConfData | AppConfData;

export type AsPresetsErrorCode =
  | "preset_limit_reached"
  | "reserved_id"
  | "public_name_conflict"
  | "missing_scope"
  | "missing_id"
  | "invalid_type"
  | "type_immutable"
  | "identity_immutable"
  | "preset_not_found"
  | "publish_forbidden"
  | "action_unsupported";

/** 409 body returned when a user's per-`(app, tableKey)` preset cap would be exceeded. */
export interface PresetLimitReachedBody {
  code: "preset_limit_reached";
  limit: number;
  count: number;
}

/**
 * Browser-side row shape for `AsPresetEntry`. The server-authoritative
 * shape lives in `@atscript/moost-ui-presets`'s generated `.as.d.ts`; this
 * type duplicates the runtime view so client code (composables, picker,
 * dialog) never imports the server-only package.
 */
export interface AsPresetEntryRow {
  id: string;
  type: "preset" | "userConf" | "appConf";
  app: string;
  tableKey?: string;
  user: string;
  /**
   * Display label for `user` (e.g. their username) — server-stamped on every
   * write via `AsPresetsController.getUserLabel`. Optional: when the
   * controller doesn't override the hook, this is `undefined` and surfaces
   * fall back to rendering `user`.
   */
  userLabel?: string;
  /** Preset-only top-level mirror; controller stamps on every preset write. */
  public?: boolean;
  /** Preset-only top-level mirror of `data.label`; stamped by controller. */
  label?: string;
  /** Equals `label` when `public=true`, else absent. Composite-unique on `(app,tableKey,publicLabel)`. */
  publicLabel?: string;
  /** Derived by the controller from `data.content` keys. */
  aspects?: PresetAspect[];
  data: AsPresetEntryData;
  createdAt: number;
  updatedAt: number;
}

/**
 * Per-`(app, tableKey, user)` capabilities surfaced to the client so the UI
 * can hide "Save as public" / disable "Save" before the user submits. Backed
 * by the same hooks the write path uses, so client-side checks and
 * server-side enforcement can never diverge.
 */
export interface PresetCapabilities {
  /** Whether the current user may set `public: true` on presets in this scope. */
  canPublish: boolean;
  /** Per-`(app, tableKey, user)` preset cap. Picker derives "near limit" by counting owned rows locally. */
  presetLimit: number;
  /**
   * Server-known opaque identity for the current user (whatever
   * `getCurrentUser` returns). Used by the picker / dialog to classify rows
   * as "owned" without needing to derive it from the presets list — which
   * fails when a user has *only* public presets (every private-row check
   * falls back to null and own-public rows look like others-public). The
   * controller is the single source of truth for identity, so plumbing it
   * here also closes a class of off-by-one bugs across surfaces.
   */
  userId: string;
}
