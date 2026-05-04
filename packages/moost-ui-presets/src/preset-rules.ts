import { HttpError } from "@moostjs/event-http";
import {
  RESERVED_ID_PREFIXES,
  appConfId,
  derivePresetAspects,
  isSystemPresetId,
  userConfId,
} from "@atscript/ui-table";
import { walkFilter } from "@uniqu/core";
import type { AsPresetsErrorCode, PresetAspect, PresetCapabilities } from "@atscript/ui-table";
import type { FilterExpr, FilterVisitor, SelectExpr } from "@uniqu/core";

const IDENTITY_FIELDS: readonly (keyof PresetRowLike)[] = ["user", "app", "tableKey"];

export type WriteAction =
  | "insert"
  | "insertMany"
  | "replace"
  | "replaceMany"
  | "update"
  | "updateMany";

// Bulk / replace verbs disabled to close the cap-bypass and identity-bypass
// paths `replace` would open through `processCreateRow`.
const SUPPORTED_ACTIONS: ReadonlySet<WriteAction> = new Set(["insert", "update"]);

const ROW_TYPES = ["preset", "userConf", "appConf"] as const;

export type RowType = (typeof ROW_TYPES)[number];

function isRowType(t: unknown): t is RowType {
  return (ROW_TYPES as readonly unknown[]).includes(t);
}

export interface PresetRowLike {
  id?: string;
  type?: RowType;
  app?: string;
  tableKey?: string;
  user?: string;
  userLabel?: string;
  public?: boolean;
  label?: string;
  publicLabel?: string;
  aspects?: PresetAspect[];
  data?: Record<string, unknown> | null;
  createdAt?: number;
  updatedAt?: number;
}

// `public`, `label`, `publicLabel`, `aspects` are preset-only top-level fields.
// userConf/appConf rows must never carry them — wire values are scrubbed on
// every write so a client can't leak e.g. `public: true` onto a userConf row
// and pollute the `preset_public_idx`. (`tableKey` is row-type-specific and
// handled at the call site.)
function scrubPresetOnlyFields(row: PresetRowLike): void {
  row.public = undefined;
  row.label = undefined;
  row.publicLabel = undefined;
  row.aspects = undefined;
}

export interface PresetTable {
  findOne(query: {
    filter: Record<string, unknown>;
    controls?: { $select?: SelectExpr };
  }): Promise<unknown>;
  findMany(query: {
    filter: Record<string, unknown>;
    controls?: { $select?: SelectExpr };
  }): Promise<unknown[]>;
  count(query: { filter: Record<string, unknown> }): Promise<number>;
}

function presetError(
  status: 400 | 403 | 405 | 409,
  body: { message: string; code: AsPresetsErrorCode; [k: string]: unknown },
): HttpError {
  return new HttpError(status, body as never);
}

function requireString(
  value: unknown,
  message: string,
  code: AsPresetsErrorCode,
): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw presetError(400, { message, code });
  }
}

function assertNotReservedId(id: unknown): void {
  if (typeof id !== "string") return;
  for (const prefix of RESERVED_ID_PREFIXES) {
    if (id.startsWith(prefix)) {
      throw presetError(400, {
        message: `Reserved id namespace '${prefix}'; server owns these ids`,
        code: "reserved_id",
      });
    }
  }
}

// Synthetic system presets are never persisted, so any update/remove targeting
// `sys:*` is malformed. Rejected explicitly so callers see `reserved_id` rather
// than the generic `identity_immutable` they'd get from the owner-check 403.
function assertNotSystemId(id: unknown): void {
  if (typeof id === "string" && isSystemPresetId(id)) {
    throw presetError(400, {
      message: "Reserved id namespace; system presets are synthetic and not persisted",
      code: "reserved_id",
    });
  }
}

interface ReadGateProbe {
  app?: string;
  tableKey?: string;
  isAppConf: boolean;
}

// `$or` / `$not` collapse to no-info: nothing inside them is guaranteed to hold,
// so the request hasn't actually pinned a scope and the read gate must reject it.
const readGateVisitor: FilterVisitor<ReadGateProbe> = {
  comparison(field, op, value) {
    if (op !== "$eq") return { isAppConf: false };
    if (field === "type") return { isAppConf: value === "appConf" };
    if (typeof value !== "string") return { isAppConf: false };
    if (field === "app") return { app: value, isAppConf: false };
    if (field === "tableKey") return { tableKey: value, isAppConf: false };
    return { isAppConf: false };
  },
  and(children) {
    const out: ReadGateProbe = { isAppConf: false };
    for (const c of children) {
      if (out.app === undefined && c.app !== undefined) out.app = c.app;
      if (out.tableKey === undefined && c.tableKey !== undefined) out.tableKey = c.tableKey;
      if (c.isAppConf) out.isAppConf = true;
    }
    return out;
  },
  or: () => ({ isAppConf: false }),
  not: () => ({ isAppConf: false }),
};

export function buildReadGate(user: string, filter: FilterExpr): FilterExpr {
  const probe = walkFilter(filter ?? undefined, readGateVisitor) ?? { isAppConf: false };
  requireString(probe.app, "Preset reads must include 'app'", "missing_scope");
  if (!probe.isAppConf) {
    requireString(
      probe.tableKey,
      "Preset / userConf reads must include 'tableKey'",
      "missing_scope",
    );
  }
  const gate: FilterExpr = {
    $or: [{ user: user }, { $and: [{ type: "preset" }, { public: true }] }],
  };
  return filter ? { $and: [gate, filter] } : gate;
}

export type GetMaxPresetsPerUser = (app: string, tableKey: string, user: string) => Promise<number>;

export type CanPublishPresets = (app: string, tableKey: string, user: string) => Promise<boolean>;

/**
 * Resolve a display label for the current writer (e.g. their username) to
 * be stamped on the row at write-time. Optional — when absent or returning
 * undefined, the row's `userLabel` stays empty and consumers fall back to
 * `user` (the opaque identity string).
 */
export type GetUserLabel = (user: string) => Promise<string | undefined>;

export interface PresetHooks {
  getMaxPresetsPerUser: GetMaxPresetsPerUser;
  canPublishPresets: CanPublishPresets;
  getUserLabel?: GetUserLabel;
}

interface WriteCtx {
  table: PresetTable;
  user: string;
  hooks: PresetHooks;
}

// Wide columns (`aspects`) deliberately omitted — write path doesn't read them.
const EXISTING_SELECT = {
  id: 1,
  type: 1,
  user: 1,
  app: 1,
  tableKey: 1,
  public: 1,
  label: 1,
  data: 1,
} satisfies SelectExpr;

function fetchExisting(ctx: WriteCtx, id: string): Promise<PresetRowLike | null> {
  return ctx.table.findOne({
    filter: { id },
    controls: { $select: EXISTING_SELECT },
  }) as Promise<PresetRowLike | null>;
}

export async function processWrite(
  table: PresetTable,
  user: string,
  action: WriteAction,
  data: unknown,
  hooks: PresetHooks,
): Promise<PresetRowLike> {
  if (!SUPPORTED_ACTIONS.has(action)) {
    throw presetError(405, {
      message: `Action '${action}' is not supported; use insert or update one row at a time`,
      code: "action_unsupported",
    });
  }
  const ctx: WriteCtx = { table, user, hooks };
  const row = data as PresetRowLike;
  if (action === "update") return processUpdateRow(ctx, row);
  return processCreateRow(ctx, row);
}

async function processCreateRow(ctx: WriteCtx, row: PresetRowLike): Promise<PresetRowLike> {
  const { user, hooks } = ctx;
  const next: PresetRowLike = { ...row };
  // Wire `user` / `userLabel` are sourced from session to prevent spoofed attribution.
  next.user = user;
  const userLabelPromise = hooks.getUserLabel?.(user);
  const now = Date.now();
  next.updatedAt = now;
  if (typeof next.createdAt !== "number") next.createdAt = now;

  if (!isRowType(next.type)) {
    throw presetError(400, {
      message: "type must be 'preset', 'userConf', or 'appConf'",
      code: "invalid_type",
    });
  }
  requireString(next.app, "'app' is required", "missing_scope");

  if (next.type === "appConf") {
    next.tableKey = undefined;
    next.id = appConfId(user, next.app);
    scrubPresetOnlyFields(next);
    next.userLabel = await userLabelPromise;
    return next;
  }

  requireString(
    next.tableKey,
    "'tableKey' is required for preset / userConf rows",
    "missing_scope",
  );

  if (next.type === "userConf") {
    next.id = userConfId(user, next.app, next.tableKey);
    scrubPresetOnlyFields(next);
    await sanitiseUserConfData(ctx, next, next.app, next.tableKey);
    next.userLabel = await userLabelPromise;
    return next;
  }

  // Reject reserved prefixes so the client can't squat server-owned namespaces.
  assertNotReservedId(next.id);
  if (typeof next.id !== "string" || next.id.length === 0) {
    next.id = globalThis.crypto.randomUUID();
  }
  next.label = readPresetLabel(next.data);
  next.publicLabel = next.public === true ? next.label : undefined;
  const capCheck = assertWithinCap(ctx, next.app, next.tableKey);
  const publicCheck =
    next.public === true
      ? gatePublicPreset(ctx, next.app, next.tableKey, null, {
          public: true,
          label: next.label,
          id: next.id,
        })
      : undefined;
  const [, , userLabel] = await Promise.all([capCheck, publicCheck, userLabelPromise]);
  next.userLabel = userLabel;
  next.aspects = derivePresetAspects((next.data as { content?: unknown } | null)?.content);
  return next;
}

// Grandfather already-public rows when the publish permission is later revoked
// (only the private→public transition is gated, mirroring the per-user cap).
async function gatePublicPreset(
  ctx: WriteCtx,
  app: string,
  tableKey: string,
  prev: { public: boolean; label: string } | null,
  next: { public: boolean; label: string; id: string },
): Promise<void> {
  if (!next.public) return;
  const wasPublic = prev?.public === true;
  const labelChanged = !wasPublic || prev?.label !== next.label;
  const publishCheck = wasPublic ? undefined : assertCanPublish(ctx, app, tableKey);
  const labelCheck = labelChanged
    ? assertPublicLabelFree(ctx, app, tableKey, next.label, next.id)
    : undefined;
  await Promise.all([publishCheck, labelCheck]);
}

const ownerError = (): HttpError =>
  presetError(403, { message: "Forbidden — not the row owner", code: "identity_immutable" });

function requireOwner(
  existing: PresetRowLike | null,
  user: string,
): asserts existing is PresetRowLike {
  if (!existing || existing.user !== user) throw ownerError();
}

async function processUpdateRow(ctx: WriteCtx, row: PresetRowLike): Promise<PresetRowLike> {
  const { user, hooks } = ctx;
  const next: PresetRowLike = { ...row };
  requireString(next.id, "Update payload must include 'id'", "missing_id");
  assertNotSystemId(next.id);
  const existing = await fetchExisting(ctx, next.id);
  requireOwner(existing, user);
  // Re-resolved on every update so a renamed user propagates to existing presets.
  const userLabelPromise = hooks.getUserLabel?.(user);
  if (next.type !== undefined && next.type !== existing.type) {
    throw presetError(400, {
      message: "Field 'type' is immutable after create",
      code: "type_immutable",
    });
  }
  for (const key of IDENTITY_FIELDS) {
    if (next[key] !== undefined && next[key] !== existing[key]) {
      throw presetError(400, {
        message: `Field '${key}' is immutable after create`,
        code: "identity_immutable",
      });
    }
  }
  next.updatedAt = Date.now();

  // Shallow merge so a partial patch doesn't wipe unmodified `data` fields.
  const mergedData =
    next.data === undefined ? (existing.data ?? null) : { ...existing.data, ...next.data };
  if (next.data !== undefined) next.data = mergedData;

  if (existing.type === "appConf") {
    next.tableKey = undefined;
    scrubPresetOnlyFields(next);
    next.userLabel = await userLabelPromise;
    return next;
  }

  // app/tableKey are NOT NULL in schema for preset/userConf rows.
  const app = existing.app!;
  const tableKey = existing.tableKey!;

  if (existing.type === "userConf") {
    scrubPresetOnlyFields(next);
    const newRef = (mergedData as { defaultPresetId?: unknown }).defaultPresetId;
    const oldRef = (existing.data as { defaultPresetId?: unknown } | null)?.defaultPresetId;
    if (newRef !== oldRef) {
      await sanitiseUserConfData(ctx, next, app, tableKey);
    }
    next.userLabel = await userLabelPromise;
    return next;
  }

  const wasPublic = existing.public === true;
  const willBePublic = next.public ?? wasPublic;
  const prevLabel = existing.label ?? readPresetLabel(existing.data);
  const nextLabel = readPresetLabel(mergedData);
  next.label = nextLabel;
  next.publicLabel = willBePublic ? nextLabel : undefined;
  const [, userLabel] = await Promise.all([
    gatePublicPreset(
      ctx,
      app,
      tableKey,
      { public: wasPublic, label: prevLabel },
      { public: willBePublic, label: nextLabel, id: existing.id! },
    ),
    userLabelPromise,
  ]);
  next.userLabel = userLabel;
  // `aspects` only changes when `data.content` changes — togglePublic /
  // renamePreset never touch content, so leave the column untouched on those
  // paths and skip a redundant index write.
  const patchHasContent =
    next.data !== undefined &&
    typeof next.data === "object" &&
    next.data !== null &&
    "content" in (next.data as Record<string, unknown>);
  if (patchHasContent) {
    next.aspects = derivePresetAspects((mergedData as { content?: unknown } | null)?.content);
  }
  return next;
}

export async function processRemove(
  table: PresetTable,
  id: unknown,
  user: string,
): Promise<unknown> {
  requireString(id, "id must be a string", "missing_scope");
  assertNotSystemId(id);
  const existing = (await table.findOne({
    filter: { id },
    controls: { $select: { id: 1, user: 1 } satisfies SelectExpr },
  })) as PresetRowLike | null;
  requireOwner(existing, user);
  return id;
}

// Indexed `findOne` against the top-level `label` column (stamped on every
// preset write); `data.label` is the canonical source but isn't portably
// queryable as a JSON path across adapters.
async function assertPublicLabelFree(
  ctx: WriteCtx,
  app: string,
  tableKey: string,
  label: string,
  excludingId?: string,
): Promise<void> {
  if (!label) return;
  const filter: Record<string, unknown> = {
    type: "preset",
    public: true,
    app,
    tableKey,
    label,
  };
  if (excludingId) filter.id = { $ne: excludingId };
  const conflict = (await ctx.table.findOne({
    filter,
    controls: { $select: { id: 1 } satisfies SelectExpr },
  })) as { id: string } | null;
  if (conflict) {
    throw presetError(409, {
      message: `Public preset "${label}" already exists`,
      code: "public_name_conflict",
    });
  }
}

async function assertCanPublish(ctx: WriteCtx, app: string, tableKey: string): Promise<void> {
  if (!(await ctx.hooks.canPublishPresets(app, tableKey, ctx.user))) {
    throw presetError(403, {
      message: "Forbidden — current user cannot publish presets in this scope",
      code: "publish_forbidden",
    });
  }
}

export async function buildCapabilities(
  app: unknown,
  tableKey: unknown,
  user: string,
  hooks: PresetHooks,
): Promise<PresetCapabilities> {
  requireString(app, "'app' query param is required", "missing_scope");
  requireString(tableKey, "'tableKey' query param is required", "missing_scope");
  const [canPublish, presetLimit] = await Promise.all([
    hooks.canPublishPresets(app, tableKey, user),
    hooks.getMaxPresetsPerUser(app, tableKey, user),
  ]);
  return { canPublish, presetLimit, userId: user };
}

// userConf rows excluded — only `type='preset'` counts toward the cap, and
// existing rows are grandfathered when the cap is lowered.
async function assertWithinCap(ctx: WriteCtx, app: string, tableKey: string): Promise<void> {
  const { table, user, hooks } = ctx;
  const [limit, count] = await Promise.all([
    hooks.getMaxPresetsPerUser(app, tableKey, user),
    table.count({ filter: { type: "preset", user, app, tableKey } }),
  ]);
  if (count >= limit) {
    throw presetError(409, {
      message: `Preset limit reached (${count}/${limit})`,
      code: "preset_limit_reached",
      limit,
      count,
    });
  }
}

// Drop `data.defaultPresetId` silently when it references a preset the user
// cannot read, so a stale pin doesn't survive across sessions.
async function sanitiseUserConfData(
  ctx: WriteCtx,
  row: PresetRowLike,
  app: string,
  tableKey: string,
): Promise<void> {
  if (!row.data || typeof row.data !== "object") return;
  const data = row.data as Record<string, unknown>;
  const ref = data.defaultPresetId;
  if (typeof ref !== "string" || ref.length === 0) return;
  // sys:* refs are opaque pointers; don't try to resolve them server-side.
  if (isSystemPresetId(ref)) return;
  const { table, user } = ctx;
  const target = (await table.findOne({
    filter: { id: ref },
    controls: {
      $select: { app: 1, tableKey: 1, type: 1, user: 1, public: 1 } satisfies SelectExpr,
    },
  })) as PresetRowLike | null;
  const visible =
    target &&
    target.app === app &&
    target.tableKey === tableKey &&
    target.type === "preset" &&
    (target.user === user || target.public === true);
  if (!visible) {
    delete data.defaultPresetId;
  }
}

function readPresetLabel(data: unknown): string {
  if (data && typeof data === "object" && "label" in data) {
    const label = (data as { label?: unknown }).label;
    if (typeof label === "string") return label;
  }
  return "";
}
