import type { AtscriptDbTable } from "@atscript/db";
import type { WfState, WfStateStore } from "@prostojs/wf/outlets";

/**
 * Options for {@link AsWfStore}.
 *
 * The store implements `WfStateStore` from `@prostojs/wf/outlets` against a
 * consumer-provided `AtscriptDbTable` whose row shape extends
 * `AsWfStateRecord` with their own `@meta.id`-bearing primary key column.
 */
export interface AsWfStoreOptions {
  /**
   * Consumer's `@meta.id`-bearing extension of `AsWfStateRecord`.
   *
   * Typed as `AtscriptDbTable<any>` because the consumer's extended class
   * (e.g. `extends AsWfStateRecord` plus `@meta.id`) is structurally a
   * different annotated type than the base — `AtscriptDbTable<typeof
   * AsWfStateRecord>` would not accept the subtype, and there is no public
   * variance helper. The store only touches base columns, so the loose
   * generic here is safe.
   */
  table: AtscriptDbTable<any>;
  /** Optional clock for testability. Default: `{ now: () => Date.now() }`. */
  clock?: { now(): number };
  /**
   * Returns the actor stamping `createdBy` / `lastUpdatedBy` on each write.
   * Invoked at write time. If the resolver is omitted or returns `undefined`,
   * the columns stay unset (null).
   */
  actor?: () => string | undefined;
}

const defaultClock = { now: () => Date.now() };

/**
 * Persistent {@link WfStateStore} backed by an atscript-db table.
 *
 * The full `WfState` is stored as-is in the `state` column (`@db.json` blob).
 * `state.schemaId` is also lifted to the row's top-level `schemaId` column
 * so the indexed `schema_idx` can be used to enumerate flows by schema.
 */
export class AsWfStore implements WfStateStore {
  private readonly table: AtscriptDbTable<any>;
  private readonly clock: { now(): number };
  private readonly actor?: () => string | undefined;

  constructor(opts: AsWfStoreOptions) {
    this.table = opts.table;
    this.clock = opts.clock ?? defaultClock;
    this.actor = opts.actor;
  }

  async set(handle: string, state: WfState, expiresAt?: number): Promise<void> {
    const now = this.clock.now();
    const actor = this.actor?.();
    const existing = (await this.table.findOne({ filter: { handle } })) as
      | { createdAt: number; createdBy?: string }
      | null;

    // The `state` JSON column's atscript-validated shape is `{ context, indexes, meta? }`
    // (see as-wf-state.as). `schemaId` is lifted to the top-level indexed column
    // and stripped from the persisted blob; `get` re-attaches it on read so the
    // public API still hands callers a complete `WfState`.
    const { schemaId, ...stateBlob } = state;
    const payload = {
      handle,
      schemaId,
      state: stateBlob,
      updatedAt: now,
      ...(expiresAt !== undefined && { expiresAt }),
      ...(actor !== undefined && { lastUpdatedBy: actor }),
      ...(existing
        ? {
            createdAt: existing.createdAt,
            ...(existing.createdBy !== undefined && { createdBy: existing.createdBy }),
          }
        : {
            createdAt: now,
            ...(actor !== undefined && { createdBy: actor }),
          }),
    };

    if (existing) {
      await this.table.replaceMany({ handle }, payload);
    } else {
      await this.table.insertOne(payload);
    }
  }

  async get(handle: string): Promise<{ state: WfState; expiresAt?: number } | null> {
    const row = (await this.table.findOne({ filter: { handle } })) as
      | { schemaId: string; state: Omit<WfState, "schemaId">; expiresAt?: number | null }
      | null;
    if (!row) return null;
    const expiresAt = row.expiresAt ?? undefined;
    if (expiresAt !== undefined && expiresAt <= this.clock.now()) {
      // Fire-and-forget opportunistic delete; do not block return.
      void this.delete(handle);
      return null;
    }
    const state = { schemaId: row.schemaId, ...row.state } as WfState;
    return expiresAt === undefined ? { state } : { state, expiresAt };
  }

  async delete(handle: string): Promise<void> {
    // Ignore result; deleteMany on a missing row resolves with deletedCount 0.
    await this.table.deleteMany({ handle });
  }

  async getAndDelete(
    handle: string,
  ): Promise<{ state: WfState; expiresAt?: number } | null> {
    const row = (await this.table.findOne({ filter: { handle } })) as
      | { schemaId: string; state: Omit<WfState, "schemaId">; expiresAt?: number | null }
      | null;
    if (!row) return null;
    const expiresAt = row.expiresAt ?? undefined;
    const result = await this.table.deleteMany({ handle });
    if (result.deletedCount !== 1) return null;
    if (expiresAt !== undefined && expiresAt <= this.clock.now()) return null;
    const state = { schemaId: row.schemaId, ...row.state } as WfState;
    return expiresAt === undefined ? { state } : { state, expiresAt };
  }

  async cleanup(opts?: { retention?: number }): Promise<number> {
    const retention = opts?.retention;
    if (retention === Number.POSITIVE_INFINITY) return 0;
    const now = this.clock.now();
    const cutoff = retention && retention > 0 ? now - retention : now;
    const result = await this.table.deleteMany({ expiresAt: { $lte: cutoff } });
    return result.deletedCount;
  }
}
