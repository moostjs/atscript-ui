# server

Authoring server-side workflow controllers with `@atscript/moost-wf` on top of `@moostjs/event-wf`.

## Contents

- [Decorator stack](#decorator-stack)
- [Schema authoring](#schema-authoring)
- [Step handler signatures and return semantics](#step-handler-signatures-and-return-semantics)
- [httpInputRequired pattern](#httpinputrequired-pattern)
- [@FormInput() auto-validation flow](#forminput-auto-validation-flow)
- [TFormInput<T> contract](#tforminputt-contract)
- [useFormInput composable](#useforminput-composable)
- [useWfAction](#usewfaction)
- [Action handlers](#action-handlers)
- [formInputInterceptor() — global mount](#forminputinterceptor--global-mount)
- [serializeFormSchema(type)](#serializeformschematype)
- [getFormActions(type)](#getformactionstype)
- [Error handling](#error-handling)
- [Recipe — login + MFA branching](#recipe--login--mfa-branching)

## Decorator stack

| Decorator                                         | Package              | Where                        | Purpose                                                               |
| ------------------------------------------------- | -------------------- | ---------------------------- | --------------------------------------------------------------------- |
| `@Controller()`                                   | `moost`              | class                        | declare a DI-managed controller                                       |
| `@Workflow('<id>')`                               | `@moostjs/event-wf`  | method                       | mark the flow root; `<id>` is the `wfid` clients pass                 |
| `@WorkflowSchema<Ctx>([{ id, condition? }, ...])` | `@moostjs/event-wf`  | method (same as `@Workflow`) | declare step graph + branching                                        |
| `@Step('<id>')`                                   | `@moostjs/event-wf`  | method                       | implement one step                                                    |
| `@WorkflowParam('input' \| 'context')`            | `@moostjs/event-wf`  | param                        | inject current input or context                                       |
| `@FormInput()`                                    | `@atscript/moost-wf` | param                        | inject `TFormInput<T>` and auto-validate before the handler body runs |
| `@AltAction()`                                    | `@atscript/moost-wf` | param                        | inject `string \| undefined` — the action name the client sent        |

The `moost` controller itself is the DI surface (`packages/vue-demo/src/server/workflows/auth/login.workflow.ts:1-2`):

```typescript
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam, useWfFinished } from "@moostjs/event-wf";
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

`new Moost({ globalPrefix: "api" })` prepends the prefix to every `@Workflow("auth/login")` registration → the live wfid becomes `api/auth/login`. The `allow:` whitelist in `handleWfOutletRequest({ allow })` and the client's `name` prop on `<AsWfForm>` must match the prefixed id. See `packages/vue-demo/src/server/controllers/workflows.controller.ts:29-35` for the demo's allow-list.

### Branching semantics

- `condition` is called with the current context.
- Returns truthy → step runs.
- Returns falsy → step is **skipped** entirely (handler is not invoked).
- Conditions are pure functions over `ctx`. Do not read DB / external state from a condition — set the flag in a prior step's body and branch on that flag.

The condition function lives on the schema decorator, **not** on the step. Step handlers themselves do not declare conditions.

## Step handler signatures and return semantics

Each step is an async (or sync) method on the controller. Four possible terminations:

| Termination                                     | Signal                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| **Advance** to next step                        | return `undefined` (or any non-outlet value)                                     |
| **Pause** and ask client for input              | return `httpInputRequired(FormType, ctx)` — uses `outletHttp` outlet             |
| **Pause** and outlet (email / webhook)          | return `outletEmail(...)` / custom outlet — see [outlets.md](outlets.md)         |
| **Complete** the flow                           | `useWfFinished().set({ type: 'data', value })` then `return`                     |
| **Re-pause** mid-handler with validation errors | `throw form.requireInput({ field: 'msg' })` — caught by `formInputInterceptor()` |

```typescript
@Step("login-credentials")
async enterCredentials(
  @WorkflowParam("input") input: { username?: string; password?: string } | undefined,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  if (!input?.username || !input?.password) {
    return httpInputRequired(LoginForm, ctx);
  }
  const user = await usersTable.findOne({ filter: { username: input.username } });
  if (!user || !verify(input.password, user)) {
    return httpInputRequired(LoginForm, ctx, { password: "Invalid credentials" });
  }
  ctx.userId = user.id;
  // implicit return → engine advances to next step
}
```

`return` (without a value) is the signal to advance. The engine treats the **shape of the return value** as the outlet decision — see `@moostjs/event-wf` documentation. Anything not recognized as an outlet response is treated as "step complete, advance".

## httpInputRequired pattern

`httpInputRequired(type, wfContext, errors?)` is the canonical helper for "pause and render this form". It is **not** a public export of `@atscript/moost-wf` — copy this helper into your project (e.g. `src/wf/wf-helpers.ts`):

```typescript
import { outletHttp, type WfOutletRequest } from "@moostjs/event-wf";
import { serializeFormSchema, extractPassContext } from "@atscript/moost-wf";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";

export function httpInputRequired(
  type: TAtscriptAnnotatedType,
  wfContext: object,
  errors?: Record<string, string>,
): { inputRequired: WfOutletRequest } {
  const context: Record<string, unknown> = {
    ...extractPassContext(type, wfContext as Record<string, unknown>),
  };
  if (errors) context.errors = errors;
  return outletHttp({
    inputRequired: {
      payload: serializeFormSchema(type),
      transport: "http",
      context,
    },
  }) as { inputRequired: WfOutletRequest };
}
```

Three responsibilities:

1. `serializeFormSchema(type)` — strip `@wf.context.pass` and produce wire-safe payload (cached per type identity).
2. `extractPassContext(type, wfContext)` — copy only whitelisted keys from `wfContext` into the response.
3. `outletHttp({...})` — wrap in the http-outlet envelope so the trigger emits `{ inputRequired: {...}, wfs: '<token>' }`.

`errors` keys are field paths. Special key `__form` is a top-level form error (e.g. "Invalid credentials"). The client renders these via `AsForm`'s error map.

## @FormInput() auto-validation flow

`@FormInput()` is the higher-level alternative to manual `httpInputRequired` calls. It pairs a `Resolve` (parameter injection) with an `Intercept` (method interceptor) on the same step (`packages/moost-wf/src/form-input/decorator.ts:32-47`).

### What happens on each request

```
1. Interceptor `before(reply)` runs (priority: INTERCEPTOR)
2. Reads `wfState.input()` and the alt-action (via `useWfAction()`)
3. Reads the param's atscript type from method metas
4. If no input AND no action  → `reply({ inputRequired: {...} })` — handler never runs
5. If action declared in `@ui.form.action` (no data)  → handler runs (action-only branch)
6. If action declared in `@wf.action.withData`       → validate partial input, then handler runs
7. If unknown action                                  → `reply({ inputRequired: {...errors: { __form: '...' }} })`
8. Otherwise (plain submit)                           → run validator (full), reply with errors on fail
```

If the validator rejects, the interceptor builds the `inputRequired` response itself and the handler body never executes. Field errors are flattened from the validator's path-keyed list (`packages/moost-wf/src/form-input/decorator.ts:146-154`).

### Decorator usage

```typescript
import { FormInput, type TFormInput } from "@atscript/moost-wf";
import { Step } from "@moostjs/event-wf";
import { LoginForm } from "./forms.as";

@Step("login")
async login(@FormInput() form: TFormInput<typeof LoginForm>) {
  const data = form.data();  // validated and typed
  try {
    await this.auth.login(data!.username, data!.password);
  } catch {
    throw form.requireInput({ password: "Invalid credentials" });
  }
}
```

Two key effects:

- **Auto-validate**: bad input is rejected before the body runs.
- **Auto-reply on missing input**: first hit (no `input`, no `action`) produces the form definition the client renders.

### Validation modes

| Mode           | Trigger                                        | Options                                      |
| -------------- | ---------------------------------------------- | -------------------------------------------- |
| Full           | plain submit (no action)                       | `{ unknownProps: "strip" }`                  |
| Partial (deep) | action present in `@wf.action.withData` list   | `{ partial: "deep", unknownProps: "strip" }` |
| None           | action present in plain `@ui.form.action` list | handler receives raw context, no input       |

Source: `packages/moost-wf/src/form-input/decorator.ts:82-106`.

## TFormInput<T> contract

```typescript
export type TFormInput<_T = unknown> = ReturnType<typeof useFormInput>;
// →
// {
//   data<T = unknown>(): T | undefined,
//   requireInput(errors?: Record<string, string>): FormInputRequired,
// }
```

- `data()` returns the **validated** payload (because the interceptor ran first). The return is typed `T | undefined` — undefined never happens in practice after `@FormInput()` because the interceptor would have replied. Use `data()!` or guard.
- `requireInput(errors)` returns a `FormInputRequired` instance. **Throw it.** `formInputInterceptor()` catches it and emits the response.

Source: `packages/moost-wf/src/form-input/decorator.ts:49` and `packages/moost-wf/src/form-input/use.ts:20-49`.

## useFormInput composable

`useFormInput(type?)` is the underlying composable. Use it when:

- You want `form.requireInput()` without the `@FormInput()` interceptor (e.g. multiple form types in one step).
- You build a custom adapter that bypasses the decorator stack.

```typescript
import { useFormInput, type TFormInput } from "@atscript/moost-wf";
import { LoginForm } from "./forms.as";

@Step("login")
async login() {
  const form = useFormInput(LoginForm) as TFormInput<typeof LoginForm>;
  const data = form.data<{ username?: string; password?: string }>();
  if (!data?.username) throw form.requireInput();
  // ...
}
```

If `type` is omitted, `requireInput()` will throw `"useFormInput(): no atscript type available."` (`packages/moost-wf/src/form-input/use.ts:36-42`). Pass the type explicitly when not using `@FormInput()`.

## useWfAction

```typescript
import { useWfAction } from "@atscript/moost-wf";

const { getAction, setAction } = useWfAction();
```

| Method              | Purpose                                               | Where to call                                                                        |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `getAction()`       | read the action name the client sent (or `undefined`) | step handlers (prefer `@AltAction()`)                                                |
| `setAction(action)` | write the action name into event context              | **HTTP trigger** — call before invoking the workflow engine, so step handlers see it |

The HTTP trigger should pull `action` from the request body and call `setAction(body.action)`. After that, `@AltAction()` and the `@FormInput()` interceptor read it from event context via the `actionKey` slot (`packages/moost-wf/src/form-input/wf-keys.ts:15`).

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
  @FormInput() form: TFormInput<typeof LoginForm>,
  @AltAction() action: string | undefined,
) {
  if (action === "forgot") {
    await this.sendPasswordReset(/* read email from a previous field if you collected it */);
    throw form.requireInput({ __form: "Reset link sent" });
  }
  if (action === "saveDraft") {
    const partial = form.data();
    await this.drafts.save(partial);
    throw form.requireInput();  // re-render same form, no errors
  }
  // plain submit
  await this.auth.login(form.data()!);
}
```

Action validation modes recap:

| Action source              | Validation                                                                        |
| -------------------------- | --------------------------------------------------------------------------------- |
| `@ui.form.action 'id'`     | none — handler receives whatever the client sent                                  |
| `@wf.action.withData 'id'` | deep-partial — filled fields validated, missing OK                                |
| Unknown action             | `formInputInterceptor` auto-replies `{ __form: 'Action "..." is not supported' }` |

Action discovery: `getFormActions(type)` returns `{ actions, actionsWithData }` (`packages/moost-wf/src/form-input/context.ts:39-81`). The interceptor uses this to classify the incoming action.

## formInputInterceptor() — global mount

**Mount once at app bootstrap. Skipping this breaks the protocol.** See SKILL.md invariant 1.

```typescript
import { formInputInterceptor } from "@atscript/moost-wf";

app.applyGlobalInterceptors(formInputInterceptor());
```

Behaviour (`packages/moost-wf/src/form-input/interceptor.ts:15-32`):

- Priority `CATCH_ERROR` — runs after handler / other interceptors.
- Catches **only** `FormInputRequired` instances (other errors pass through).
- Calls `reply({ inputRequired: { payload, transport: 'http', context: { ...passContext, errors } } })`.

This is the bridge from "throw to re-pause" (step body / `@FormInput()` validation) → outlet response shape.

## serializeFormSchema(type)

```typescript
serializeFormSchema(type: TAtscriptAnnotatedType): unknown
```

- Delegates to `serializeAnnotatedType(type, { ignoreAnnotations: ['wf.context.pass'], refDepth: 0.5 })`.
- Strips `@wf.context.pass` from the wire payload (server-only annotation).
- `refDepth: 0.5` = **shallow refs** — FK targets ship with `id` + interface metadata (`db.http.path`) but no structural body. Sufficient for `AsRef` pickers; keeps payload small.
- Cached in a `WeakMap` keyed by `TAtscriptAnnotatedType` identity. Repeated serialization of the same type returns the cached payload.

Source: `packages/moost-wf/src/form-input/serialize.ts:5-30`.

## getFormActions(type)

```typescript
getFormActions(type: TAtscriptAnnotatedType): { actions: string[]; actionsWithData: string[] }
```

Walks `type.type.props`, reads `@ui.form.action`, `@wf.action.withData`, and legacy `@ui.altAction` annotations on each field. Cached per type. Used internally by `@FormInput()` to classify the incoming action; expose only if you build a custom dispatcher.

`@ui.form.action` may be `{ id, label? }` or a bare string. `@wf.action.withData` is always a bare string.

Source: `packages/moost-wf/src/form-input/context.ts:39-81`.

## Error handling

| Failure                                   | Effect                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| Step throws non-`FormInputRequired` error | bubbles to Moost's normal error handler → HTTP 500 + `@error` on client           |
| Step throws `form.requireInput({...})`    | `formInputInterceptor` catches → same-form re-render with errors                  |
| `@FormInput()` validator rejects          | interceptor auto-pauses with field errors → handler body never runs               |
| Unknown action                            | `formInputInterceptor` auto-replies `{ __form: 'Action "..." is not supported' }` |
| HTTP failure (non-2xx)                    | client `useWfForm` sets `error = { message, status }` → `@error`                  |

### Auth

Per-step authentication / authorization uses Moost's standard decorators (`@Authenticate`, `@Authorize`, etc.) — see the `moostjs` skill. Apply them to step methods just like any other Moost handler.

```typescript
@Step("admin-action")
@Authorize("admin")
async adminAction(@FormInput() form: TFormInput<AdminForm>) { ... }
```

Auth failures convert to thrown errors that surface to the client as `{ error: { message, status: 401 } }`. The form does not re-render — the user sees the error.

## Recipe — login + MFA branching

Schema with conditional MFA step (`packages/vue-demo/src/server/workflows/auth/login.workflow.ts` is the reference pattern):

```typescript
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam, useWfFinished } from "@moostjs/event-wf";
import { LoginForm, MfaPincodeForm } from "./forms.as";
import { httpInputRequired } from "./wf-helpers";

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
  async credentials(
    @WorkflowParam("input") input: { username?: string; password?: string } | undefined,
    @WorkflowParam("context") ctx: LoginCtx,
  ) {
    if (!input?.username || !input?.password) return httpInputRequired(LoginForm, ctx);
    const user = await verify(input);
    if (!user) return httpInputRequired(LoginForm, ctx, { password: "Invalid credentials" });
    ctx.userId = user.id;
    ctx.email = user.email;
    ctx.mfaEnabled = user.mfaEnabled;
    if (ctx.mfaEnabled) {
      ctx.otpCode = generateOtp();
      await sendEmail(ctx.email, ctx.otpCode);
    }
  }

  @Step("verify-otp")
  verifyOtp(
    @WorkflowParam("input") input: { code?: string } | undefined,
    @WorkflowParam("context") ctx: LoginCtx,
  ) {
    if (!input?.code) return httpInputRequired(MfaPincodeForm, ctx);
    if (input.code !== ctx.otpCode)
      return httpInputRequired(MfaPincodeForm, ctx, { code: "Invalid code" });
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

1. Client `POST { wfid: 'auth/login' }` → step `credentials`, no input → `inputRequired(LoginForm)` → client renders form.
2. Client `POST { wfs, input: { username, password } }` → step validates, sets ctx, **without MFA**: `verify-otp` is skipped (`condition` false), runs `issue-session` → `@finished`.
3. **With MFA**: `verify-otp` runs, renders `MfaPincodeForm` → client posts code → if valid, advance to `issue-session`.
