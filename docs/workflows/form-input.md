---
outline: deep
---

# Form Input & Validation

How a step receives validated form input, and how it re-renders the
same form with errors when validation fails. The handler stays
focused on business logic; the framework handles the envelope, the
validation, and the wire format.

## Two ways to receive input

### Manual: `@WorkflowParam("input")`

The lowest-level option, shown throughout
[Server-Side Authoring](/workflows/server-authoring):

```ts
interface WfInputEnvelope {
  action?: string;
  formData?: { username?: string; password?: string };
}

@Step("login-credentials")
async enterCredentials(
  @WorkflowParam("input") input: WfInputEnvelope | undefined,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  const formData = input?.formData;
  if (!formData?.username || !formData?.password) {
    throw useAtscriptWf(LoginForm).requireInput();
  }
  // ... use formData.username, formData.password ...
}
```

The wire envelope wraps user data in `{ action?, formData? }` — both
peers ride the workflow's `input` slot, which the engine wipes between
steps. `@WfInput()` and `useAtscriptWf(Type).resolveInput()` unwrap
`formData` for you; only the manual `@WorkflowParam("input")` form
exposes the envelope shape.

You write the empty-input guard, you decide when to re-pause. No
automatic validation — the handler sees raw client data.

### Decorator: `@WfInput()`

`@WfInput()` collapses the boilerplate into one parameter:

```ts
import { WfInput } from "@atscript/moost-wf";
import { LoginForm } from "./LoginForm.as";

@Step("login-credentials")
async enterCredentials(
  @WfInput() input: LoginForm,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  // input is validated and typed — auth.login can use it directly
  await this.auth.login(input.username, input.password);
}
```

The decorator does three things:

1. **Auto-pause** on first call (no input yet) — returns the
   serialized schema to the client; the handler body never runs.
2. **Auto-validate** subsequent calls against the form type. Any
   `@expect.*`, `@meta.required`, `string.email`, custom
   `@ui.form.validate` rule baked into the type fires automatically.
3. **Reject the input** with a `StepRetriableError` carrying the
   schema + field errors — the workflow engine catches it natively
   and re-pauses the same step with the new error map.

If validation fails, the framework re-pauses the workflow at the
same step with the field errors. The handler body is **not** called
— so by the time your code runs, the input is guaranteed valid for
that type's static constraints.

## Bailing out with custom errors

Validation that the `.as` type can't express — DB uniqueness checks,
auth failures, business-rule violations — uses
`useAtscriptWf(Type).requireInput(opts?)` to build the same
`StepRetriableError` the decorator throws. **Throw it** (don't
return) to re-pause with the schema + the error map.

```ts
import { useAtscriptWf, WfInput } from "@atscript/moost-wf";
import { LoginForm } from "./LoginForm.as";

@Step("login-credentials")
async enterCredentials(
  @WfInput() input: LoginForm,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  const user = await usersTable.findOne({ filter: { username: input.username } });
  if (!user || !verify(input.password, user.password)) {
    throw useAtscriptWf(LoginForm).requireInput({
      errors: { password: "Invalid username or password" },
    });
  }
  ctx.userId = user.id;
  return;
}
```

`requireInput()` accepts:

- `errors` — `Record<string, string>` keyed by field path. Special
  key `__form` is a top-level form-wide error.
- `formMessage` — convenience for `errors: { __form: '...' }`.
  Combine with `errors` to attach a form-wide message alongside
  field errors.

```ts
throw useAtscriptWf(LoginForm).requireInput({
  formMessage: "Account is suspended",
});
```

## Server-side validation errors

The same flow handles both kinds of errors uniformly:

| Error source                   | What the framework does                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Type-level (`@expect.*`, etc.) | `@WfInput()` validates the input. On fail, throws `StepRetriableError`; engine re-pauses. |
| Business-level                 | Handler calls `throw useAtscriptWf(Type).requireInput({ errors: { field: 'msg' } })`.     |

Both produce the same wire response — `{ inputRequired: { payload,
transport, context: { errors: {...} } } }` — and the client renders
the same form with the new errors.

### Mid-handler validation: "email already taken"

A classic case the `.as` type can't express:

```ts
@Step("register-details")
async enterDetails(
  @WfInput() input: RegisterForm,
  @WorkflowParam("context") ctx: RegisterCtx,
) {
  const wf = useAtscriptWf(RegisterForm);

  const usernameTaken = await usersTable.findOne({ filter: { username: input.username } });
  if (usernameTaken) {
    throw wf.requireInput({ errors: { username: "Username already taken" } });
  }
  const emailTaken = await usersTable.findOne({ filter: { email: input.email } });
  if (emailTaken) {
    throw wf.requireInput({ errors: { email: "Email already registered" } });
  }

  // ... advance, hash password, etc. ...
}
```

Pass multiple errors in one map; they all light up at once on the
client:

```ts
throw useAtscriptWf(RegisterForm).requireInput({
  errors: {
    username: "Username already taken",
    email: "Email already registered",
  },
});
```

### Form-level (cross-field) errors

`formMessage` shows the error at the form's root, not attached to
any field:

```ts
throw useAtscriptWf(LoginForm).requireInput({
  formMessage: "Account is suspended",
});
```

The client's default form renders form-level errors at the top of
the form chrome (see [Forms / Validation](/forms/validation)).

## Same-form detection: preserving user input

The client tracks the serialized payload of the last-received form.
When the server returns the **same** form (same schema, same type
identity) — typically because validation failed and the same step is
re-pausing — the client:

- Keeps the existing `FormDef` and `formData` (no remount, no
  blanking).
- Updates `errors` to the new error map.
- Bumps `formKey` only when the schema _actually changes_.

User-typed values stay put. Only the errors flip.

This is invisible to step authors — just `throw wf.requireInput({...})`
and the client handles it.

## Composable-driven control

When you want to interleave action handling and input validation
explicitly (without the `@WfInput` policy matrix), call
`useAtscriptWf()` directly:

```ts
import { useAtscriptWf } from "@atscript/moost-wf";
import { LoginForm } from "./LoginForm.as";

@Step("login-credentials")
async enterCredentials(@WorkflowParam("context") ctx: LoginCtx) {
  const wf = useAtscriptWf(LoginForm);
  const action = wf.resolveAction();
  if (action === "forgot") {
    await this.sendPasswordReset();
    return;
  }
  const input = wf.resolveInput();
  // ... auth ...
}
```

The three helpers are pure and independent:

- `resolveInput(opts?)` — validates `state.input` and returns it
  typed; throws `StepRetriableError` on missing/invalid input.
- `resolveAction()` — returns the action name or `undefined`;
  throws `StepRetriableError` for unknown actions.
- `requireInput(opts?)` — builds the retriable error for custom
  branches.

`@WfInput()` is the same composable plus the action-vs-input policy
matrix from [Actions](/workflows/actions).

## Action validation differs

Form data sent with an _action_ (see [Actions](/workflows/actions))
validates with `partial: "deep"` — the framework only checks the
fields that are present, so a "save draft" action with half a form
filled in passes. Plain form submits validate the whole shape.

`@WfInput()` applies this policy automatically based on the action's
declaration (`@ui.form.action` vs `@wf.action.withData`); you don't
write a separate guard.

## Where to go next

- [Actions](/workflows/actions) — alt buttons that send the same
  form data + an action name.
- [Context Passing](/workflows/context) — making server context
  available to the rendered form (e.g. `ctx.email` in the page
  title).
- [Forms / Validation](/forms/validation) — the underlying client
  validation model that surfaces these errors.
