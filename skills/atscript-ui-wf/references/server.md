# server

Authoring server-side workflow controllers with `@atscript/moost-wf` on top of `@moostjs/event-wf`.

## Contents

- [Decorator stack](#decorator-stack)
- [Schema authoring](#schema-authoring)
- [Step handler signatures and return semantics](#step-handler-signatures-and-return-semantics)
- [Pause patterns](#pause-patterns)
- [@WfInput() auto-validation flow](#wfinput-auto-validation-flow)
- [useAtscriptWf composable](#useatscriptwf-composable)
- [useWfAction](#usewfaction)
- [Action handlers](#action-handlers)
- [StepRetriableError](#stepretriableerror)
- [serializeFormSchema(type)](#serializeformschematype)
- [getFormActions(type)](#getformactionstype)
- [Error handling](#error-handling)
- [Recipe — login + MFA branching](#recipe--login--mfa-branching)

## Decorator stack

| Decorator                                         | Package              | Where                        | Purpose                                                                      |
| ------------------------------------------------- | -------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| `@Controller()`                                   | `moost`              | class                        | declare a DI-managed controller                                              |
| `@Workflow('<id>')`                               | `@moostjs/event-wf`  | method                       | mark the flow root; `<id>` is the `wfid` clients pass                        |
| `@WorkflowSchema<Ctx>([{ id, condition? }, ...])` | `@moostjs/event-wf`  | method (same as `@Workflow`) | declare step graph + branching                                               |
| `@Step('<id>')`                                   | `@moostjs/event-wf`  | method                       | implement one step                                                           |
| `@WorkflowParam('input' \| 'context')`            | `@moostjs/event-wf`  | param                        | inject current input or context                                              |
| `@WfInput(opts?)`                                 | `@atscript/moost-wf` | param                        | inject the validated, typed input; auto-pauses on missing or invalid input   |
| `@WfAction()`                                     | `@atscript/moost-wf` | param                        | inject `string \| undefined` — the action name; validated against the schema |

```typescript
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam, useWfFinished } from "@moostjs/event-wf";
import { WfInput, WfAction, useAtscriptWf } from "@atscript/moost-wf";
```

## Schema authoring

```typescript
import type { LoginCtx } from "./types";

@Workflow("auth/login")
@WorkflowSchema<LoginCtx>([
  { id: "login-credentials" },
  { id: "login-verify-otp", condition: (ctx) => !!ctx.mfaEnabled },
  { id: "login-issue-session" },
])
flow() {}
```

### Patterns

| Pattern             | Schema                                                                           |
| ------------------- | -------------------------------------------------------------------------------- |
| Linear              | `[{ id: 'a' }, { id: 'b' }, { id: 'c' }]`                                        |
| Conditional skip    | `[{ id: 'verify', condition: (ctx) => ctx.needsVerify }]` — false → step skipped |
| Optional final step | `[{ id: 'cleanup', condition: (ctx) => ctx.dirty }]`                             |

### Moost globalPrefix applies to workflow IDs

`new Moost({ globalPrefix: "api" })` prepends the prefix to every `@Workflow("auth/login")` registration → the live wfid becomes `api/auth/login`. The `allow:` whitelist in `handleAsOutletRequest({ allow })` and the client's `name` prop on `<AsWfForm>` must match the prefixed id.

### Branching semantics

- `condition` is called with the current context.
- Returns truthy → step runs.
- Returns falsy → step is **skipped** entirely (handler is not invoked).
- Conditions are pure functions over `ctx`. Do not read DB / external state from a condition — set the flag in a prior step's body and branch on that flag.

The condition function lives on the schema decorator, **not** on the step. Step handlers themselves do not declare conditions.

## Step handler signatures and return semantics

Each step is an async (or sync) method on the controller. Possible terminations:

| Termination                                     | Signal                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| **Advance** to next step                        | return `undefined` (or any non-outlet value)                             |
| **Pause** and ask client for input              | use `@WfInput()` — auto-pauses when input is missing or invalid          |
| **Pause** and outlet (email / webhook)          | return `outletEmail(...)` / custom outlet — see [outlets.md](outlets.md) |
| **Complete** the flow                           | `useWfFinished().set({ type: 'data', value })` then `return`             |
| **Re-pause** mid-handler with validation errors | `throw useAtscriptWf(Type).requireInput({ errors: { field: 'msg' } })`   |

```typescript
@Step("login-credentials")
async enterCredentials(
  @WfInput() input: LoginForm,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  const user = await usersTable.findOne({ filter: { username: input.username } });
  if (!user || !verify(input.password, user)) {
    throw useAtscriptWf(LoginForm).requireInput({
      errors: { password: "Invalid credentials" },
    });
  }
  ctx.userId = user.id;
  // implicit return → engine advances to next step
}
```

`return` (without a value) is the signal to advance. The engine treats the **shape of the return value** as the outlet decision — see `@moostjs/event-wf` documentation. Anything not recognized as an outlet response is treated as "step complete, advance".

## Pause patterns

The recommended path is the `@WfInput()` decorator — the framework
handles both first-call auto-pause and validation-fail re-pause:

```typescript
@Step("login-credentials")
async enterCredentials(@WfInput() input: LoginForm) {
  // body only runs with valid input
}
```

For explicit control without the decorator's policy matrix, use the
`useAtscriptWf()` composable directly:

```typescript
import { useAtscriptWf } from "@atscript/moost-wf";

@Step("login-credentials")
async enterCredentials() {
  const wf = useAtscriptWf(LoginForm);
  const input = wf.resolveInput(); // throws StepRetriableError on missing/invalid
  // ...
}
```

Both paths throw `StepRetriableError` from `@wooksjs/event-wf`. The
workflow engine catches it natively and converts it into the
`inputRequired` envelope `<AsWfForm>` decodes — no global interceptor
mount is required.

### What `requireInput()` carries

`useAtscriptWf(Type).requireInput(opts?)` builds a `StepRetriableError`
whose payload is the serialized form schema plus the whitelisted
context (`@wf.context.pass`) and an optional `errors` map:

```typescript
useAtscriptWf(LoginForm).requireInput({
  errors: { password: "Invalid credentials" },
  formMessage: "Account is suspended",
});
```

| Option        | Effect                                                               |
| ------------- | -------------------------------------------------------------------- |
| `errors`      | `Record<string, string>` keyed by field path                         |
| `formMessage` | top-level form-wide error — merged as `__form` into the response map |

Three responsibilities baked in:

1. `serializeFormSchema(type)` — strip `@wf.context.pass` and produce wire-safe payload (cached per type identity).
2. `extractPassContext(type, wfContext)` — copy only whitelisted keys from the workflow context into the response.
3. Throw a `StepRetriableError` carrying `outlet: 'http'` + payload + context. `createAsHttpOutlet()` wraps it in the `inputRequired` envelope `<AsWfForm>` decodes.

## @WfInput() auto-validation flow

`@WfInput()` is built on `useAtscriptWf()`. It resolves the action,
validates the input against the schema, and applies the
action-vs-input policy matrix before the handler body runs.

### What happens on each request

```
1. The decorator's Resolve runs (priority: RESOLVE)
2. Reads the param's atscript type from method metas
3. Reads the action via useAtscriptWf().resolveAction()
4. If no action + no input → throws StepRetriableError → engine re-pauses
5. If action declared in @ui.form.action (no data)
     → without `pass: true`: throws StepRetriableError
     → with `pass: true`: parameter resolves to undefined, handler runs
6. If action declared in @wf.action.withData → validate partial input, return it
7. If unknown action → throws StepRetriableError (`__form: 'Action "<name>" is not supported'`)
8. Otherwise (plain submit) → run validator (full), throw StepRetriableError on fail
```

### Decorator usage

```typescript
import { WfInput, useAtscriptWf } from "@atscript/moost-wf";
import { Step } from "@moostjs/event-wf";
import { LoginForm } from "./forms.as";

@Step("login")
async login(@WfInput() input: LoginForm) {
  try {
    await this.auth.login(input.username, input.password);
  } catch {
    throw useAtscriptWf(LoginForm).requireInput({
      errors: { password: "Invalid credentials" },
    });
  }
}
```

Two key effects:

- **Auto-validate**: bad input is rejected before the body runs.
- **Auto-pause on missing input**: first hit (no `input`, no `action`) produces the form definition the client renders.

### Validation modes

| Mode           | Trigger                                      | Options                                      |
| -------------- | -------------------------------------------- | -------------------------------------------- |
| Full           | plain submit (no action)                     | `{ unknownProps: "strip" }`                  |
| Partial (deep) | action present in `@wf.action.withData` list | `{ partial: "deep", unknownProps: "strip" }` |
| Bypass         | `@ui.form.action` action + `pass: true`      | parameter resolves to `undefined`            |

### Opting in to no-data actions

A step that should also handle a plain `@ui.form.action` (e.g.
"forgot password") declares `@WfInput({ pass: true })`. The parameter
type becomes `T | undefined`; when a no-data action fires the
parameter is `undefined` and the handler runs.

```typescript
@Step("login-credentials")
async enterCredentials(
  @WfInput({ pass: true }) input: LoginForm | undefined,
  @WfAction() action: string | undefined,
) {
  if (action === "forgot") {
    return this.sendPasswordReset();
  }
  // input is fully validated here (the decorator already enforced it)
  await this.auth.login(input!.username, input!.password);
}
```

## useAtscriptWf composable

`useAtscriptWf(type)` is the underlying composable. Use it when:

- You want explicit control over action vs input handling.
- You bypass the `@WfInput()` decorator stack (custom adapters,
  multiple form types in one step).
- You need `requireInput()` outside a decorated parameter (any
  helper function called from a step).

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

The three helpers are pure and independent — callers can interleave
their own logic:

```typescript
import { useAtscriptWf } from "@atscript/moost-wf";

@Step("login")
async login() {
  const wf = useAtscriptWf(LoginForm);
  const action = wf.resolveAction();
  if (action === "forgot") {
    return this.sendPasswordReset();
  }
  const input = wf.resolveInput();
  // ...
}
```

| Method                | Behaviour                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `resolveInput(opts?)` | Validates `state.input` and returns it typed. Throws `StepRetriableError` on missing or invalid input. |
| `resolveAction()`     | Returns the action name (or `undefined`). Throws `StepRetriableError` for unknown actions.             |
| `requireInput(opts?)` | Builds a `StepRetriableError` carrying the schema + whitelisted context + optional field/form errors.  |

Validator instances are cached per `(type, opts)` pair.

## useWfAction

```typescript
import { useWfAction } from "@atscript/moost-wf";

const { getAction, setAction } = useWfAction();
```

| Method              | Purpose                                               | Where to call                                                                        |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `getAction()`       | read the action name the client sent (or `undefined`) | step handlers (prefer `@WfAction()`)                                                 |
| `setAction(action)` | write the action name into event context              | **HTTP trigger** — call before invoking the workflow engine, so step handlers see it |

The HTTP trigger should pull `action` from the request body and call `setAction(body.action)`. After that, `@WfAction()` / `useAtscriptWf().resolveAction()` reads it.

## Action handlers

A form type can declare actions on its fields:

```atscript
export interface LoginForm {
    @meta.label 'Username'
    username: string

    @meta.label 'Password'
    password: string

    // Plain action — no data, just a name. Server gets `action='forgot'`, no validation.
    @ui.form.action 'forgot'
    forgot?: void

    // Action with data — partial validation, server receives `{ input, action: 'saveDraft' }`.
    @wf.action.withData 'saveDraft'
    saveDraft?: void
}
```

### Server side

Branch on the action in the step handler:

```typescript
@Step("login")
async login(
  @WfInput({ pass: true }) input: LoginForm | undefined,
  @WfAction() action: string | undefined,
) {
  const wf = useAtscriptWf(LoginForm);

  if (action === "forgot") {
    await this.sendPasswordReset(/* read email from a previous field if you collected it */);
    throw wf.requireInput({ formMessage: "Reset link sent" });
  }
  if (action === "saveDraft") {
    await this.drafts.save(input ?? {});
    throw wf.requireInput();  // re-render same form, no errors
  }
  // plain submit — input is fully validated by @WfInput()
  await this.auth.login(input!);
}
```

Action validation modes recap:

| Action source              | Validation                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@ui.form.action 'id'`     | none — step skipped unless `@WfInput({ pass: true })`; parameter then resolves to `undefined`             |
| `@wf.action.withData 'id'` | deep-partial — filled fields validated, missing OK                                                        |
| Unknown action             | `@WfInput` / `resolveAction()` throws `StepRetriableError` with `__form: 'Action "..." is not supported'` |

Action discovery: `getFormActions(type)` returns `{ actions, actionsWithData }`. The decorator uses this to classify the incoming action.

## StepRetriableError

`StepRetriableError` is the engine-native signal for "this step
should re-pause with the following payload". It comes from
`@wooksjs/event-wf`.

```typescript
import { StepRetriableError } from "@wooksjs/event-wf";
```

`useAtscriptWf(Type).requireInput(opts?)` builds and returns one
configured for the HTTP outlet:

```typescript
new StepRetriableError(new Error(formMessage ?? "Input required"), undefined, {
  outlet: "http",
  payload: serializeFormSchema(type),
  context: { ...extractPassContext(type, wfContext), errors? },
});
```

The workflow engine catches it natively and re-runs the step.
`createAsHttpOutlet()` wraps the payload + context into the
`inputRequired` envelope `<AsWfForm>` decodes.

You rarely construct one by hand — call `requireInput()` and throw
the result.

## serializeFormSchema(type)

```typescript
serializeFormSchema(type: TAtscriptAnnotatedType): unknown
```

- Delegates to `serializeAnnotatedType(type, { ignoreAnnotations: ['wf.context.pass'], refDepth: 0.5 })`.
- Strips `@wf.context.pass` from the wire payload (server-only annotation).
- `refDepth: 0.5` = **shallow refs** — FK targets ship with `id` + interface metadata (`db.http.path`) but no structural body. Sufficient for `AsRef` pickers; keeps payload small.
- Cached in a `WeakMap` keyed by `TAtscriptAnnotatedType` identity. Repeated serialization of the same type returns the cached payload.

## getFormActions(type)

```typescript
getFormActions(type: TAtscriptAnnotatedType): { actions: string[]; actionsWithData: string[] }
```

Walks `type.type.props`, reads `@ui.form.action` and `@wf.action.withData` annotations on each field. Cached per type. Used internally by `@WfInput()` / `useAtscriptWf()` to classify the incoming action; expose only if you build a custom dispatcher.

`@ui.form.action` may be `{ id, label? }` or a bare string. `@wf.action.withData` is always a bare string.

## Error handling

| Failure                                           | Effect                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Step throws non-`StepRetriableError`              | bubbles to Moost's normal error handler → HTTP 500 + `@error` on client               |
| Step throws `useAtscriptWf().requireInput({...})` | engine catches `StepRetriableError` → same-form re-render with errors                 |
| `@WfInput()` validator rejects                    | decorator throws `StepRetriableError` with field errors → handler body never runs     |
| Unknown action                                    | `@WfInput` / `resolveAction()` throws → `{ __form: 'Action "..." is not supported' }` |
| HTTP failure (non-2xx)                            | client `useWfForm` sets `error = { message, status }` → `@error`                      |

### Auth

Per-step authentication / authorization uses Moost's standard decorators (`@Authenticate`, `@Authorize`, etc.) — see the `moostjs` skill. Apply them to step methods just like any other Moost handler.

```typescript
@Step("admin-action")
@Authorize("admin")
async adminAction(@WfInput() input: AdminForm) { ... }
```

Auth failures convert to thrown errors that surface to the client as `{ error: { message, status: 401 } }`. The form does not re-render — the user sees the error.

## Recipe — login + MFA branching

Schema with conditional MFA step:

```typescript
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam, useWfFinished } from "@moostjs/event-wf";
import { WfInput, useAtscriptWf } from "@atscript/moost-wf";
import { LoginForm, MfaPincodeForm } from "./forms.as";

interface LoginCtx {
  userId?: number;
  email?: string;
  mfaEnabled?: boolean;
  otpCode?: string;
}

const needsMfa = (ctx: LoginCtx) => !!ctx.mfaEnabled;

@Controller()
export class LoginWorkflow {
  @Workflow("auth/login")
  @WorkflowSchema<LoginCtx>([
    { id: "credentials" },
    { id: "verify-otp", condition: needsMfa },
    { id: "issue-session" },
  ])
  flow() {}

  @Step("credentials")
  async credentials(@WfInput() input: LoginForm, @WorkflowParam("context") ctx: LoginCtx) {
    const user = await verify(input);
    if (!user) {
      throw useAtscriptWf(LoginForm).requireInput({
        errors: { password: "Invalid credentials" },
      });
    }
    ctx.userId = user.id;
    ctx.email = user.email;
    ctx.mfaEnabled = user.mfaEnabled;
    if (ctx.mfaEnabled) {
      ctx.otpCode = generateOtp();
      await sendEmail(ctx.email, ctx.otpCode);
    }
  }

  @Step("verify-otp")
  verifyOtp(@WfInput() input: MfaPincodeForm, @WorkflowParam("context") ctx: LoginCtx) {
    if (input.code !== ctx.otpCode) {
      throw useAtscriptWf(MfaPincodeForm).requireInput({
        errors: { code: "Invalid code" },
      });
    }
  }

  @Step("issue-session")
  issueSession(@WorkflowParam("context") ctx: LoginCtx) {
    useWfFinished().set({
      type: "data",
      value: { ok: true, userId: ctx.userId },
    });
  }
}
```

Wire trace:

1. Client `POST { wfid: 'auth/login' }` → step `credentials`, no input → `@WfInput()` throws `StepRetriableError` → engine emits `inputRequired(LoginForm)` → client renders form.
2. Client `POST { wfs, input: { username, password } }` → step validates, sets ctx, **without MFA**: `verify-otp` is skipped (`condition` false), runs `issue-session` → `@finished`.
3. **With MFA**: `verify-otp` runs, renders `MfaPincodeForm` → client posts code → if valid, advance to `issue-session`.
