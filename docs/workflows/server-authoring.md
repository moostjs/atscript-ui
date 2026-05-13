---
outline: deep
---

# Server-Side Authoring

How to declare a workflow on the server: the decorator stack, schema
with conditional branches, step return semantics, app wiring.

The reference flow used throughout this page is a typical login
workflow.

## The decorator stack

```ts
import { Controller } from "moost";
import {
  Workflow,
  Step,
  WorkflowSchema,
  WorkflowParam,
  useWfFinished,
} from "@moostjs/event-wf";

interface LoginCtx {
  userId?: number;
  mfaEnabled?: boolean;
  otpCode?: string;
}

const needsMfa = (ctx: LoginCtx) => !!ctx.mfaEnabled;

@Controller()
export class LoginWorkflow {
  @Workflow("auth/login")
  @WorkflowSchema<LoginCtx>([
    { id: "login-credentials" },
    { id: "login-verify-otp", condition: needsMfa },
    { id: "login-issue-session" },
  ])
  flow() {}

  @Step("login-credentials")
  async enterCredentials(/* ... */) {}

  @Step("login-verify-otp")
  verifyOtp(/* ... */) {}

  @Step("login-issue-session")
  issueSession(/* ... */) {}
}
```

Five decorators do all the work:

| Decorator                  | Where         | What                                                                                                                                                              |
| -------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@Controller()`            | class         | Standard Moost — makes the class DI-discoverable.                                                                                                                 |
| `@Workflow("id")`          | method        | Declares this controller method as a workflow root. The `id` is what clients pass as `wfid` (e.g. `wfid: "auth/login"`).                                          |
| `@WorkflowSchema<Ctx>([…])`| same method   | Lists the steps and any `condition?: (ctx) => boolean`. The engine evaluates each condition just before executing that step; false skips it.                      |
| `@Step("id")`              | sibling method| Implements one step. The `id` matches a `WorkflowSchema` entry.                                                                                                   |
| `@WorkflowParam("input"\|"context")` | step arg | Injects the current request input or the mutable context object. `input` is whatever the client posted under `input`; `context` is the per-flow state.            |

The `flow()` method that carries `@Workflow` + `@WorkflowSchema` is
usually empty — its body is never called. The decorators just attach
the metadata; the engine reads it and dispatches `@Step` methods in
order.

## Linear vs branched flows

A linear flow just lists steps:

```ts
@WorkflowSchema<HelloCtx>([
  { id: "ask-name" },
  { id: "greet" },
])
```

A branched flow uses `condition`:

```ts
@WorkflowSchema<LoginCtx>([
  { id: "login-credentials" },
  { id: "login-verify-otp", condition: needsMfa },
  { id: "login-issue-session" },
])
```

`needsMfa(ctx)` runs **just before** `login-verify-otp` is about to
execute. If it returns false, the engine skips the step and advances
to `login-issue-session`. The condition reads from the same `context`
object the steps mutate, so a step can flip a flag and the next
condition picks it up.

Conditions stack: you can declare three optional steps in a row, each
with its own predicate, and only the matching subset runs.

## Step return semantics

Three things a step can do:

### 1. Request input (pause)

Return `outletHttp({...})` (or the `httpInputRequired` helper most
real code uses):

```ts
import { outletHttp } from "@moostjs/event-wf";
import { serializeFormSchema, extractPassContext } from "@atscript/moost-wf";

@Step("login-credentials")
async enterCredentials(
  @WorkflowParam("input") input: { username?: string; password?: string } | undefined,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  if (!input?.username || !input?.password) {
    return outletHttp({
      inputRequired: {
        payload: serializeFormSchema(LoginForm),
        transport: "http" as const,
        context: extractPassContext(LoginForm, ctx),
      },
    });
  }
  // ... validate credentials ...
}
```

In practice every codebase ends up with a one-line helper. A common
shape is `httpInputRequired`:

```ts
// shared/wf-helpers.ts
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

Now every step that needs input reads cleanly:

```ts
if (!input?.username || !input?.password) {
  return httpInputRequired(LoginForm, ctx);
}
if (badPassword) {
  return httpInputRequired(LoginForm, ctx, { password: "Invalid credentials" });
}
```

The third arg is field errors — see
[Form Input & Validation](/workflows/form-input).

### 2. Advance to the next step

`return` (or `return undefined`) with no outlet — the engine just
moves on:

```ts
@Step("login-credentials")
async enterCredentials(/* ... */) {
  // ... validation passed ...
  ctx.userId = user.id;
  ctx.mfaEnabled = !!user.mfaEnabled;
  return; // → next step's condition is evaluated, then it runs
}
```

### 3. Finish the workflow

Call `useWfFinished().set(...)` to write the completion payload, then
return:

```ts
import { useWfFinished } from "@moostjs/event-wf";

@Step("login-issue-session")
issueSession(@WorkflowParam("context") ctx: LoginCtx) {
  const token = this.sessions.encode({ userId: ctx.userId! /* ... */ });
  useWfFinished().set({
    type: "data",
    value: { finished: true, ok: true, user: { username: ctx.username! } },
    cookies: {
      session: {
        value: token,
        options: { httpOnly: true, sameSite: "Lax", path: "/", maxAge: 86_400_000 },
      },
    },
  });
  return;
}
```

The `value` field becomes the response body the client sees on
`@finished`. `cookies` sets `Set-Cookie` headers (the HTTP outlet
forwards them — see app wiring below for the eventContext caveat).

## App wiring

Two things to register: the workflow controllers and the HTTP
endpoint that dispatches incoming requests.

### Mount the workflow controllers

```ts
const app = new Moost();
void app.adapter(new MoostHttp()).listen(3000);
app.adapter(new MoostWf());
app.registerControllers(LoginWorkflow, RegisterWorkflow, /* ... */);
```

`MoostWf` is the workflow adapter — it picks up classes with
`@Workflow` decorators and registers their steps with the underlying
`@prostojs/wf` engine.

### Mount the HTTP endpoint

A single `POST /wf` controller forwards every request to the engine:

```ts
import { Controller } from "moost";
import { Post } from "@moostjs/event-http";
import {
  MoostWf,
  handleWfOutletRequest,
  EncapsulatedStateStrategy,
  createHttpOutlet,
  createEmailOutlet,
  type WfOutletTriggerDeps,
} from "@moostjs/event-wf";

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
    return handleWfOutletRequest(
      {
        allow: ["auth/login", "auth/register"],
        state: () => new EncapsulatedStateStrategy({ secret: WF_SECRET }),
        outlets: [createHttpOutlet(), createEmailOutlet(sendEmail)],
        token: { read: ["body", "query", "cookie"], write: "body", name: "wfs" },
      },
      deps,
    );
  }
}
```

A few things to know:

- **Moost `globalPrefix` applies to workflow IDs too.** If your app
  is constructed with `new Moost({ globalPrefix: "api" })`, every
  `@Workflow("auth/login")` registers as `api/auth/login`. The
  `allow` whitelist and the client's `name` prop on `<AsWfForm>` must
  match the prefixed id. The demo handles this by listing `api/auth/login`
  etc. in its allow-list (see
  `packages/vue-demo/src/server/controllers/workflows.controller.ts:29-35`).
- **`allow`** — the whitelist of workflow IDs the endpoint accepts.
  Without this, anyone with the URL could trigger any registered
  workflow.
- **`state`** — picks the state strategy per request. Two built-ins:
  `EncapsulatedStateStrategy` (token is a signed self-contained blob,
  no DB) and `HandleStateStrategy` (token is a UUID; row lives in
  the store). See [State Persistence](/workflows/state-persistence)
  for swapping in `AsWfStore`.
- **`outlets`** — register HTTP (always) and any other outlet the
  workflows use (email magic links, webhooks). See
  [Outlets & Resume](/workflows/outlets-resume).
- **`token`** — where to read/write the state token. `body` is the
  default; `cookie` persists across reloads; `query` enables magic
  links (`?wfs=token` in URLs).
- **`eventContext` forwarding** — the `deps.start`/`deps.resume`
  wrappers forward the HTTP event context so `useWfFinished().set({
  cookies })` actually writes Set-Cookie on the response. Without
  this, the WF runs in an isolated context and cookies are silently
  dropped.

### Mount the FormInputRequired interceptor

If you use `@FormInput()` with `requireInput()` (see
[Form Input & Validation](/workflows/form-input)), mount the catch
interceptor globally so thrown `FormInputRequired` signals turn into
proper outlet responses:

```ts
import { formInputInterceptor } from "@atscript/moost-wf";

app.applyGlobalInterceptors(formInputInterceptor());
```

Mount it once on app boot. Steps that don't throw `FormInputRequired`
are unaffected.

## Reading the workflow context

Inside a step, `@WorkflowParam("context")` gives you the typed,
mutable context object declared by `@WorkflowSchema<Ctx>`:

```ts
@Step("login-credentials")
async enterCredentials(
  @WorkflowParam("input") input: { username?: string; password?: string } | undefined,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  const user = await usersTable.findOne({ filter: { username: input!.username } });
  ctx.userId = user!.id;
  ctx.mfaEnabled = !!user!.mfaEnabled;
  // mutations persist into the next step
}
```

The context is whatever you typed in the generic. The engine
serializes it into the state token (or into the durable store row)
between steps. Don't put non-serializable values in there
(class instances, functions, blobs).

See [Context Passing](/workflows/context) for the rules around
exposing context values to the *client* form.

## Where to go next

- [Form Input & Validation](/workflows/form-input) — `@FormInput()`,
  `requireInput()`, server-side errors.
- [Actions](/workflows/actions) — alt actions like "resend code" or
  "save draft".
- [Outlets & Resume](/workflows/outlets-resume) — pause for an
  external event, resume via a token in a magic link.
