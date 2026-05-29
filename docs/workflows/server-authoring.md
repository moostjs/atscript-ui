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
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";

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

| Decorator                            | Where          | What                                                                                                                                                   |
| ------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@Controller()`                      | class          | Standard Moost — makes the class DI-discoverable.                                                                                                      |
| `@Workflow("id")`                    | method         | Declares this controller method as a workflow root. The `id` is what clients pass as `wfid` (e.g. `wfid: "auth/login"`).                               |
| `@WorkflowSchema<Ctx>([…])`          | same method    | Lists the steps and any `condition?: (ctx) => boolean`. The engine evaluates each condition just before executing that step; false skips it.           |
| `@Step("id")`                        | sibling method | Implements one step. The `id` matches a `WorkflowSchema` entry.                                                                                        |
| `@WorkflowParam("input"\|"context")` | step arg       | Injects the current request input or the mutable context object. `input` is whatever the client posted under `input`; `context` is the per-flow state. |

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

The recommended path is the `@WfInput()` decorator — see
[Form Input & Validation](/workflows/form-input). It auto-validates
the input against the schema, auto-pauses on missing/invalid input,
and lets the handler body focus on business logic:

```ts
import { WfInput, useAtscriptWf } from "@atscript/moost-wf";

@Step("login-credentials")
async enterCredentials(
  @WfInput() input: LoginForm,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  // input is schema-validated; reach the body only with valid input
  const user = await usersTable.findOne({ filter: { username: input.username } });
  if (!user || !verify(input.password, user.password)) {
    throw useAtscriptWf(LoginForm).requireInput({
      errors: { password: "Invalid credentials" },
    });
  }
  ctx.userId = user.id;
}
```

`useAtscriptWf(Type).requireInput({ errors? , formMessage? })` builds
a `StepRetriableError` carrying the schema + field errors; the
workflow engine catches it natively and re-pauses the same step. See
[Form Input & Validation](/workflows/form-input) for the full
contract.

Prefer the composable directly when you need to interleave action
handling with validation:

```ts
import { useAtscriptWf } from "@atscript/moost-wf";

@Step("login-credentials")
async enterCredentials(@WorkflowParam("context") ctx: LoginCtx) {
  const wf = useAtscriptWf(LoginForm);
  if (wf.resolveAction() === "forgot") {
    await this.sendPasswordReset();
    return;
  }
  const input = wf.resolveInput();
  // ... validate credentials ...
}
```

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

Call `finishWf(opts?)` (or `abortWf(reason, opts?)` for a soft failure)
from `@atscript/moost-wf` to build the `WfFinished` envelope and end
the flow:

```ts
import { finishWf } from "@atscript/moost-wf";

@Step("login-issue-session")
issueSession(@WorkflowParam("context") ctx: LoginCtx) {
  finishWf({
    data: { ok: true, user: { username: ctx.username! } },
    message: { level: "success", text: "Signed in." },
  });
  return;
}
```

`opts.data` becomes the envelope's typed payload the client sees on
`@finished`. `opts.message` / `opts.next` drive the terminal screen
(`<AsWfFinish>`) — see [Finish Screens](/workflows/finish-screens) for
the full envelope shape. The `finished: true` marker `<AsWfForm>`
routes on is supplied by the helper; `handleAsOutletRequest` only
wraps step results that don't already carry it (see app wiring below).

Use `abortWf("reason", { message })` when the flow ends in a
recoverable terminal state (rate-limited, user-cancelled). The envelope
adds `aborted: true` + `reason` so the client can render the failure
without treating it as a hard error.

::: tip Setting cookies alongside the envelope
`finishWf` / `abortWf` cover plain JSON envelopes. To attach
`Set-Cookie` headers (e.g. a session cookie issued on completion),
drop down to the raw `useWfFinished` from `@moostjs/event-wf`:

```ts
import { useWfFinished } from "@moostjs/event-wf";

useWfFinished().set({
  type: "data",
  value: { finished: true, data: { ok: true } },
  cookies: {
    session: {
      value: token,
      options: { httpOnly: true, sameSite: "Lax", path: "/", maxAge: 86_400_000 },
    },
  },
});
```

The helpers don't expose the `cookies` field — when you need it, build
the envelope yourself and hand the whole thing to `useWfFinished`.
The HTTP outlet forwards the cookies (see the eventContext caveat in
app wiring below).
:::

## App wiring

Two things to register: the workflow controllers and the HTTP
endpoint that dispatches incoming requests.

### Mount the workflow controllers

```ts
const app = new Moost();
void app.adapter(new MoostHttp()).listen(3000);
app.adapter(new MoostWf());
app.registerControllers(LoginWorkflow, RegisterWorkflow /* ... */);
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
  EncapsulatedStateStrategy,
  createEmailOutlet,
  type WfOutletTriggerDeps,
} from "@moostjs/event-wf";
import { createAsHttpOutlet, handleAsOutletRequest } from "@atscript/moost-wf";

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
        allow: ["auth/login", "auth/register"],
        state: new EncapsulatedStateStrategy({ secret: WF_SECRET }),
        outlets: [createAsHttpOutlet(), createEmailOutlet(sendEmail)],
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
  match the prefixed id.
- **`allow`** — the whitelist of workflow IDs the endpoint accepts.
  Without this, anyone with the URL could trigger any registered
  workflow.
- **`state`** — the state strategy. Pass a single `WfStateStrategy`
  instance (auto-registered as name `'default'`), or a named registry
  `{ strategies, default }` to mix strategies per flow. Two built-ins:
  `EncapsulatedStateStrategy` (token is a signed self-contained blob,
  no DB) and `HandleStateStrategy` (token is a handle; row lives in
  the store). See [State Persistence](/workflows/state-persistence)
  for swapping in `AsWfStore` and the named-registry form.
- **`outlets`** — register HTTP (always) and any other outlet the
  workflows use (email magic links, webhooks). Use
  `createAsHttpOutlet()` from `@atscript/moost-wf` so HTTP responses
  carry the `inputRequired` envelope the `<AsWfForm>` client expects.
  See [Outlets & Resume](/workflows/outlets-resume).
- **`token`** — where to read/write the state token. `body` is the
  default; `cookie` persists across reloads; `query` enables magic
  links (`?wfs=token` in URLs).
- **`eventContext` forwarding** — the `deps.start`/`deps.resume`
  wrappers forward the HTTP event context so the cookies-escape-hatch
  call to `useWfFinished().set({ cookies })` actually writes
  Set-Cookie on the response. Without this, the WF runs in an isolated
  context and cookies are silently dropped.

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
exposing context values to the _client_ form.

## Where to go next

- [Form Input & Validation](/workflows/form-input) — `@WfInput()`,
  `useAtscriptWf().requireInput()`, server-side errors.
- [Actions](/workflows/actions) — alt actions like "resend code" or
  "save draft".
- [Outlets & Resume](/workflows/outlets-resume) — pause for an
  external event, resume via a token in a magic link.
