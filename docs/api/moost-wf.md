# @atscript/moost-wf

Server-side workflow runtime that pairs with [`@atscript/vue-wf`](/api/vue-wf). Decorators (`@FormInput`, `@AltAction`), a global interceptor, helpers for context passing and action discovery, plus an opt-in store implementation backed by atscript-db. Atscript-typed forms are the contract — the client renders whatever schema the server returns.

## Contents

- [Plugin](#plugin)
- [Decorators](#decorators)
- [Interceptors](#interceptors)
- [Composables](#composables)
- [Helpers](#helpers)
- [Classes](#classes)
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

### `@FormInput()`

Parameter decorator. Combines a `Resolve` (injecting `{ data(), requireInput() }`) with an `Intercept` that auto-validates inbound payloads before the step runs.

```typescript
function FormInput(): ParameterDecorator;

type TFormInput<_T = unknown> = ReturnType<typeof useFormInput>;
```

```typescript
import { FormInput, type TFormInput } from "@atscript/moost-wf";
import { Step } from "@moostjs/event-wf";
import type { LoginForm } from "./LoginForm.as";

class AuthFlow {
  @Step("login")
  async login(@FormInput() form: TFormInput<LoginForm>) {
    const { username, password } = form.data() ?? {};
    try {
      return await this.auth.login(username, password);
    } catch {
      throw form.requireInput({ password: "Invalid credentials" });
    }
  }
}
```

The interceptor short-circuits with an `inputRequired` reply on the first invocation (or any time the validator rejects) — your step handler only runs on a valid payload.

### `@AltAction()`

Parameter decorator that resolves the **action name** from the current workflow event. Returns `undefined` for plain form submits.

```typescript
const AltAction: () => ParameterDecorator;
```

```typescript
@Step("mfa-verify")
async mfaVerify(
  @FormInput() form: TFormInput<PincodeForm>,
  @AltAction() action: string | undefined,
) {
  if (action === "resend") {
    await this.sendOtp(this.ctx.email);
    return;
  }
  await this.verifyCode(form.data()!.code);
}
```

## Interceptors

### `formInputInterceptor()`

Global interceptor that catches `FormInputRequired` signals (thrown by `form.requireInput()`) and converts them into `inputRequired` outlet responses. Mount once at app startup.

```typescript
function formInputInterceptor(): TInterceptorDef;
```

```typescript
import { Moost } from "moost";
import { formInputInterceptor } from "@atscript/moost-wf";

const app = new Moost();
app.applyGlobalInterceptors(formInputInterceptor());
```

## Composables

### `useFormInput(type?)`

The composable backing `@FormInput()`. Use directly when you need form-input semantics outside a parameter slot.

```typescript
function useFormInput(type?: TAtscriptAnnotatedType): {
  data<T = unknown>(): T | undefined;
  requireInput(errors?: Record<string, string>): FormInputRequired;
};
```

`data()` reads the current `state.input` from `useWfState()`. `requireInput()` builds and throws a `FormInputRequired` signal — the interceptor converts it into an `inputRequired` reply.

### `useWfAction()`

Read/write the current workflow action from the event context. The HTTP trigger sets it from the request body; step handlers read it (or prefer `@AltAction()`).

```typescript
function useWfAction(): {
  getAction(): string | undefined;
  setAction(action: string | undefined): void;
};
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

Inspects a form type's metadata and returns the declared `actions` and `actionsWithData` ids — used by the interceptor to dispatch the right behaviour for each action.

```typescript
interface TFormActions {
  actions: string[];
  actionsWithData: string[];
}

function getFormActions(type: TAtscriptAnnotatedType): TFormActions;
```

Reads `@ui.form.action`, `@wf.action.withData`, and the legacy `@ui.altAction`. Results are cached per type identity.

## Classes

### `FormInputRequired`

Signal class thrown by `form.requireInput()` and caught by `formInputInterceptor`.

```typescript
class FormInputRequired {
  constructor(
    public readonly schema: unknown,
    public readonly errors?: Record<string, string>,
    public readonly context?: Record<string, unknown>,
  );
}
```

Hand-throw this when you need to pause from outside an `@FormInput()` slot:

```typescript
import { FormInputRequired, serializeFormSchema } from "@atscript/moost-wf";
import { MyForm } from "./my-form.as";

if (!ok) {
  throw new FormInputRequired(
    serializeFormSchema(MyForm),
    { fieldName: "Server says no" },
    { contextKey: "value" },
  );
}
```

## Store subpath

`@atscript/moost-wf/store` ships an opt-in `WfStateStore` implementation backed by an atscript-db table.

### `AsWfStateRecord`

The base atscript interface defining the columns the store reads/writes. Consumers extend it with their own `@meta.id`-bearing primary-key column.

```atscript
import { AsWfStateRecord } from '@atscript/moost-wf/store'

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

## Types

### `TFormInput<T>`

Type alias re-exported from the decorator module.

```typescript
type TFormInput<_T = unknown> = ReturnType<typeof useFormInput>;
// = { data<T>(): T | undefined; requireInput(errors?): FormInputRequired }
```

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
