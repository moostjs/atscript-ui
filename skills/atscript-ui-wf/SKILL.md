---
name: atscript-ui-wf
description: >-
  Build HTTP round-trip multi-step workflow forms with `@atscript/vue-wf` (client)
  + `@atscript/moost-wf` (server). Use when working with `<AsWfForm>` or
  `useWfForm` on the client; when declaring server flows via `@Workflow` /
  `@Step` / `@WorkflowSchema` / `@WfInput` / `@WfAction` on top of
  `@moostjs/event-wf`; when calling `useAtscriptWf(Type)` /
  `useWfActionSlot` composables inside step handlers; when serializing forms via
  `serializeFormSchema` / `extractPassContext`; when passing context across
  steps via `@wf.context.pass`; when implementing action-with-data via
  `@wf.action.withData`; when persisting workflow state via `AsWfStore` +
  `@wf.store.fromContext` shadow columns (with `cleanup` / `heal` /
  `getAndDelete`); when implementing outlets (email magic link, webhook) with
  resume via `initialToken` (body / cookie / query transport); when emitting a
  unified `WfFinished` envelope via `finishWf(opts)` or `abortWf(reason, opts)`
  (auto-redirect with countdown, manual choice, dismiss, aborted soft-failure);
  when overriding the `<AsWfFinish>` slots (`wf.finish.message` /
  `wf.finish.countdown` / `wf.finish.skip` / `wf.finish.primary` /
  `wf.finish.option`), wiring the `navigate` prop to your router, or
  hooking `@dismiss` / `@action`;
  or when debugging the wire envelope. Out of scope: plain forms (use
  `atscript-ui-forms`), tables (use `atscript-ui-tables`), styling.
---

# atscript-ui-wf

## Install

```bash
npx skills add moostjs/atscript-ui      # installs all atscript-ui skills (this one + general + forms + tables + styles)
npx skills add moostjs/atscript         # sibling — .as language
npx skills add moostjs/moostjs          # sibling — Moost framework (decorators, interceptors)
npx skills add wooksjs/wooksjs          # sibling — underlying @moostjs/event-wf engine + outlets
npx skills add moostjs/atscript-db      # sibling — needed only if persisting state via AsWfStore
```

```bash
# Client
pnpm add @atscript/core @atscript/typescript @atscript/ui @atscript/vue-form @atscript/vue-wf vue

# Server
pnpm add @atscript/moost-wf moost @moostjs/event-http @moostjs/event-wf @prostojs/wf
pnpm add @atscript/db @atscript/db-sqlite        # only if persisting via AsWfStore
```

## Quick start

```atscript
// src/wf/forms.as
export interface HelloName {
    @meta.label 'Your name'
    @meta.required 'Name is required'
    name: string
}
```

```ts
// src/wf/hello.workflow.ts
import { Controller } from "moost";
import { Workflow, Step, WorkflowParam, WorkflowSchema, useWfFinished } from "@moostjs/event-wf";
import { WfInput } from "@atscript/moost-wf";
import { HelloName } from "./forms.as";

interface Ctx {
  name?: string;
}

@Controller()
export class HelloWorkflow {
  @Workflow("hello")
  @WorkflowSchema<Ctx>([{ id: "ask" }, { id: "greet" }])
  flow() {}

  // @WfInput() validates against the schema and throws a StepRetriableError
  // (caught natively by the wf engine) when input is missing or invalid —
  // the handler body only runs with valid input.
  @Step("ask")
  async ask(@WfInput() input: HelloName, @WorkflowParam("context") ctx: Ctx) {
    ctx.name = input.name;
  }

  @Step("greet")
  greet(@WorkflowParam("context") ctx: Ctx) {
    useWfFinished().set({ type: "data", value: { greeting: `Hello, ${ctx.name}!` } });
  }
}
```

```vue
<!-- src/views/HelloFlow.vue -->
<script setup lang="ts">
import { createDefaultTypes } from "@atscript/vue-form";
const types = createDefaultTypes();
function onFinished(r: { greeting: string }) {
  alert(r.greeting);
}
</script>

<template>
  <AsWfForm path="/wf/trigger" name="hello" :types="types" @finished="onFinished" />
</template>
```

## Wire protocol

```
Client → server:
  start          { wfid, input?, wfs? }
  submit         { wfs, input }
  action         { wfs, action }
  actionWithData { wfs, action, input }

Server → client:
  next-step      { inputRequired: { payload, transport: 'http', context }, wfs }
  finished       { finished: true, ...response }
  outlet pause   { sent: true } | { outlet: '<name>' }
  error          { error: { message, status? } }

Token transports: 'body' (default), 'cookie', 'query' (?wfs=...).
```

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`@WfInput()` validates inbound payloads against the schema.** Missing or invalid input throws `StepRetriableError` — the workflow engine catches it natively and re-pauses the step with the field errors. No global interceptor is required. Manual mid-handler revalidation: `throw useAtscriptWf(Type).requireInput({ errors: { field: 'msg' } })`. Standalone composable: `useAtscriptWf(type)` exposes `resolveInput()`, `resolveAction()`, and `requireInput()`.                                                                                                                                                                                                                                                                        |
| 2   | **Context is server-only by default.** Workflow `context` is a typed mutable per-flow object (typed via `@WorkflowSchema<Ctx>`). To expose keys to the client form annotate them on the FORM type with `@wf.context.pass 'key'`. `serializeFormSchema()` strips the annotation from the wire payload; `extractPassContext(type, ctx)` whitelists matching keys into `inputRequired.context`. Missing whitelist → empty context on the client.                                                                                                                                                                                                                                                                                                   |
| 3   | **`@wf.action.withData` validates with `deepPartial = true`.** Plain `@ui.form.action 'id'` actions take no input — `@WfInput()` rejects them unless declared with `pass: true` (the step opts into handling the no-data action). With-data actions receive partial form data — present fields validated, missing fields OK.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4   | **Same-form re-validation preserves user input.** The client compares the serialized `payload` identity between successive responses; same type back → render errors without remounting the form. `formKey` (the remount counter) increments only when the payload changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5   | **Outlet pause is "finished" from the HTTP perspective.** Server returns `{ sent: true }` or `{ outlet: '<name>' }` → client fires `@finished`. Actual resume happens out-of-band (email link click → URL with `?wfs=<token>` → mount `<AsWfForm initialToken="...">`). No client-side polling.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 6   | **`AsWfStore` is single-use on resume.** `getAndDelete(handle)` is race-safe — the row is deleted atomically when the resume succeeds. Don't call `get()` then `delete()` separately; use `getAndDelete`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 7   | **Shadow columns require `string \| number \| boolean`.** `@wf.store.fromContext 'path.in.context'` copies the value at every `set()`. Optional fields → `null` on path miss; required fields without DB defaults → insert may fail. Type mismatches log once per field per store instance, write `null`, continue. Run `store.heal()` after schema or path changes.                                                                                                                                                                                                                                                                                                                                                                            |
| 8   | **`@atscript/moost-wf/store` is ESM-only.** Triggered by any import of `@atscript/moost-wf/store` (runtime class) or `@atscript/moost-wf/store.as` (atscript model). Fix: set `"type": "module"` in the consumer's `package.json` and bundle ESM. CJS consumers must drop `AsWfStore` and use the in-memory store from `@moostjs/event-wf`.                                                                                                                                                                                                                                                                                                                                                                                                     |
| 9   | **Token transport survives reloads only if persistent.** `body` transport (default) is lost on reload. `cookie` survives until expiry. `query` (`?wfs=token`) is URL-shareable and single-use. Pick the transport that matches your resume story.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 10  | **HTTP outlet wraps `inputRequired` — conditionally.** Mount `createAsHttpOutlet()` from `@atscript/moost-wf` (not bare `createHttpOutlet`) in `handleAsOutletRequest`. It wraps generic form payloads in `{ inputRequired: { payload, transport: 'http', context } }` so `<AsWfForm>` decodes them. **Pass-through:** payloads already carrying a root-level routing key — `finished`, `sent`, `outlet`, `error` — flow through at the response root (merged with `context` if any), so `outletHttp({ outlet: 'awaiting-payment' })` and `outletHttp({ error: { message } })` keep working without a separate outlet. Bare `createHttpOutlet` flattens everything and crashes `<AsWfForm>` on form payloads with "Unexpected response format". |
| 11  | **Finished-response wrap.** Use `handleAsOutletRequest` from `@atscript/moost-wf` (not bare `handleWfOutletRequest` from `@moostjs/event-wf`) as your trigger. It wraps the `useWfFinished({ value })` unwrap so the response carries the `finished: true` marker `<AsWfForm>` requires. Pass-through for non-object responses (redirects, primitives), arrays, and already-marked envelopes (`inputRequired` / `finished` / `error` / `sent` / `outlet`). Step handlers return their domain data via `useWfFinished().set({ value: { ok: true, ... } })` — never embed `finished: true` inside `value`.                                                                                                                                        |
| 12  | **Use `WfFinished` envelope helpers — not raw `useWfFinished`.** `@atscript/moost-wf` ships two helpers: `finishWf(opts?)` and `abortWf(reason, opts?)`. The shared `FinishWfOpts` bag carries `{ data?, message?, next? }`; `abortWf` adds `aborted: true` + `reason`. The `next` field is the `WfNext` discriminated union (`{ trigger: 'immediate' \| 'auto' \| 'manual', ... }`) — the same shape rendered by `<AsWfFinish>`. Reach for raw `useWfFinished().set({ type: 'data', value: envelope, cookies })` only when you need to set response cookies alongside the envelope — cookies are an HTTP-level concern the helpers don't expose. See [finish-screens](references/finish-screens.md).                                           |

## Key imports

```ts
// Client
import { AsWfForm, useWfForm } from "@atscript/vue-wf";
import type { UseWfFormOptions, UseWfFormReturn } from "@atscript/vue-wf";

// Server — decorators, composables, helpers (full public surface of @atscript/moost-wf)
import {
  WfInput,
  WfAction,
  useAtscriptWf,
  useWfActionSlot,
  serializeFormSchema,
  extractPassContext,
  getFormActions,
  createAsHttpOutlet,
  handleAsOutletRequest,
  // WfFinished envelope helpers
  finishWf,
  abortWf,
  isWfFinished,
} from "@atscript/moost-wf";
import type {
  FinishWfOpts,
  WfFinished,
  WfMessage,
  WfNext,
  WfButton,
  WfActionRequest,
} from "@atscript/moost-wf";

// Server — atscript build-time plugin (in atscript.config.ts)
import wfPlugin from "@atscript/moost-wf/plugin"; // default export — registers @wf.context.pass, @wf.action.withData, @wf.store.fromContext

// Server — persistent state store
import { AsWfStore, AsWfStateRecord } from "@atscript/moost-wf/store";

// Moost framework — @Controller, Resolve, Intercept, useControllerContext live here
import { Controller, Resolve, Intercept } from "moost";

// Workflow engine — @Workflow, @Step, @WorkflowSchema, @WorkflowParam, useWfFinished,
// useWfState, useWfOutlet, outletEmail, outletHttp, StepRetriableError, etc. all live here
import {
  Workflow,
  Step,
  WorkflowParam,
  WorkflowSchema,
  StepTTL,
  useWfFinished,
  useWfState,
  useWfOutlet,
  outlet,
  outletEmail,
  outletHttp,
} from "@moostjs/event-wf";
import { StepRetriableError } from "@wooksjs/event-wf";
```

## References — load only what's needed

| Domain            | File                                                | When                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First contact     | [getting-started.md](references/getting-started.md) | Install matrix, two-step "hello" flow end-to-end, minimal client mount                                                                                                                                                                                                                                                                                 |
| Server authoring  | [server.md](references/server.md)                   | `@Workflow` / `@Step` / `@WorkflowSchema` from `@moostjs/event-wf` (linear vs branched), `@WorkflowParam`, `@WfInput()` auto-validation, `useAtscriptWf().requireInput()` pause signal, `useWfFinished`, conditional steps, action handlers (`@WfAction`), error mapping                                                                               |
| Context           | [context.md](references/context.md)                 | The workflow context object, mutation across steps, `@wf.context.pass` whitelist, `extractPassContext`, consuming `formContext` on the client, dynamic step titles via `@ui.form.fn.title` (cross-link to atscript-ui-forms dynamic-fields)                                                                                                            |
| State persistence | [state.md](references/state.md)                     | `AsWfStore({ table, clock?, actor? })` wiring, `AsWfStateRecord` base schema + extension with `@meta.id`, `@wf.store.fromContext` shadow columns (uses, limits, race-safe `getAndDelete`), `cleanup(retention?)`, `heal(options?)` backfill, CJS limitation                                                                                            |
| Outlets / resume  | [outlets.md](references/outlets.md)                 | Outlet semantics (`{ sent: true }`, `{ outlet: '<name>' }`), email magic-link pattern with `?wfs=token` resume, webhook resume, token transports (`body` / `cookie` / `query`) — when to pick which, `initialToken` prop                                                                                                                               |
| Client            | [client.md](references/client.md)                   | `<AsWfForm>` props/emits/slots (`@finished`, `@error`, `@form`, `@submit`, `@loading`; slots `#wf.loading` — default is an `as-form-overlay` icon on a `min-h-[100px]` wrapper, `#wf.error`, `#wf.finished`, `#form.*`), `useWfForm(options)` composable (`start` / `submit` / `action` / `actionWithData` / `retry`), custom `fetch` for auth headers |
| Finish screens    | [finish-screens.md](references/finish-screens.md)   | `WfFinished` envelope, `finishWf(opts)` / `abortWf(reason, opts)` helpers, `AsWfFinish` trigger rendering (`immediate` / `auto` / `manual`), `wf.finish.*` scoped-slot contract with `trigger` callbacks, `navigate` prop (matches `@atscript/db-client`'s `Client({ navigate })`), `@dismiss` / `@action` events                                      |

## Customization

Workflow forms ride on top of `<AsForm>`, so the bulk of UI customization happens through the forms skill. The wf-specific surfaces:

- **Tier 1** — `<AsWfForm>` and `<AsWfFinish>` are the integration surface. Use `useWfForm(options)` for a fully custom shell.
- **Tier 2** — the finish slots (`wf.finish.*`) and the embedded `<AsForm>` defaults. The form's `:types` and `:components` propagate through `<AsWfForm>` straight to the form it renders.
- **Server-side outlets** — swap the transport (email magic link, webhook, awaiting payment, …) by mounting different outlet helpers; see [outlets.md](references/outlets.md).

### Propagate form customization through `<AsWfForm>`

The `:types` and `:components` props on `<AsWfForm>` are passed straight through to the underlying `<AsForm>`. Customize the same way you would a plain form:

```vue
<script setup lang="ts">
import { createDefaultTypes } from "@atscript/vue-form";
import MyTextInput from "./MyTextInput.vue";
import CountryPicker from "./CountryPicker.vue";

const types = { ...createDefaultTypes(), text: MyTextInput };
const components = { "country-picker": CountryPicker };
</script>

<template>
  <AsWfForm path="/wf/trigger" name="signup" :types="types" :components="components" />
</template>
```

See [atscript-ui-forms](../atscript-ui-forms/SKILL.md) for the full `:types` / `:components` / `AsFieldShell` swap mechanics.

### Customize finish + abort screens

`<AsWfForm>` renders `<AsWfFinish>` once the server emits a `WfFinished` envelope. Override message, primary CTA, countdown, dismiss button, or any per-option button via the `wf.finish.*` scoped slots. The server side ships envelopes via `finishWf({ ... })` or `abortWf(reason, { ... })`; see [finish-screens.md](references/finish-screens.md) for the slot contract and `WfNext` discriminated union.

### Swap outlets (server-side)

Outlets are mounted on the server controller. Replace the default `createAsHttpOutlet()` or add a custom outlet (`outletEmail`, `outletHttp`, your own) to change how the workflow pauses; clients reach the resume URL with `<AsWfForm :initial-token="...">`. See [outlets.md](references/outlets.md).

### Auth + custom fetch

Pass a `fetch` prop on `<AsWfForm>` to inject auth headers, cookies, or routing — the same way the table side accepts a `clientFactory`. The composable form is `useWfForm({ fetch, ... })`.

### Style consequence

The form chrome inside `<AsWfForm>` is plain `<AsForm>`, so styles tree-shake the same way: replace a default field component and its `as-*` shortcuts drop. The finish screen's `as-wf-finish-*` shortcuts stay reachable as long as you use the default `<AsWfFinish>` rendering. See `atscript-ui-styles` for the per-domain shortcut groups (`wfShortcuts`).

## See also

Reference docs: https://ui.atscript.dev/workflows/. Source: https://github.com/moostjs/atscript-ui.
