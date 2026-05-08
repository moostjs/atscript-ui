import { createAdapter } from "@atscript/db-sqlite";
import { syncSchema } from "@atscript/db/sync";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { defineAnnotatedType } from "@atscript/typescript/utils";

import { AsWfStore, type AsWfStoreOptions } from "../store/wf-store";
import { TestWfStateRecord } from "./fixtures/test-wf-state.as";

// ── In-memory adapter setup ──────────────────────────────────

interface SetupOpts<T extends TAtscriptAnnotatedType = typeof TestWfStateRecord> extends Pick<
  AsWfStoreOptions,
  "clock" | "actor"
> {
  /** Record to sync. Defaults to `TestWfStateRecord`. */
  record?: T;
}

/** In-memory SQLite space synced against `opts.record` (default: `TestWfStateRecord`). */
export async function setupTable<T extends TAtscriptAnnotatedType = typeof TestWfStateRecord>(
  opts?: SetupOpts<T>,
) {
  const record = (opts?.record ?? (TestWfStateRecord as unknown as T)) as T;
  const space = createAdapter(":memory:");
  await syncSchema(space, [record], { force: true });
  const table = space.getTable(record);
  return { space, table };
}

/** In-memory store + table. */
export async function setupStore<T extends TAtscriptAnnotatedType = typeof TestWfStateRecord>(
  opts?: SetupOpts<T>,
) {
  const { space, table } = await setupTable(opts);
  const store = new AsWfStore({
    // biome-ignore lint/suspicious/noExplicitAny: subtype generic — store only touches base columns
    table: table as any,
    clock: opts?.clock,
    actor: opts?.actor,
  });
  return { space, table, store };
}

// ── Programmatic type builders (for edge-case tests) ─────────

function annotate(h: ReturnType<typeof defineAnnotatedType>, meta?: Record<string, unknown>) {
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
}

export function stringProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("string");
  annotate(h, meta);
  return h.$type;
}

export function phantomProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("phantom");
  annotate(h, meta);
  return h.$type;
}

export function objectType(
  props: Record<string, TAtscriptAnnotatedType>,
  meta?: Record<string, unknown>,
) {
  const h = defineAnnotatedType("object");
  for (const [name, prop] of Object.entries(props)) h.prop(name, prop);
  annotate(h, meta);
  return h.$type;
}
