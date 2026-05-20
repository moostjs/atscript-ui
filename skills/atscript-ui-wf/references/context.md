# context

The workflow context object, `@wf.context.pass` whitelisting, and `formContext` consumption on the client.

## Contents

- [Workflow context object](#workflow-context-object)
- [@wf.context.pass annotation](#wfcontextpass-annotation)
- [serializeFormSchema strips @wf.context.pass](#serializeformschema-strips-wfcontextpass)
- [extractPassContext(type, wfContext)](#extractpasscontexttype-wfcontext)
- [Consuming context on the client](#consuming-context-on-the-client)
- [Recipe — dynamic step title from context](#recipe--dynamic-step-title-from-context)
- [Missing whitelist → empty context](#missing-whitelist--empty-context)

## Workflow context object

- Per-flow mutable object held by the workflow engine.
- Typed via the `@WorkflowSchema<Ctx>(...)` generic parameter.
- Injected into step handlers with `@WorkflowParam('context')`.
- Lives in `state.context` (see [state.md](state.md)) — persisted across pauses.

```typescript
interface LoginCtx {
  userId?: number;
  email?: string;
  mfaEnabled?: boolean;
}

@Workflow("auth/login")
@WorkflowSchema<LoginCtx>([{ id: "a" }, { id: "b" }])
flow() {}

@Step("a")
stepA(@WorkflowParam("context") ctx: LoginCtx) {
  ctx.userId = 42;        // mutation visible in subsequent steps
  ctx.email = "u@x.io";
}
```

Mutate `ctx` directly; the engine snapshots `state.context` whenever it pauses or finishes.

The context is **server-side state**. It is never sent to the client unless you explicitly whitelist keys.

## @wf.context.pass annotation

Whitelist a key from `wfContext` into `inputRequired.context` of the wire response.

**Applied to the FORM type** (interface or type), not to the context type itself.

```atscript
@wf.context.pass 'email'
@wf.context.pass 'mfaEnabled'
export interface MfaPincodeForm {
    @meta.label 'Verification code'
    code: string
}
```

Each annotation declares one key. The plugin spec `multiple: true, mergeStrategy: 'append'` (`packages/moost-wf/src/plugin.ts:31-46`) means multiple `@wf.context.pass` annotations stack to a list of keys.

Node restriction: `nodeType: ['interface', 'type']` — applies to the type root, not individual props.

### Why on the form, not the context

The form type is what the server serializes per step. Whitelisting on the form makes the contract explicit and per-step. The same `wfContext` produces different `formContext` payloads depending on which form the step renders.

## serializeFormSchema strips @wf.context.pass

```typescript
serializeFormSchema(type);
// → serializeAnnotatedType(type, { ignoreAnnotations: ['wf.context.pass'], refDepth: 0.5 })
```

`@wf.context.pass` is **server-only**. Stripping it from the wire payload prevents the client from learning the whitelist (which keys are _allowed_) — and there is no reason for the client to see it either. Source: `packages/moost-wf/src/form-input/serialize.ts:24-27`.

The annotation lives on the type's `metadata`, which `extractPassContext` reads at request time. The wire-serialized schema does not carry it.

## extractPassContext(type, wfContext)

```typescript
import { extractPassContext } from "@atscript/moost-wf";

const ctx = extractPassContext(type, wfState.ctx<Record<string, unknown>>());
// → { email: "u@x.io", mfaEnabled: true }   (only keys listed in @wf.context.pass)
```

Walks `type.metadata.get('wf.context.pass')`, then copies matching keys from `wfContext` into a fresh object. Missing keys are omitted (`packages/moost-wf/src/form-input/context.ts:19-32`).

Used inside `useAtscriptWf().requireInput()` and `@WfInput()` to build the response `context` field. You normally never call it directly unless writing a custom outlet helper.

## Consuming context on the client

The `inputRequired.context` payload arrives at the client and is exposed in two places:

### Via the slot

```vue
<AsWfForm path="/wf/trigger" name="auth/login" :types>
  <template #form.header="{ formContext }">
    <h2>Verify code sent to {{ formContext.email }}</h2>
  </template>
</AsWfForm>
```

The default slot props also include `formContext`:

```vue
<AsWfForm v-slot="{ form }" ...>
  <pre>{{ form.formContext }}</pre>
</AsWfForm>
```

### Via the composable

```typescript
const wf = useWfForm({ path: "/wf/trigger", name: "auth/login" });
// wf.formContext.value → Record<string, unknown>
```

`formContext` is a `ShallowRef<Record<string, unknown>>` (`packages/vue-wf/src/use-wf-form.ts:72`). Wholesale-replaced on every server response (the field map is the response's `context` with `errors` stripped — `errors` go to `wf.errors` separately, `packages/vue-wf/src/use-wf-form.ts:168-186`).

### Via @ui.form.fn.\* dynamic fields

The strongest pattern: drive form rendering from context inside the `.as` schema itself, with no template changes per step.

```atscript
@ui.form.fn.title '(data, ctx) => "Verify code sent to " + ctx.email'
@wf.context.pass 'email'
export interface MfaPincodeForm {
    @meta.label 'Code'
    code: string
}
```

The `@ui.form.fn.title` callback is form-level — it receives `(data, ctx)` where `data` is the form's current values and `ctx` is the form's `formContext`. See `atscript-ui-forms` skill's `dynamic-fields.md` for the full `@ui.form.fn.*` surface.

## Recipe — dynamic step title from context

End-to-end: server stamps email into ctx → client renders MFA form with the email in the title.

### Form schema

```atscript
@ui.form.fn.title '(data, ctx) => "Verify code sent to " + ctx.email'
@wf.context.pass 'email'
export interface MfaPincodeForm {
    @meta.label 'Verification code'
    @expect.minLength 6
    @expect.maxLength 6
    code: string
}
```

### Server step

```typescript
@Step("verify-otp")
verifyOtp(
  @WfInput() input: MfaPincodeForm,
  @WorkflowParam("context") ctx: LoginCtx,
) {
  // ctx.email was set in the previous step ('credentials')
  if (input.code !== ctx.otpCode) {
    throw useAtscriptWf(MfaPincodeForm).requireInput({
      errors: { code: "Invalid code" },
    });
  }
}
```

### Wire trace

```
Server → client:
  {
    inputRequired: {
      payload: <serialized MfaPincodeForm, with @wf.context.pass stripped>,
      transport: "http",
      context: { email: "u@x.io" }     // only whitelisted key
    },
    wfs: "<token>"
  }
```

The client's `AsForm` runs the `@ui.form.fn.title` callback with `(data, ctx)` where `ctx = { email: "u@x.io" }` and renders `"Verify code sent to u@x.io"` as the title.

### Why this works

- Server mutates `ctx.email` freely (no client visibility).
- Form schema names `email` in `@wf.context.pass` → server includes it.
- Schema names `email` in `@ui.form.fn.title` → client reads it.
- Single source of truth: the `.as` file dictates both the whitelist and the rendering.

## Missing whitelist → empty context

If the form type has no `@wf.context.pass` annotation, `extractPassContext` returns `{}` (`packages/moost-wf/src/form-input/context.ts:23`). The `inputRequired.context` arrives at the client as `{}` (or with only `errors` if validation failed).

A `@ui.form.fn.*` callback expecting `ctx.email` on a form without `@wf.context.pass 'email'` reads `undefined`. Validate by tracing the round-trip in DevTools' Network tab — the response's `inputRequired.context` is the canonical source.

Common misuse:

- Whitelisting on the _context_ type (no effect — annotation only fires on the form type).
- Forgetting `@wf.context.pass` when porting a form to a new flow — the title silently renders with `undefined`.
- Whitelisting a key that the server never set in `wfContext` — `extractPassContext` skips it (no error).
