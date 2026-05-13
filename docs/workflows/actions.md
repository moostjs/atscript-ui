---
outline: deep
---

# Actions

A workflow form's submit button advances the flow. **Actions** are
the other buttons next to it — _resend code_, _save draft_, _use
backup method_, _forgot password_. Each one posts back to the same
step with an `action` name, optionally with form data.

## The two action kinds

| Kind             | Annotation                   | Sends data?                  | Server reads via                             |
| ---------------- | ---------------------------- | ---------------------------- | -------------------------------------------- |
| Plain action     | `@ui.form.action 'name'`     | No                           | `@AltAction()` param                         |
| Action with data | `@wf.action.withData 'name'` | Yes (deep-partial validated) | `@AltAction()` param + `@FormInput()` data() |

Both render as buttons in the rendered form's action row. Both let
the step keep the user on the same screen, re-render the same form,
finish the flow, or do something arbitrary.

## Declaring actions on the form

Actions are declared as fields on the form type, with the action
annotation:

```atscript
@meta.label 'Verify Identity'
@ui.form.submit.text 'Verify Code'
export interface MfaPincodeForm {
    @meta.label 'Verification Code'
    @ui.form.placeholder '000000'
    @meta.required 'Code is required'
    @expect.minLength 6, '6 digits expected'
    @expect.maxLength 6, '6 digits expected'
    code: string

    // Plain action — no form data.
    @ui.form.action 'resend'
    @meta.label 'Resend Code'
    _resend?: boolean

    // Action with data — sends current form fields with deep-partial validation.
    @wf.action.withData 'saveDraft'
    @meta.label 'Save Draft'
    _saveDraft?: boolean
}
```

The field itself is a placeholder — the runtime never stores a value
on it. It only carries the annotation and the label. Use a leading
underscore name to make the intent clear, and make it optional so it
doesn't fail required-field validation.

The form renderer reads these annotations and emits one button per
action next to the submit button.

## Reading the action on the server

Two ways, mirroring how you read input:

### Manual: query the param

You can pull the action out of the request yourself, but the
preferred path is the decorator:

### Decorator: `@AltAction()`

```ts
import { FormInput, AltAction, type TFormInput } from "@atscript/moost-wf";
import { MfaPincodeForm } from "../forms/MfaPincodeForm.as";

@Step("login-verify-otp")
async verifyOtp(
  @FormInput() form: TFormInput<MfaPincodeForm>,
  @AltAction() action: string | undefined,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  if (action === "resend") {
    ctx.otpCode = String(Math.floor(100000 + Math.random() * 900000));
    await sendOtpEmail(ctx.email!, ctx.otpCode);
    // Re-pause the same form (no errors) so the user can re-enter the code.
    throw form.requireInput();
  }

  if (action === "saveDraft") {
    // Partial form data is available — save what we have and re-pause.
    const partial = form.data() ?? {};
    await drafts.save(ctx.userId!, partial);
    throw form.requireInput();
  }

  // No action → normal submit path.
  const input = form.data()!;
  if (input.code !== ctx.otpCode) {
    throw form.requireInput({ code: "Invalid code" });
  }
  return;
}
```

`@AltAction()` returns the action name string, or `undefined` for a
normal submit. The handler dispatches with a regular `switch` / `if`
chain.

## How validation differs per kind

The `@FormInput()` interceptor inspects the action before validating:

- **No action** (normal submit): full validation; missing required
  fields cause re-pause with errors.
- **`@ui.form.action`** (plain): handler runs regardless of input
  shape. The action is "fire-and-forget" — no form data needs to be
  valid. Useful for _resend code_, _forgot password_, _cancel_.
- **`@wf.action.withData`**: deep-partial validation. The
  framework only checks the fields actually present in the payload —
  missing fields are not "required-failing". Useful for _save draft_
  flows where the user might be halfway through.

If the action name is not declared on the form, the framework
re-pauses with a `__form` error `"Action "<name>" is not supported"`.

## Calling actions from the client

The client side mirrors the server: the rendered form has buttons
labeled with each action; clicking one fires the action via the
underlying composable.

### From the default `<AsWfForm>`

Nothing extra to wire — the component reads the form type's
annotations, classifies each action as plain vs with-data (based on
which annotation it carries), and POSTs the right body.

### From `useWfForm()` directly

```ts
import { useWfForm } from "@atscript/vue-wf";

const wf = useWfForm({ path: "/wf", name: "auth/login" });

// Plain action — no body besides token + action name.
wf.action("resend");

// Action with data — current form data, validated deep-partial server-side.
wf.actionWithData("saveDraft", currentFormData);
```

Bodies:

```http
POST /wf
{ "wfs": "<token>", "action": "resend" }
```

```http
POST /wf
{ "wfs": "<token>", "action": "saveDraft", "input": { "code": "123" } }
```

## Common patterns

### Resend a code

```ts
if (action === "resend") {
  ctx.otpCode = String(Math.floor(100000 + Math.random() * 900000));
  await sendOtp(ctx.email!, ctx.otpCode);
  throw form.requireInput(); // re-render same form, no errors
}
```

### Forgot password (jump to a different flow)

```ts
if (action === "forgotPassword") {
  // Finish the current flow with a "redirect" payload — let the client
  // mount a different workflow.
  useWfFinished().set({
    type: "data",
    value: { finished: true, redirect: "/recover" },
  });
  return;
}
```

### Switch verification method

```ts
if (action === "useBackup") {
  ctx.mfaMethod = "backup-codes";
  return; // advance — the schema's condition routes us to a different step
}
```

The action handler can do anything a normal step can — call
`useWfFinished()`, mutate context to flip a branch condition, or
re-pause the same form. The flow stays a flow.

## Where to go next

- [Form Input & Validation](/workflows/form-input) — `@FormInput()`
  and `requireInput()` patterns reused above.
- [Context Passing](/workflows/context) — how the form renderer
  reads context (e.g. to label the _resend_ button with the masked
  email).
- [Forms / Annotations](/forms/annotations) — the full annotation
  reference, including `@ui.form.action`.
