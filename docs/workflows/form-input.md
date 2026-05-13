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
@Step("login-credentials")
async enterCredentials(
  @WorkflowParam("input") input: { username?: string; password?: string } | undefined,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  if (!input?.username || !input?.password) {
    return httpInputRequired(LoginForm, ctx);
  }
  // ... use input.username, input.password ...
}
```

You write the empty-input guard, you decide when to re-pause. No
automatic validation — the handler sees raw client data, type-asserted
to `T | undefined`.

### Decorator: `@FormInput()`

`@FormInput()` collapses the boilerplate into one parameter:

```ts
import { FormInput, type TFormInput } from "@atscript/moost-wf";

@Step("login-credentials")
async enterCredentials(
  @FormInput() form: TFormInput<LoginForm>,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  const input = form.data();
  // ... validated, fully-typed access ...
}
```

The decorator does three things:

1. **Auto-pause** on first call (no input yet) — returns the
   serialized schema to the client, the handler body never runs.
2. **Auto-validate** subsequent calls against the form type. Any
   `@expect.*`, `@meta.required`, `string.email`, custom
   `@ui.form.validate` rule baked into the type fires automatically.
3. **Inject `{ data(), requireInput(errors?) }`** so the handler can
   read the validated payload and re-pause with custom errors.

If validation fails, the framework re-pauses the workflow at the
same step with the field errors. The handler body is **not** called
— so by the time your code runs, the input is guaranteed valid for
that type's static constraints.

The `T` type parameter on `TFormInput<T>` is purely for IDE typing;
the runtime knows the type from the param metadata that the
`@FormInput()` decorator wires up.

## The `form` object

`TFormInput<T>` exposes two methods (see
`packages/moost-wf/src/form-input/use.ts`):

```ts
form.data<T>(): T | undefined        // the validated input, or undefined on first call
form.requireInput(errors?: Record<string, string>): FormInputRequired
```

- **`data()`** — returns the input the client posted, after
  validation. Same shape as `@WorkflowParam("input")`.
- **`requireInput(errors)`** — builds a `FormInputRequired` signal.
  **Throw** it (don't return) to re-pause the workflow with field
  errors visible:

```ts
@Step("login-credentials")
async enterCredentials(
  @FormInput() form: TFormInput<LoginForm>,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  const input = form.data()!;
  const user = await usersTable.findOne({ filter: { username: input.username } });
  if (!user || !verify(input.password, user.password)) {
    throw form.requireInput({ password: "Invalid username or password" });
  }
  ctx.userId = user.id;
  return;
}
```

For `requireInput` to round-trip into the response body, mount the
global interceptor (once):

```ts
import { formInputInterceptor } from "@atscript/moost-wf";

app.applyGlobalInterceptors(formInputInterceptor());
```

The interceptor catches the thrown signal and emits the
`inputRequired` outlet response. Steps that don't throw are
unaffected.

## Server-side validation errors

The same flow handles both kinds of errors uniformly:

| Error source                  | What the framework does                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Type-level (`@expect.*`, etc.)| `@FormInput()`'s `before` interceptor validates the input. On fail, re-pauses with field errors. |
| Business-level                | Handler calls `throw form.requireInput({ field: 'message' })`. Interceptor re-pauses.            |

Both produce the same wire response — `{ inputRequired: { payload,
transport, context: { errors: {...} } } }` — and the client renders
the same form with the new errors.

### Mid-handler validation: "email already taken"

A classic case the `.as` type can't express:

```ts
@Step("register-details")
async enterDetails(
  @FormInput() form: TFormInput<RegisterForm>,
  @WorkflowParam("context") ctx: RegisterCtx,
) {
  const input = form.data()!;

  const usernameTaken = await usersTable.findOne({ filter: { username: input.username } });
  if (usernameTaken) {
    throw form.requireInput({ username: "Username already taken" });
  }
  const emailTaken = await usersTable.findOne({ filter: { email: input.email } });
  if (emailTaken) {
    throw form.requireInput({ email: "Email already registered" });
  }

  // ... advance, hash password, etc. ...
}
```

Pass multiple errors in one map; they all light up at once on the
client:

```ts
throw form.requireInput({
  username: "Username already taken",
  email: "Email already registered",
});
```

### Form-level (cross-field) errors

The reserved key `__form` shows the error at the form's root, not
attached to any field:

```ts
throw form.requireInput({ __form: "Account is suspended" });
```

The client's default form renders `__form` errors at the top of the
form chrome (see [Forms / Validation](/forms/validation)).

## Same-form detection: preserving user input

The client tracks the serialized payload of the last-received form.
When the server returns the **same** form (same schema, same type
identity) — typically because validation failed and the same step is
re-pausing — the client:

- Keeps the existing `FormDef` and `formData` (no remount, no
  blanking).
- Updates `errors` to the new error map.
- Bumps `formKey` only when the schema *actually changes*.

User-typed values stay put. Only the errors flip.

This is invisible to step authors — just `throw form.requireInput({...})`
and the client handles it.

Reference: `processResponse` in
`packages/vue-wf/src/use-wf-form.ts:128-188`.

## Standalone `useFormInput()` composable

If you need the same helper outside a `@FormInput()` decorator (say,
inside a sub-helper called from a step):

```ts
import { useFormInput } from "@atscript/moost-wf";
import { LoginForm } from "../forms/LoginForm.as";

function rejectInvalidPassword() {
  const { requireInput } = useFormInput(LoginForm);
  throw requireInput({ password: "Invalid credentials" });
}
```

Pass the atscript type so the composable knows what schema to
serialize back to the client. When called from inside a
`@FormInput()` decorator the type is auto-injected, so the explicit
arg is optional in that case.

## Action validation differs

Form data sent with an *action* (see [Actions](/workflows/actions))
validates with `partial: "deep"` — the framework only checks the
fields that are present, so a "save draft" action with half a form
filled in passes. Plain form submits validate the whole shape.

This is handled inside the interceptor; you don't write a separate
guard.

## Where to go next

- [Actions](/workflows/actions) — alt buttons that send the same
  form data + an action name.
- [Context Passing](/workflows/context) — making server context
  available to the rendered form (e.g. `ctx.email` in the page
  title).
- [Forms / Validation](/forms/validation) — the underlying client
  validation model that surfaces these errors.
