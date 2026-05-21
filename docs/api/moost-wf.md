# @atscript/moost-wf

Server-side workflow runtime that pairs with [`@atscript/vue-wf`](/api/vue-wf). Decorators (`@WfInput`, `@WfAction`), a schema-aware composable (`useAtscriptWf`), helpers for context passing and action discovery, plus an opt-in store implementation backed by atscript-db. Atscript-typed forms are the contract — the client renders whatever schema the server returns.

## Contents

- [Plugin](#plugin)
- [Decorators](#decorators)
- [Composables](#composables)
- [Helpers](#helpers)
- [Outlet helpers](#outlet-helpers)
- [Finish-screen envelope](#finish-screen-envelope)
- [Store subpath](#store-subpath)

## Plugin

### `@atscript/moost-wf/plugin`

Registers the workflow-specific annotation keys at build time.

```typescript
import wfPlugin from "@atscript/moost-wf/plugin";

export default {
  plugins: [wfPlugin()],
};
```

Annotations registered:

- `@wf.context.pass 'key'` — whitelist a workflow context key for the `inputRequired` response. Only listed keys reach the client.
- `@wf.action.withData 'id'` — form action that ships partial form data with deep-partial validation (e.g. "save draft").
- `@wf.store.fromContext 'path'` — shadow-column copy from `state.context` into a top-level DB column (`AsWfStore` only). Path is dot-notation; field must be optional or have `@meta.default` / `@db.default`; primitive type only (`string` | `number` | `boolean`).

## Decorators

### `@WfInput(opts?)`

Parameter decorator that resolves to the validated, typed input for the current step. Built on top of `useAtscriptWf()` with the action-aware policy matrix baked in.

```typescript
function WfInput(opts?: { pass?: boolean }): ParameterDecorator;
```

```typescript
import { WfInput } from "@atscript/moost-wf";
import { Step } from "@moostjs/event-wf";
import type { LoginForm } from "./LoginForm.as";

class AuthFlow {
  @Step("login")
  async login(@WfInput() input: LoginForm) {
    try {
      return await this.auth.login(input.username, input.password);
    } catch {
      // requireInput() builds a StepRetriableError — throw it to re-pause.
      throw useAtscriptWf(LoginForm).requireInput({
        errors: { password: "Invalid credentials" },
      });
    }
  }
}
```

Policy matrix:

| Situation                                          | Behaviour                                                                                                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| No action fired                                    | Strict full validation against the schema. Missing input throws `StepRetriableError`.                                                                 |
| Action declared in `@wf.action.withData`           | Deep-partial validation — present fields validated, missing fields OK.                                                                                |
| Action declared in `@ui.form.action`               | Input must be absent. Without `pass: true`, the decorator throws (no-data actions exclude this step).                                                 |
| Action declared in `@ui.form.action`, `pass: true` | The step opts in to handling the no-data action: parameter resolves to `undefined`, body still runs.                                                  |
| Unknown action                                     | `StepRetriableError` propagates with `__form: 'Action "<name>" is not supported'`. Same guard fires from `@WfAction(Form)` before the step body runs. |

Use `?:` syntax (`input?: Form`), not a union (`input: Form | undefined`) — TS emits `Object` for union-typed parameters in decorator metadata, which breaks atscript reflection. `@WfInput({ pass: true })` composes `@Optional()` internally so the parameter being `undefined` is fine for global validator pipes.

### `@WfAction(Form)`

Parameter decorator that resolves to the current workflow action name (or `undefined` for plain submits). The form type argument is **required** — the decorator validates the incoming action against the form's `@ui.form.action` / `@wf.action.withData` whitelist and throws `StepRetriableError` for unknown actions before the step body runs.

```typescript
function WfAction<T extends TAtscriptTypeDef>(type: TAtscriptAnnotatedType<T>): ParameterDecorator;
```

```typescript
@Step("mfa-verify")
async mfaVerify(
  @WfAction(PincodeForm) action: string | undefined,
  @WfInput() input: PincodeForm,
) {
  if (action === "resend") {
    await this.sendOtp(this.ctx.email);
    return;
  }
  await this.verifyCode(input.code);
}
```

The form-argument whitelist is a security guard: step bodies never see an action that wasn't declared on the form. Use the same form type the step receives via `@WfInput`.

## Composables

### `useAtscriptWf(type)`

Schema-driven workflow I/O primitives. Returns three pure, independent helpers — composable consumers can interleave their own logic between checking the action and validating the input.

```typescript
function useAtscriptWf<T extends TAtscriptTypeDef>(
  type: TAtscriptAnnotatedType<T>,
): {
  resolveInput(opts?: { partial?: "deep" }): InferDataType<T>;
  resolveAction(): string | undefined;
  requireInput(opts?: {
    errors?: Record<string, string>;
    formMessage?: string;
  }): StepRetriableError;
};
```

| Method                | Purpose                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveInput(opts?)` | Validates `state.input` against the schema and returns it typed. Throws `StepRetriableError` if input is missing or invalid. **Does not consult the action.** |
| `resolveAction()`     | Returns the action name (or `undefined`). Throws `StepRetriableError` if the action is not declared on the schema. **Does not consult the input.**            |
| `requireInput(opts?)` | Builder for `StepRetriableError`. `errors` is field-keyed; `formMessage` becomes the top-level `__form` error. Use it to bail out from custom branches.       |

Validator instances are cached per `(type, opts)` pair.

```typescript
import { useAtscriptWf } from "@atscript/moost-wf";
import { LoginForm } from "./LoginForm.as";

@Step("login")
async login() {
  const wf = useAtscriptWf(LoginForm);
  const action = wf.resolveAction();
  if (action === "forgot") {
    await this.sendPasswordReset();
    return;
  }
  const input = wf.resolveInput();
  // ... auth ...
  if (failed) {
    throw wf.requireInput({ errors: { password: "Invalid credentials" } });
  }
}
```

## Helpers

### `serializeFormSchema(type)`

Cached per-type serializer for `inputRequired.payload`. Drops `@wf.context.pass` from the output (server-only) and ships FK fields with shallow refs (`refDepth: 0.5`) so clients can resolve value-help without dragging full target trees onto the wire.

```typescript
function serializeFormSchema(type: TAtscriptAnnotatedType): unknown;
```

### `extractPassContext(type, wfContext)`

Extract whitelisted context keys (those marked `@wf.context.pass`) from workflow state.

```typescript
function extractPassContext(
  type: TAtscriptAnnotatedType,
  wfContext: Record<string, unknown>,
): Record<string, unknown>;
```

### `getFormActions(type)`

Inspects a form type's metadata and returns the declared `actions` and `actionsWithData` ids — used internally by `useAtscriptWf` to classify the incoming action.

```typescript
interface TFormActions {
  actions: string[];
  actionsWithData: string[];
}

function getFormActions(type: TAtscriptAnnotatedType): TFormActions;
```

Reads `@ui.form.action` and `@wf.action.withData`. Results are cached per type identity.

## Outlet helpers

### `createAsHttpOutlet()`

Pre-configured HTTP outlet for `<AsWfForm>`. Wraps generic form payloads in `{ inputRequired: { payload, transport, context } }` while letting signal payloads (`finished` / `sent` / `outlet` / `error`) flow through unwrapped.

### `handleAsOutletRequest(opts, deps)`

Drop-in replacement for `handleWfOutletRequest` (from `@moostjs/event-wf`). Adds the `finished: true` marker that `<AsWfForm>` reads when a step calls `useWfFinished().set({ value })`.

```typescript
import { createAsHttpOutlet, handleAsOutletRequest } from "@atscript/moost-wf";

@Post("wf")
async handle() {
  // ... build deps ...
  return handleAsOutletRequest(
    {
      allow: ["auth/login"],
      state: () => new EncapsulatedStateStrategy({ secret: WF_SECRET }),
      outlets: [createAsHttpOutlet()],
      token: { read: ["body"], write: "body", name: "wfs" },
    },
    deps,
  );
}
```

## Finish-screen envelope

Helpers for the unified `WfFinished` envelope rendered by `<AsWfFinish>` on the client. Reach for `finishWf` / `abortWf` instead of raw `useWfFinished()` unless you need to set HTTP-level cookies alongside the envelope.

### `finishWf(opts?)`

Builds and writes a `WfFinished` envelope to `useWfFinished()`.

```typescript
function finishWf(opts?: FinishWfOpts): void;

interface FinishWfOpts {
  data?: unknown;
  message?: WfMessage;
  next?: WfNext;
}
```

### `abortWf(reason, opts?)`

Same shape as `finishWf`, additionally sets `aborted: true` and the abort `reason`.

```typescript
function abortWf(reason: string, opts?: FinishWfOpts): void;
```

### `isWfFinished(value)`

Type guard for `WfFinished` envelopes — useful in custom transports or outlet wrappers.

```typescript
function isWfFinished(value: unknown): value is WfFinished;
```

### Envelope types

`WfFinished` carries `{ aborted?, reason?, data?, message?, next? }`. `WfNext` is the `{ trigger: 'immediate' | 'auto' | 'manual', ... }` discriminated union the client renders. `WfMessage`, `WfButton`, and `WfActionRequest` round out the schema. See [Finish Screens](/workflows/finish-screens) for the full surface.

## Store subpath

`@atscript/moost-wf/store` ships an opt-in `WfStateStore` implementation backed by an atscript-db table.

### `AsWfStateRecord`

The base atscript interface defining the columns the store reads/writes. Consumers extend it with their own `@meta.id`-bearing primary-key column.

```atscript
// .as files import the model from `/store.as` (raw atscript source).
// .ts files import the runtime class from `/store` (compiled module).
import { AsWfStateRecord } from '@atscript/moost-wf/store.as'

@db.table 'wf_state'
interface WfStateRow extends AsWfStateRecord {
  @meta.id
  @db.default.uuid
  id: string

  // Shadow columns — auto-populated from state.context on every set()
  @wf.store.fromContext 'approval.approver'
  approver?: string
}
```

Columns provided by `AsWfStateRecord`: `handle`, `schemaId`, `state` (JSON), `expiresAt?`, `createdAt`, `updatedAt`, `createdBy?`, `lastUpdatedBy?`.

### `AsWfStore`

Persistent `WfStateStore` (from `@prostojs/wf/outlets`) backed by an `AtscriptDbTable`. Lifts `schemaId` out of the JSON blob into an indexed top-level column; populates `@wf.store.fromContext`-annotated shadow columns on every write.

```typescript
class AsWfStore implements WfStateStore {
  constructor(opts: AsWfStoreOptions);

  set(handle: string, state: WfState, expiresAt?: number): Promise<void>;
  get(handle: string): Promise<{ state: WfState; expiresAt?: number } | null>;
  delete(handle: string): Promise<void>;
  /** Race-safe single-use consume — `findRow` → `deleteMany` → `deletedCount === 1` gate. */
  getAndDelete(handle: string): Promise<{ state: WfState; expiresAt?: number } | null>;
  /** Drop expired rows. `retention` extends the grace window; `Infinity` is a no-op. */
  cleanup(opts?: { retention?: number }): Promise<number>;
  /** Re-apply `@wf.store.fromContext` shadow columns to existing rows. */
  heal(opts?: { filter?: Record<string, unknown>; batchSize?: number }): Promise<number>;
}

interface AsWfStoreOptions {
  table: AtscriptDbTable<any>;
  clock?: { now(): number };
  actor?: () => string | undefined;
}
```

### Shadow-column mechanism

When a field on the consumer's row schema carries `@wf.store.fromContext 'path'`:

1. On every `set()`, the store reads `state.context` along the dot-path.
2. If the resolved value is `string` / `number` / `boolean`, it is written to the matching DB column.
3. On miss (or type mismatch), **optional** fields get `null` (clears stale); non-optional default-bearing fields are omitted (DB default fires on insert, prior value sticks on update).
4. Type mismatches emit a single console warning per field per store instance.

`heal()` re-applies shadows after you add a new annotation, so existing rows backfill without waiting for each workflow to next pause.

### Subclassing

`AsWfStore` is subclass-friendly. Override:

- `getActor()` — custom auth source.
- `findRow(handle)` — sharded / multi-tenant lookup. Preserve the `getAndDelete` contract.
- `buildSetPayload(handle, state, opts)` — add custom columns alongside the base payload.
- `applyShadows(payload, state)` — change how shadow values are resolved or coerced.
- `scanShadowFields()` — read shadow specs from a different annotation key.
- `resolvePath(obj, path)` / `coerceShadowValue(raw, spec)` — change traversal or type-coercion rules.

## Cross-links

- [Workflows — Overview](/workflows/)
- [Workflows — Server Authoring](/workflows/server-authoring)
- [Workflows — Form Input](/workflows/form-input)
- [Workflows — Actions](/workflows/actions)
- [Workflows — Context Passing](/workflows/context)
- [Workflows — State Persistence](/workflows/state-persistence)
- [Workflows — Outlets & Resume](/workflows/outlets-resume)
- [@atscript/vue-wf](/api/vue-wf) — client runtime
- atscript.dev — `.as` syntax and serialization
- atscript-db.dev — `AtscriptDbTable`, `@db.*` annotations
