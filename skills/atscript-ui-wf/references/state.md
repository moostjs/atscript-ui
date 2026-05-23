# state

Persistent workflow state via `AsWfStore` + `@wf.store.fromContext` shadow columns.

## Contents

- [AsWfStore overview](#aswfstore-overview)
- [Constructor](#constructor)
- [AsWfStateRecord base schema](#aswfstaterecord-base-schema)
- [Extending AsWfStateRecord](#extending-aswfstaterecord)
- [Shadow columns — @wf.store.fromContext](#shadow-columns--wfstorefromcontext)
- [Shadow column constraints](#shadow-column-constraints)
- [Methods](#methods)
- [When to run heal()](#when-to-run-heal)
- [CJS limitation](#cjs-limitation)
- [Wiring AsWfStore into the workflow engine](#wiring-aswfstore-into-the-workflow-engine)
- [Recipe — invite + register flow with shadow column lookup](#recipe--invite--register-flow-with-shadow-column-lookup)

## AsWfStore overview

`AsWfStore` implements `WfStateStore` from `@prostojs/wf/outlets`. It is a **DB-backed persistent state store** keyed on `handle` (the workflow state token).

The default `@moostjs/event-wf` setup ships with an in-memory store. Use `AsWfStore` when:

- State must survive process restarts.
- Multiple service instances share the same flow set.
- Flows pause long enough that memory eviction is a risk (magic links, webhook callbacks).
- You want to query paused flows from an admin UI (extend the schema with shadow columns).

Import:

```typescript
import { AsWfStore, AsWfStateRecord } from "@atscript/moost-wf/store";
```

Note the `/store` subpath. **ESM-only** — see [CJS limitation](#cjs-limitation).

## Constructor

```typescript
new AsWfStore({
  table: AtscriptDbTable<TRow>,
  clock?: { now(): number },
  actor?: () => string | undefined,
})
```

| Option  | Default                     | Purpose                                                                                                                                                                 |
| ------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `table` | (required)                  | `AtscriptDbTable<TRow>` from `@atscript/db` — your schema extension. See [Extending AsWfStateRecord](#extending-aswfstaterecord).                                       |
| `clock` | `{ now: () => Date.now() }` | testability — override for deterministic expiry tests                                                                                                                   |
| `actor` | `undefined`                 | callback returning the current user / service id. Stamps `createdBy` on insert, `lastUpdatedBy` on update. Invoked **at write time** — wire to your session composable. |

## AsWfStateRecord base schema

Exported by `@atscript/moost-wf` as an interface — extend it in your project.

| Column           | Type               | Annotations                                                                  | Notes                                                                     |
| ---------------- | ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `handle`         | `string`           | `@db.index.unique 'handle_idx'`, `@expect.maxLength 256`, `@ui.table.hidden` | engine's state token; primary correlation key                             |
| `schemaId`       | `string`           | `@db.index.plain 'schema_idx'`, `@expect.maxLength 256`                      | workflow id (e.g. `'auth/login'`)                                         |
| `state`          | object             | `@db.json`, `@ui.table.hidden`                                               | `{ context: JsonValue, indexes: number[], meta?: ... }` — opaque snapshot |
| `expiresAt?`     | `number.timestamp` | `@db.index.plain 'expires_idx'`                                              | optional expiry; `cleanup()` deletes past this                            |
| `updatedAt`      | `number.timestamp` | `@db.default.now`, `@db.index.plain 'updated_idx'`                           | bumped on every `set()`                                                   |
| `createdAt`      | `number.timestamp` | —                                                                            | set once on insert                                                        |
| `createdBy?`     | `string`           | `@expect.maxLength 128`, `@ui.table.hidden`                                  | actor at insert                                                           |
| `lastUpdatedBy?` | `string`           | `@expect.maxLength 128`, `@ui.table.hidden`                                  | actor on each update                                                      |

The schema deliberately **does not declare a primary key**. The consumer's extension adds `@meta.id` on whichever column they choose (`id` UUID is the typical default). The store reads/writes by `handle`, not by `@meta.id`.

See `atscript-db` skill for the `@db.*` annotation surface used here.

## Extending AsWfStateRecord

```atscript
// src/wf/wf-state.as
//
// Subpath duality: `.as` files import the model from `/store.as` (raw atscript
// source); `.ts` files import the runtime class from `/store` (compiled module).
import { AsWfStateRecord } from '@atscript/moost-wf/store.as'

@db.table 'wf_states'
export interface WfStateRow extends AsWfStateRecord {
    @meta.id
    @db.default.uuid
    id: string

    // Shadow column — copied from state.context.email on every set()
    @wf.store.fromContext 'email'
    @db.index.plain 'wf_email_idx'
    @expect.maxLength 256
    inviteEmail?: string
}
```

Then wire it in your DB space (see `atscript-db` skill for the full DbSpace setup):

```typescript
import { defineDbSpace } from "@atscript/db";
import { WfStateRow } from "./wf-state.as";

export const wfStatesTable = dbSpace.defineTable(WfStateRow);
```

And construct the store:

```typescript
const wfStore = new AsWfStore({
  table: wfStatesTable,
  actor: () => useSession().userId,
});
```

The `/store.as` subpath ships the raw `.as` file for re-export from your own schema module.

## Shadow columns — @wf.store.fromContext

```atscript
@wf.store.fromContext 'path.in.context'
inviteEmail?: string
```

A **shadow column** is a top-level DB column whose value is copied from `state.context` on every `AsWfStore.set()`. Lets you index, filter, and sort paused flows on context values without scanning the JSON `state` blob.

Path syntax: dot-notation only. `'a'`, `'a.b'`, `'a.b.c'`. **No** arrays, **no** wildcards, **no** bracket access. The plugin's validator rejects invalid syntax at compile time.

The annotation runs on every `set()`:

```typescript
// Cache built once per AsWfStore instance via scanShadowFields()
for (const spec of specs) {
  const raw = resolvePath(state.context, spec.path);
  const coerced = coerceShadowValue(raw, spec);
  if (coerced !== undefined) payload[spec.field] = coerced;
  else if (spec.optional) payload[spec.field] = null;
}
```

## Shadow column constraints

| Rule                                                                         | Why                                                                                                     | Enforced                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Field type must be `string \| number \| boolean`                             | shadow copy is by value; no nested JSON                                                                 | plugin validator (compile-time)  |
| Field must be **optional** (`?:`) OR carry `@meta.default` / `@db.default.*` | context shape varies between steps → path-miss writes `null` (optional) or relies on default (required) | plugin validator (compile-time)  |
| Cannot apply to `@meta.id` (PK)                                              | shadow must not overwrite the row identifier                                                            | plugin validator (compile-time)  |
| Path-miss on optional field → writes `null`                                  | clears stale value if context changes between pauses                                                    | runtime                          |
| Type mismatch (e.g. ctx value is an object)                                  | logs **once per field per store instance**, writes `null`, continues                                    | runtime (`onShadowTypeMismatch`) |

Required fields without DB defaults will fail the insert on first `set()` where the context path misses. Make the column optional (or give it `@db.default.*`) unless you can guarantee the path is set in every step.

Annotation supports only one path per field.

## Methods

All async. All operate on `handle`.

| Method                           | Returns                                  | Notes                                                                                                                                           |
| -------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `set(handle, state, expiresAt?)` | `Promise<void>`                          | upserts. On insert, stamps `createdAt` + `createdBy` (actor). On update, `replaceMany` + bumps `updatedAt` + `lastUpdatedBy`. Applies shadows.  |
| `get(handle)`                    | `Promise<{ state, expiresAt? } \| null>` | reads + auto-deletes if expired (fire-and-forget delete). Returns `null` past expiry.                                                           |
| `getAndDelete(handle)`           | `Promise<{ state, expiresAt? } \| null>` | **race-safe single-use consume.** Use this on resume — never `get()` then `delete()`.                                                           |
| `delete(handle)`                 | `Promise<void>`                          | explicit removal                                                                                                                                |
| `cleanup({ retention? })`        | `Promise<number>`                        | delete rows with `expiresAt <= now - retention`. No retention → delete past-expiry. `Number.POSITIVE_INFINITY` → no-op. Returns `deletedCount`. |
| `heal({ filter?, batchSize? })`  | `Promise<number>`                        | re-apply shadow columns to existing rows. Batches at `batchSize ?? 100`. Returns count of rows updated.                                         |

### getAndDelete contract

`findRow` → `deleteMany({ handle })` → check `deletedCount === 1`. Two concurrent callers: only one's delete returns `1`; the other returns `null`. **If you subclass `AsWfStore` and override `findRow`, preserve this contract.**

This is why "use `getAndDelete` not `get` + `delete`": separate calls are not atomic — two concurrent resumes could both observe the row and both proceed, double-firing the post-resume flow.

### Subclass-friendly methods (protected)

Override these to customize without rewriting the public surface:

| `protected` method                     | Purpose                                                      |
| -------------------------------------- | ------------------------------------------------------------ |
| `getActor()`                           | resolve actor at write time (default: call `opts.actor?.()`) |
| `findRow(handle)`                      | sharded / multi-tenant lookup                                |
| `assembleResult(row)`                  | reattach `schemaId` to JSON blob                             |
| `buildSetPayload(handle, state, opts)` | add custom columns on write                                  |
| `applyShadows(payload, state)`         | customize shadow copy                                        |
| `scanShadowFields()`                   | use a different annotation as the source                     |
| `resolveFieldPrimitive(fieldType)`     | extend supported primitives                                  |

## When to run heal()

- After adding a new `@wf.store.fromContext` field — existing rows have `null` / missing column → run `heal()` to backfill.
- After changing a path on an existing annotation — old rows hold the value from the old path.
- After observing `[AsWfStore] @wf.store.fromContext field "..." expected ... but got ...` warnings — they fire once per field per process, so you may need `heal()` once the bug is fixed.
- Optional `filter` narrows the scan (`{ schemaId: 'auth/invite' }` to backfill only one flow).

`heal()` is a no-op if the schema declares no `@wf.store.fromContext` fields.

## CJS limitation

`@atscript/moost-wf/store` ships ESM only. **Triggered by:** any `import` of `@atscript/moost-wf/store` or `@atscript/moost-wf/store.as` in your server code. **Fix:** set `"type": "module"` in the consumer's `package.json` and bundle ESM. CJS consumers must drop `AsWfStore` and use the in-memory store from `@moostjs/event-wf` (no persistence).

This is SKILL.md invariant 9.

## Wiring AsWfStore into the workflow engine

`MoostWf` takes no store option. The store is plugged in **per request** via `HandleStateStrategy` from `@moostjs/event-wf`, passed into `handleAsOutletRequest({ state })`. Pattern:

```typescript
import { Controller } from "moost";
import { Post } from "@moostjs/event-http";
import {
  MoostWf,
  HandleStateStrategy,
  EncapsulatedStateStrategy,
  createEmailOutlet,
  type WfOutletTriggerDeps,
} from "@moostjs/event-wf";
import { createAsHttpOutlet, handleAsOutletRequest } from "@atscript/moost-wf";
import { AsWfStore } from "@atscript/moost-wf/store";

const wfStore = new AsWfStore({
  table: wfStatesTable,
  actor: () => useSession()?.userId,
});

const handleStrategy = new HandleStateStrategy({ store: wfStore });

@Controller()
export class WorkflowsController {
  constructor(private readonly wf: MoostWf) {}

  @Post("wf")
  async handle() {
    const wfApp = this.wf.getWfApp();
    const deps: WfOutletTriggerDeps = {
      start: (schemaId, ctx, opts) =>
        wfApp.start(schemaId, ctx as never, {
          input: opts?.input,
          eventContext: opts?.eventContext as never,
        }),
      resume: (state, opts) =>
        wfApp.resume(state as never, {
          input: opts?.input,
          eventContext: opts?.eventContext as never,
        }),
    };
    return handleAsOutletRequest(
      {
        allow: ["auth/invite" /* ... */],
        // Per-call strategy selection. Return the same `handleStrategy` to use
        // AsWfStore on every flow, or branch by `wfid` for mixed persistence.
        state: () => handleStrategy,
        outlets: [createAsHttpOutlet(), createEmailOutlet(sendEmail)],
        token: { read: ["body", "query", "cookie"], write: "body", name: "wfs" },
      },
      deps,
    );
  }
}
```

The `state` callback fires for every request; return one strategy instance for all flows or pick by `wfid` (e.g. `HandleStateStrategy` for outlet-resumable flows, `EncapsulatedStateStrategy` for stateless ones). `AsWfStore` implements `WfStateStore` from `@prostojs/wf/outlets`; `HandleStateStrategy` accepts any `WfStateStore` implementation. Adapter bootstrap stays vanilla: `app.adapter(new MoostWf())` with no options.

## Recipe — invite + register flow with shadow column lookup

End-to-end pattern: admin invites a user by email → store stamps `inviteEmail` shadow column → admin "resend invite" UI queries `wf_states` by `inviteEmail`.

### Form

```atscript
@wf.context.pass 'email'
export interface InviteForm {
    @meta.label 'Email'
    @expect.email
    email: string
}
```

### Schema extension

```atscript
// src/wf/wf-state.as
import { AsWfStateRecord } from '@atscript/moost-wf/store.as'

@db.table 'wf_states'
export interface WfStateRow extends AsWfStateRecord {
    @meta.id
    @db.default.uuid
    id: string

    @wf.store.fromContext 'email'
    @db.index.plain 'wf_email_idx'
    @expect.maxLength 256
    inviteEmail?: string
}
```

### Workflow

```typescript
@Workflow("admin/invite")
@WorkflowSchema<{ email?: string }>([{ id: "collect" }, { id: "send-email" }])
flow() {}

@Step("collect")
collect(
  @WfInput() input: InviteForm,
  @WorkflowParam("context") ctx: { email?: string },
) {
  ctx.email = input.email;          // → copied to shadow column on engine.set()
}

@Step("send-email")
async sendEmail(@WorkflowParam("context") ctx: { email?: string }) {
  return outletEmail(ctx.email!, "invite", { ... });   // pause via outlet
}
```

When the engine pauses (between `collect` and `send-email`, or at the outlet), `AsWfStore.set()` runs and `state.context.email` lands in `wf_states.inviteEmail`.

### Admin "resend" query

```typescript
const paused = await wfStatesTable.findMany({
  filter: { inviteEmail: { $eq: "u@x.io" } },
  controls: { $sort: { updatedAt: -1 }, $limit: 1 },
});
```

Indexed lookup by email, no JSON scan. Cross-link `atscript-db` skill's `queries.md` for the filter operator surface.

### When the resume succeeds

The follow-up `getAndDelete(handle)` removes the row atomically. Don't `delete()` separately.
