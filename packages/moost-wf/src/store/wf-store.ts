import type { AtscriptDbTable } from "@atscript/db";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import type { WfState, WfStateStore } from "@prostojs/wf/outlets";

/** Internal row shape — only the columns the store reads back from the table. */
export type StoredRow = {
  schemaId: string;
  state: Omit<WfState, "schemaId">;
  expiresAt?: number | null;
  createdAt: number;
  createdBy?: string;
};

/** Per-field spec built once by {@link AsWfStore.scanShadowFields}. */
export interface ShadowFieldSpec {
  /** Column name on the row. */
  field: string;
  /** Pre-split dot-path into `state.context`. */
  path: string[];
  /** Expected primitive type, validated against the runtime value. */
  expectedType: "string" | "number" | "boolean";
  /** Whether the field is declared optional (`?:`) on the schema. */
  optional: boolean;
}

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
   * variance helper. The store only touches base columns + any
   * `@wf.context.copy`-annotated shadow columns, so the loose generic is safe.
   */
  // biome-ignore lint/suspicious/noExplicitAny: see jsdoc above
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
 * `state.schemaId` is lifted to a top-level indexed column so `schema_idx` can
 * enumerate flows by schema. Consumers may add **shadow columns** by annotating
 * fields on their schema extension with `@wf.context.copy 'path.in.context'` —
 * those columns are populated from `state.context` on every `set()` and made
 * available for filtering, sorting, and indexing.
 *
 * Subclass-friendly: most behaviour lives in `protected` methods. When
 * overriding `findRow`, preserve the `getAndDelete` contract (deleteMany +
 * `deletedCount === 1` race gate) — see method docstring.
 */
export class AsWfStore implements WfStateStore {
  // biome-ignore lint/suspicious/noExplicitAny: see AsWfStoreOptions.table
  protected readonly table: AtscriptDbTable<any>;
  protected readonly clock: { now(): number };

  readonly #actor?: () => string | undefined;
  #shadowFieldsCache: ShadowFieldSpec[] | null = null;
  readonly #warnedFields = new Set<string>();

  constructor(opts: AsWfStoreOptions) {
    this.table = opts.table;
    this.clock = opts.clock ?? defaultClock;
    this.#actor = opts.actor;
  }

  async set(handle: string, state: WfState, expiresAt?: number): Promise<void> {
    const now = this.clock.now();
    const actor = this.getActor();
    const existing = await this.findRow(handle);
    const payload = this.buildSetPayload(handle, state, { expiresAt, existing, now, actor });

    if (existing) {
      await this.table.replaceMany({ handle }, payload);
    } else {
      await this.table.insertOne(payload);
    }
  }

  async get(handle: string): Promise<{ state: WfState; expiresAt?: number } | null> {
    const row = await this.findRow(handle);
    if (!row) return null;
    const expiresAt = row.expiresAt ?? undefined;
    if (expiresAt !== undefined && expiresAt <= this.clock.now()) {
      // Fire-and-forget opportunistic delete; do not block return.
      void this.delete(handle);
      return null;
    }
    return this.assembleResult(row);
  }

  async delete(handle: string): Promise<void> {
    await this.table.deleteMany({ handle });
  }

  /**
   * Race-safe single-use consume.
   *
   * **Contract** (do not violate when overriding `findRow`):
   *   `findRow` → `deleteMany({ handle })` → `deletedCount === 1` gate.
   * Two concurrent callers: only one's delete returns `1`; the other returns
   * `null` (its delete found 0 rows).
   */
  async getAndDelete(handle: string): Promise<{ state: WfState; expiresAt?: number } | null> {
    const row = await this.findRow(handle);
    if (!row) return null;
    const result = await this.table.deleteMany({ handle });
    if (result.deletedCount !== 1) return null;
    const expiresAt = row.expiresAt ?? undefined;
    if (expiresAt !== undefined && expiresAt <= this.clock.now()) return null;
    return this.assembleResult(row);
  }

  /**
   * Delete expired rows.
   *
   * - `retention` absent or `0`: drop rows where `expiresAt <= now()`.
   * - `retention > 0`: drop rows where `expiresAt <= now() - retention` (grace).
   * - `retention === Number.POSITIVE_INFINITY`: no-op (return 0).
   */
  async cleanup(opts?: { retention?: number }): Promise<number> {
    const retention = opts?.retention;
    if (retention === Number.POSITIVE_INFINITY) return 0;
    const now = this.clock.now();
    const cutoff = retention && retention > 0 ? now - retention : now;
    const result = await this.table.deleteMany({ expiresAt: { $lte: cutoff } });
    return result.deletedCount;
  }

  /**
   * Re-apply `@wf.context.copy` shadow columns to existing rows.
   *
   * Use after adding a new annotation to backfill old rows without waiting for
   * each workflow to next pause. Returns the count of rows whose shadows were
   * (re-)written. Filter narrows the scan; defaults to all rows.
   *
   * No-op when the schema declares no `@wf.context.copy` fields.
   */
  async heal(opts?: { filter?: Record<string, unknown>; batchSize?: number }): Promise<number> {
    const specs = this.scanShadowFields();
    if (specs.length === 0) return 0;

    const batchSize = opts?.batchSize ?? 100;
    const baseFilter = opts?.filter ?? {};
    let healed = 0;
    let skip = 0;

    while (true) {
      const rows = (await this.table.findMany({
        filter: baseFilter,
        controls: {
          $skip: skip,
          $limit: batchSize,
          $sort: { handle: 1 },
          $select: ["handle", "schemaId", "state"],
        },
      })) as Array<StoredRow & { handle: string }>;
      if (rows.length === 0) break;

      for (const row of rows) {
        const wfState = { schemaId: row.schemaId, ...row.state } as WfState;
        const shadowPatch: Record<string, unknown> = {};
        this.applyShadows(shadowPatch, wfState);
        if (Object.keys(shadowPatch).length > 0) {
          await this.table.updateMany({ handle: row.handle }, shadowPatch);
          healed++;
        }
      }

      if (rows.length < batchSize) break;
      skip += rows.length;
    }

    return healed;
  }

  // ── Extension points ──────────────────────────────────────────────────

  /** Resolve the actor stamping createdBy/lastUpdatedBy. Override for custom auth. */
  protected getActor(): string | undefined {
    return this.#actor?.();
  }

  /** Storage primitive: load a row by handle. Override for sharded/multi-tenant tables. */
  protected async findRow(handle: string): Promise<StoredRow | null> {
    return (await this.table.findOne({ filter: { handle } })) as StoredRow | null;
  }

  /** Re-attach `schemaId` to the JSON `state` blob and add expiresAt if set. */
  protected assembleResult(row: StoredRow): { state: WfState; expiresAt?: number } {
    const state = { schemaId: row.schemaId, ...row.state } as WfState;
    const expiresAt = row.expiresAt ?? undefined;
    return expiresAt === undefined ? { state } : { state, expiresAt };
  }

  /** Compose the row payload written on `set()`. Override to add custom columns. */
  protected buildSetPayload(
    handle: string,
    state: WfState,
    opts: { expiresAt?: number; existing: StoredRow | null; now: number; actor?: string },
  ): Record<string, unknown> {
    const { schemaId, ...stateBlob } = state;
    const { existing, actor } = opts;
    const createdBy = existing ? existing.createdBy : actor;
    const payload: Record<string, unknown> = {
      handle,
      schemaId,
      state: stateBlob,
      updatedAt: opts.now,
      createdAt: existing ? existing.createdAt : opts.now,
    };
    if (opts.expiresAt !== undefined) payload.expiresAt = opts.expiresAt;
    if (actor !== undefined) payload.lastUpdatedBy = actor;
    if (createdBy !== undefined) payload.createdBy = createdBy;

    this.applyShadows(payload, state);
    return payload;
  }

  /**
   * Copy values from `state.context` onto the payload using cached specs.
   * Optional fields get `null` on path-miss / type-mismatch (clears stale
   * values). Non-optional default-bearing fields are *omitted* on miss — DB
   * defaults fire on insert, prior value sticks on update.
   */
  protected applyShadows(payload: Record<string, unknown>, state: WfState): void {
    const specs = this.scanShadowFields();
    if (specs.length === 0) return;
    const ctx = state.context;
    for (const spec of specs) {
      const raw = this.resolvePath(ctx, spec.path);
      const coerced = this.coerceShadowValue(raw, spec);
      if (coerced !== undefined) {
        payload[spec.field] = coerced;
      } else if (spec.optional) {
        payload[spec.field] = null;
      }
    }
  }

  /** Dot-path resolver. Returns `undefined` on miss, array hit, or non-object. */
  protected resolvePath(obj: unknown, path: string[]): unknown {
    let cur: unknown = obj;
    for (const seg of path) {
      if (cur === null || cur === undefined) return undefined;
      if (typeof cur !== "object") return undefined;
      if (Array.isArray(cur)) return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
  }

  /** Validate primitive type. `undefined` means "do not write" — applyShadows decides null vs omit. */
  protected coerceShadowValue(raw: unknown, spec: ShadowFieldSpec): unknown {
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw === spec.expectedType) return raw;
    this.onShadowTypeMismatch(spec.field, spec.expectedType, raw);
    return undefined;
  }

  /** Type-mismatch diagnostic. Fires once per field per store instance. */
  protected onShadowTypeMismatch(field: string, expected: string, actual: unknown): void {
    if (this.#warnedFields.has(field)) return;
    this.#warnedFields.add(field);
    // biome-ignore lint/suspicious/noConsole: diagnostic for misconfigured shadow column
    console.warn(
      `[AsWfStore] @wf.context.copy field "${field}" expected ${expected} but got ${typeof actual} — writing null. Subsequent mismatches on this field are silent.`,
    );
  }

  /** Lazily build shadow specs from `@wf.context.copy` annotations. Override for a different source annotation. */
  protected scanShadowFields(): ShadowFieldSpec[] {
    if (this.#shadowFieldsCache !== null) return this.#shadowFieldsCache;
    const specs: ShadowFieldSpec[] = [];

    const tableType = this.table.type as TAtscriptAnnotatedType;
    if (tableType?.type?.kind === "object") {
      for (const [fieldName, fieldType] of tableType.type.props) {
        const path = fieldType.metadata.get("wf.context.copy") as string | undefined;
        if (!path) continue;
        const expectedType = this.resolveFieldPrimitive(fieldType);
        // Plugin-side validation rejects non-primitive fields; runtime miss = silently skip.
        if (expectedType === undefined) continue;
        specs.push({
          field: fieldName,
          path: path.split("."),
          expectedType,
          optional: fieldType.optional === true,
        });
      }
    }

    this.#shadowFieldsCache = specs;
    return specs;
  }

  /** Resolve a field's runtime primitive type, or `undefined` if not a copy-supported primitive. */
  protected resolveFieldPrimitive(
    fieldType: TAtscriptAnnotatedType,
  ): "string" | "number" | "boolean" | undefined {
    const def = fieldType.type;
    if (def.kind !== "") return undefined;
    const { designType } = def;
    if (designType === "string" || designType === "number" || designType === "boolean") {
      return designType;
    }
    return undefined;
  }
}
