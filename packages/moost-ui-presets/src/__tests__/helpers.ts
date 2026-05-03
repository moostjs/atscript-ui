import { createAdapter } from "@atscript/db-sqlite";
import { syncSchema } from "@atscript/db/sync";
import { expect } from "vite-plus/test";
import type { AtscriptDbTable } from "@atscript/db";

import { AsPresetEntry } from "../as-preset-entry.as";
import {
  type PresetHooks,
  type PresetTable,
  type WriteAction,
  buildCapabilities,
  buildReadGate,
  processRemove,
  processWrite,
  userConfId,
} from "../preset-rules";
import type { PresetCapabilities } from "../types";

export async function createSpace(): Promise<{
  space: ReturnType<typeof createAdapter>;
  table: AtscriptDbTable<typeof AsPresetEntry>;
}> {
  const space = createAdapter(":memory:");
  await syncSchema(space, [AsPresetEntry], { force: true });
  const table = space.getTable(AsPresetEntry) as AtscriptDbTable<typeof AsPresetEntry>;
  return { space, table };
}

/** Composes the per-test setup: in-memory space + table + controller. */
export async function setup(
  user = "bob",
  opts?: ControllerOpts,
): Promise<{
  space: ReturnType<typeof createAdapter>;
  table: AtscriptDbTable<typeof AsPresetEntry>;
  ctrl: TestPresetsController;
}> {
  const { space, table } = await createSpace();
  const ctrl = new TestPresetsController(table, user, opts);
  return { space, table, ctrl };
}

export interface ControllerOpts {
  maxPresetsPerUser?: number;
  maxPresetsResolver?: (app: string, tableKey: string, user: string) => Promise<number>;
  /** Default `true` (matches controller). Override for publish-permission specs. */
  canPublishResolver?: (app: string, tableKey: string, user: string) => Promise<boolean>;
}

// Specs target the helpers directly because the real controller's class-level
// decorator isn't parsed by the vp-test (swc) transform.
export class TestPresetsController {
  private currentUser: string;
  private readonly table: PresetTable;
  private readonly hooks: PresetHooks;

  constructor(
    table: AtscriptDbTable<typeof AsPresetEntry>,
    user: string,
    opts: ControllerOpts = {},
  ) {
    this.table = table as unknown as PresetTable;
    this.currentUser = user;
    const cap = opts.maxPresetsPerUser ?? 10;
    this.hooks = {
      getMaxPresetsPerUser: opts.maxPresetsResolver ?? (async () => cap),
      canPublishPresets: opts.canPublishResolver ?? (async () => true),
    };
  }

  setCurrentUser(user: string): void {
    this.currentUser = user;
  }

  callTransformFilter(filter: unknown): Promise<unknown> {
    return Promise.resolve(buildReadGate(this.currentUser, filter as never));
  }

  callOnWrite(action: WriteAction, data: unknown): Promise<unknown> {
    return processWrite(this.table, this.currentUser, action, data, this.hooks);
  }

  callOnRemove(id: unknown): Promise<unknown> {
    return processRemove(this.table, id, this.currentUser);
  }

  callCapabilities(app: unknown, tableKey: unknown): Promise<PresetCapabilities> {
    return buildCapabilities(app, tableKey, this.currentUser, this.hooks);
  }
}

export interface PresetSeed {
  id?: string;
  type?: "preset" | "userConf";
  app: string;
  tableKey: string;
  user: string;
  public?: boolean;
  data?: Record<string, unknown>;
}

export async function seedPreset(
  table: AtscriptDbTable<typeof AsPresetEntry>,
  seed: PresetSeed,
): Promise<string> {
  const now = Date.now();
  const id = seed.id ?? globalThis.crypto.randomUUID();
  const data = seed.data ?? { label: "Untitled" };
  const type = seed.type ?? "preset";
  // Mirror data.label → top-level `label` for preset rows (the controller
  // does this on every preset write; this seed bypasses the controller).
  const label = type === "preset" ? (data.label as string | undefined) : undefined;
  const isPublic = seed.public ?? false;
  await table.insertOne({
    id,
    type,
    app: seed.app,
    tableKey: seed.tableKey,
    user: seed.user,
    public: isPublic,
    label,
    publicLabel: type === "preset" && isPublic ? label : undefined,
    data,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function seedUserConf(
  table: AtscriptDbTable<typeof AsPresetEntry>,
  user: string,
  app: string,
  tableKey: string,
  data: Record<string, unknown> = {},
): Promise<string> {
  const id = userConfId(user, app, tableKey);
  const now = Date.now();
  await table.insertOne({
    id,
    type: "userConf",
    app,
    tableKey,
    user,
    data,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function expectHttpRejection<TBody = { code?: string; message: string }>(
  // Thunk so synchronous throws (e.g. from `buildReadGate`) are also caught.
  fn: () => unknown,
  status: number,
  code?: string,
): Promise<{ code: number; body: TBody & { code?: string; message: string } }> {
  let err: unknown;
  try {
    await fn();
  } catch (e) {
    err = e;
  }
  expect(err).toMatchObject(code != null ? { code: status, body: { code } } : { code: status });
  return err as { code: number; body: TBody & { code?: string; message: string } };
}
