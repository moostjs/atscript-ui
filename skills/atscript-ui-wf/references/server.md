# server

Authoring server-side workflow controllers with `@atscript/moost-wf` on top of `@moostjs/event-wf`.

## Contents

- [Decorator stack](#decorator-stack)
- [Schema authoring](#schema-authoring)
- [Step handler signatures and return semantics](#step-handler-signatures-and-return-semantics)
- [Pause patterns](#pause-patterns)
- [@WfInput() auto-validation flow](#wfinput-auto-validation-flow)
- [useAtscriptWf composable](#useatscriptwf-composable)
- [useWfActionSlot](#usewfactionslot)
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
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { WfInput, WfAction, useAtscriptWf, finishWf, abortWf } from "@atscript/moost-wf";
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
| **Complete** the flow                           | `finishWf({ data })` (or `abortWf(reason, opts?)`) then `return`         |
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

### Setting response cookies on completion

`finishWf` / `abortWf` cover the envelope, but they don't expose the HTTP-level `cookies` field on wooks's underlying `set()` call. When a terminal step needs to set or clear cookies alongside the envelope (e.g. issuing a session cookie on login completion), reach for the raw call and pass the envelope as `value`:

```typescript
import { useWfFinished } from "@moostjs/event-wf";

useWfFinished().set({
  type: "data",
  value: { finished: true, data: { ok: true, userId } },
  cookies: { session: { value: token, httpOnly: true, sameSite: "lax" } },
});
```

Trade-off: you lose the helper's envelope construction (build the `{ finished: true, ... }` object yourself) but gain cookie control. Use this only when cookies are required; default to `finishWf` / `abortWf` otherwise.

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

### requireInput options

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

## @WfInput() auto-validation flow

`@WfInput()` is built on `useAtscriptWf()`. It resolves the action,
validates the input against the schema, and applies the
action-vs-input policy matrix before the handler body runs.

### What happens on each request

`@WfInput()` reads the param's atscript type and the incoming action, then validates: plain submits run the full validator; actions declared via `@wf.action.withData` get deep-partial validation; actions declared via `@ui.form.action` skip the input entirely (the parameter resolves to `undefined` when `pass: true`); unknown actions throw a re-pause with a `__form` error. On any validation fail, the engine catches the thrown `StepRetriableError` and re-renders the form with `errors`.

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
"forgot password") declares `@WfInput({ pass: true })`. Mark the
parameter optional with `?:` (`input?: Form`); when a no-data action
fires the parameter is `undefined` and the handler runs.

```typescript
@Step("login-credentials")
async enterCredentials(
  @WfAction() action: string | undefined,
  @WfInput({ pass: true }) input?: LoginForm,
) {
  if (action === "forgot") {
    return this.sendPasswordReset();
  }
  // input is fully validated here (the decorator already enforced it)
  await this.auth.login(input!.username, input!.password);
}
```

Use `?:` syntax (`input?: LoginForm`), not a union (`input: LoginForm | undefined`) — the union breaks atscript metadata reflection (TS emits `Object` instead of the AsType for union-typed parameters). `@WfInput({ pass: true })` composes `@Optional()` internally so global validator pipes skip the `undefined` value.

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

## useWfActionSlot

Low-level accessor for the workflow action slot in the wf event context. Intended for **transport adapters** that need to write the action from the incoming request, and for composables that need raw read/clear semantics. In step handlers, prefer `@WfAction()` / `useAtscriptWf(Type).resolveAction()` — those validate the action against the schema and throw `StepRetriableError` on unknown values.

```typescript
import { useWfActionSlot } from "@atscript/moost-wf";

const { getAction, setAction } = useWfActionSlot();
```

| Method              | Purpose                                                      | Where to call                                                                                         |
| ------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `getAction()`       | raw read of the action name (or `undefined`) — no validation | composables that need to inspect or clear the slot; step handlers should prefer the schema-aware path |
| `setAction(action)` | write the action name into event context                     | **transport adapter** (HTTP / CLI / WS controller) — call before invoking the workflow engine         |

The HTTP trigger pulls `action` from the request body and calls `setAction(body.action)`. After that, `@WfAction()` / `useAtscriptWf().resolveAction()` reads it from the same slot with schema validation.

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
  @WfAction() action: string | undefined,
  @WfInput({ pass: true }) input?: LoginForm,
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

`serializeFormSchema(type)` produces the wire-safe form payload `<AsWfForm>` decodes — `@wf.context.pass` is stripped, FK targets ship as shallow refs. Cached per type identity. Used internally by `requireInput()`; expose only if you build a custom outlet.

## getFormActions(type)

`getFormActions(type)` returns `{ actions, actionsWithData }`, the two action sets declared on the type via `@ui.form.action` and `@wf.action.withData`. Used internally to classify the incoming action; expose only if you build a custom dispatcher.

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
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { WfInput, useAtscriptWf, finishWf } from "@atscript/moost-wf";
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
    finishWf({ data: { ok: true, userId: ctx.userId } });
  }
}
```

Wire trace:

1. Client `POST { wfid: 'auth/login' }` → step `credentials`, no input → `@WfInput()` throws `StepRetriableError` → engine emits `inputRequired(LoginForm)` → client renders form.
2. Client `POST { wfs, input: { username, password } }` → step validates, sets ctx, **without MFA**: `verify-otp` is skipped (`condition` false), runs `issue-session` → `@finished`.
3. **With MFA**: `verify-otp` runs, renders `MfaPincodeForm` → client posts code → if valid, advance to `issue-session`.
