---
outline: deep
---

# Context Passing

Every workflow has a **context** — a typed, mutable object that
persists across steps. Steps mutate it; conditions read it; the
state strategy serializes it between rounds. This page covers how it
works and — importantly — how to expose select keys to the _client
form_ without leaking the rest.

## The context object

Declared by the generic on `@WorkflowSchema<Ctx>`:

```ts
interface LoginCtx {
  userId?: number;
  username?: string;
  email?: string;
  roleId?: number;
  roleName?: SessionPayload["roleName"];
  mfaEnabled?: boolean;
  otpCode?: string;
}

@Workflow("auth/login")
@WorkflowSchema<LoginCtx>([
  { id: "login-credentials" },
  { id: "login-verify-otp", condition: (ctx) => !!ctx.mfaEnabled },
  { id: "login-issue-session" },
])
flow() {}
```

Inject it with `@WorkflowParam("context")`:

```ts
@Step("login-credentials")
async enterCredentials(
  @WorkflowParam("input") input: { username?: string; password?: string } | undefined,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  const user = await usersTable.findOne({ filter: { username: input!.username } });
  // Mutations persist into the next step
  ctx.userId = user!.id;
  ctx.email = user!.email;
  ctx.mfaEnabled = !!user!.mfaEnabled;
  if (ctx.mfaEnabled) {
    ctx.otpCode = String(Math.floor(100000 + Math.random() * 900000));
    await sendOtpEmail(ctx.email, ctx.otpCode);
  }
  return;
}
```

Mutations are persisted by the state strategy between steps. With
`EncapsulatedStateStrategy` the whole context is encrypted into the
token; with `HandleStateStrategy` (`AsWfStore`) it lives in the
`state` JSON column.

**Keep it serializable.** No class instances, functions, blobs.
Primitives, arrays, plain objects only.

## Exposing context to the client form

By default the client form sees **nothing** about the context. If
your `@ui.form.fn.title` wants to read `ctx.email`, or your action
button label wants `ctx.username`, you have to opt those keys in.

### `@wf.context.pass 'key'`

Decorate the **form type** (not the field) with one or more
`@wf.context.pass` annotations:

```atscript
@wf.context.pass 'email'
@meta.label 'Verify Identity'
@ui.form.submit.text 'Verify Code'
@ui.form.fn.title '(data, ctx) => `Enter the code sent to ${ctx.email || "your email"}`'
export interface MfaPincodeForm {
    @meta.label 'Verification Code'
    @ui.form.placeholder '000000'
    @meta.required 'Code is required'
    @expect.minLength 6, '6 digits expected'
    @expect.maxLength 6, '6 digits expected'
    code: string
}
```

The list works as a whitelist:

- Multiple `@wf.context.pass` annotations accumulate (merge strategy
  `append`).
- Only listed keys are extracted from the workflow context.
- Keys present on the context but not listed are **never sent** to
  the client.

### How it propagates

When a step's `@WfInput()` decorator (or a manual
`useAtscriptWf(MfaPincodeForm).requireInput()` call) throws a
`StepRetriableError`, the framework:

1. Calls `extractPassContext(MfaPincodeForm, ctx)` — reads
   `wf.context.pass` annotations from the type's metadata, picks
   only matching keys off the context object.
2. Builds the response: `{ inputRequired: { payload, transport,
context: { email: ctx.email } } }`.
3. The client form's `formContext` ref ends up as `{ email: "..." }`.

Both `@WfInput()` and `useAtscriptWf().requireInput()` call
`extractPassContext` under the hood, so the whitelist applies
uniformly.

If you re-pause with errors, errors merge into the context:

```json
"context": {
  "email": "alice@example.com",
  "errors": { "code": "Invalid code" }
}
```

The client splits `errors` back off (it lives on the form's
`errors` ref) and leaves the rest as `formContext`.

## Reading context on the client

### From the `<AsWfForm>` slots

The slot props expose `formContext`:

```vue
<AsWfForm path="/wf" name="auth/login" :types="types">
  <template #form.header="{ formContext }">
    <div v-if="formContext?.email">
      We sent a code to {{ formContext.email }}.
    </div>
  </template>
</AsWfForm>
```

### From `useWfForm()`

```ts
const wf = useWfForm({ path: "/wf", name: "auth/login" });

watch(wf.formContext, (ctx) => {
  console.log("server context:", ctx); // { email: "alice@example.com" }
});
```

### From dynamic form annotations

The most common consumer is a `@ui.form.fn.*` expression on the form
itself. The function receives `(data, ctx)`:

```atscript
@wf.context.pass 'email'
@ui.form.fn.title '(data, ctx) => `Enter the code sent to ${ctx.email}`'
export interface MfaPincodeForm { /* ... */ }
```

`data` is the current `formData.value`; `ctx` is the whitelisted
context. The full set of dynamic field functions is documented at
[Forms / Dynamic Fields](/forms/dynamic-fields).

Use this for:

- **Dynamic titles** — `"Welcome back, ${ctx.username}"`.
- **Dynamic submit labels** — `"Pay $${ctx.total}"`.
- **Conditional descriptions** — `"Sent to ${ctx.maskedPhone}"`.
- **Action labels** — `"Resend to ${ctx.email}"`.

## Display-only fields backed by context

When a step needs to **show** something the server computed — a TOTP
enrolment URI, a one-shot magic link, a masked phone number — without
asking the user to edit it, combine context-pass with a phantom field
typed as `ui.paragraph` and a `@ui.form.fn.value` resolver.

```atscript
@wf.context.pass 'totpUri'
@wf.context.pass 'magicLink'
@meta.label 'Activate TOTP & share invite link'
@ui.form.submit.text 'Continue'
export interface QrCopyDemoForm {
    @meta.label 'Scan with your authenticator app'
    @ui.form.fn.value '(v, data, ctx) => ctx.totpUri'
    @ui.form.component 'qr-code'
    totpUri: ui.paragraph

    @meta.label 'Magic link'
    @ui.form.fn.value '(v, data, ctx) => ctx.magicLink'
    @ui.form.component 'copy'
    magicLink: ui.paragraph
}
```

What each piece does:

- `@wf.context.pass 'totpUri' / 'magicLink'` whitelists the two keys
  into `formContext`. Without them, `ctx.totpUri` / `ctx.magicLink`
  would be `undefined` on the client.
- `ui.paragraph` marks the field as **phantom**. The form treats it as
  non-data chrome — no slot is allocated in `formData`, and the value
  never crosses back to the server on submit. Phantom values reach the
  renderer through `props.value`, not `props.model.value`.
- `@ui.form.fn.value` resolves the displayed value from the context.
  Combine with `@ui.form.component 'qr-code'` / `'copy'` from
  [`@atscript/vue-aooth`](/forms/aooth-components) — those components
  read `props.value ?? props.model?.value`, so the same renderer works
  for phantom and data-bound fields.

::: warning Field-level fn signature
Field-level functions are `(v, data, ctx, entry)`. Writing
`'(_, ctx) => ctx.totpUri'` silently routes `formData` into `ctx` and
the real context goes unread. Only **form-level** keys
(`@ui.form.fn.title`, `@ui.form.fn.description`,
`@ui.form.fn.submit.text`, `@ui.form.fn.submit.disabled`) use the
two-argument `(data, ctx)` shape. See [Dynamic Fields](/forms/dynamic-fields#scope-passed-to-every-function).
:::

When the resolved value should land in the bound data slot — because a
downstream column, audit log, or schema expects it — use a data field
with `@meta.readonly` + `@ui.form.fn.value` instead of a phantom one.
`AsField` resolves the function and writes the result into the bound
path through a watcher (see the "Readonly watcher" block in
`packages/vue-form/src/components/as-field.vue`). Phantom is the
cleaner shape whenever the value is purely display.

## What stays server-side

Anything **not** in `@wf.context.pass` never crosses the wire:

```ts
// Server-side context for the LoginCtx flow:
ctx.userId = 42; // ← not in @wf.context.pass — NEVER sent
ctx.otpCode = "123456"; // ← not in @wf.context.pass — NEVER sent
ctx.email = "..."; // ← whitelisted — sent
```

The framework defaults to _whitelist_ not _blacklist_ for exactly
this reason: forgetting to mark `otpCode` private would be a
catastrophic bug; forgetting to mark `email` public is a harmless
"the title shows 'your email'" fallback.

## When context shape changes between steps

A multi-step flow accumulates state — by step 3, `ctx.userId` exists;
in step 1 it doesn't. That's fine: the form's dynamic functions
should always be defensive about `ctx?.email`-style access.

When you store a context value into a durable store **shadow column**
(see [State Persistence](/workflows/state-persistence)) the same
rule applies — the field is optional (`?:`) because mid-flow rows
may not have the value yet.

## Where to go next

- [State Persistence](/workflows/state-persistence) — putting
  `@wf.store.fromContext` on a row column so context values are
  queryable from your admin UI.
- [Forms / Dynamic Fields](/forms/dynamic-fields) — the full
  `@ui.form.fn.*` toolbox that consumes `ctx`.
- [Recipes](/workflows/recipes) — flows that lean on context-driven
  dynamic UI.
