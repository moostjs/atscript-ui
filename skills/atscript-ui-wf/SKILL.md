---
name: atscript-ui-wf
description: >-
  Build HTTP round-trip multi-step workflow forms with `@atscript/vue-wf` (client)
  + `@atscript/moost-wf` (server). Use when working with `<AsWfForm>` or
  `useWfForm` on the client; when declaring server flows via `@Workflow` /
  `@Step` / `@WorkflowSchema` / `@FormInput` / `@AltAction` on top of
  `@moostjs/event-wf`; when wiring `formInputInterceptor()` globally in the Moost app; when using
  `useFormInput` / `useWfAction` composables inside step handlers; when
  serializing forms via `serializeFormSchema` / `extractPassContext`; when
  passing context across steps via `@wf.context.pass`; when implementing
  action-with-data via `@wf.action.withData`; when persisting workflow state
  via `AsWfStore` + `@wf.store.fromContext` shadow columns (with `cleanup` /
  `heal` / `getAndDelete`); when implementing outlets (email magic link,
  webhook) with resume via `initialToken` (body / cookie / query transport);
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
import { FormInput, type TFormInput } from "@atscript/moost-wf";
import { HelloName } from "./forms.as";

interface Ctx {
  name?: string;
}

@Controller()
export class HelloWorkflow {
  @Workflow("hello")
  @WorkflowSchema<Ctx>([{ id: "ask" }, { id: "greet" }])
  flow() {}

  // @FormInput() injects { data(), requireInput(errors?) } and adds an auto-validation
  // interceptor that pauses the workflow with the serialized form schema when input is
  // missing or invalid — the handler body never runs until input is present and valid.
  @Step("ask")
  async ask(@FormInput() form: TFormInput<typeof HelloName>, @WorkflowParam("context") ctx: Ctx) {
    const input = form.data() as { name: string };
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
| 1   | **Mount `formInputInterceptor()` globally.** It catches `FormInputRequired` thrown by step handlers (via `form.requireInput()` from `useFormInput` / `@FormInput()`) and converts to the outlet response shape. Without it the protocol breaks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2   | **`@FormInput()` injects `TFormInput<T>` with auto-validation.** The decorator pairs `Resolve` (inject `{ data(), requireInput() }`) + `Intercept` (validate before handler runs). On validation failure the interceptor auto-pauses with the field errors — the handler body never runs until input is present and valid. Manual mid-handler revalidation: `throw form.requireInput({ field: 'msg' })`. Standalone composable: `useFormInput(type)` returns the same shape.                                                                                                                                                                                                                                                                    |
| 3   | **Context is server-only by default.** Workflow `context` is a typed mutable per-flow object (typed via `@WorkflowSchema<Ctx>`). To expose keys to the client form annotate them on the FORM type with `@wf.context.pass 'key'`. `serializeFormSchema()` strips the annotation from the wire payload; `extractPassContext(type, ctx)` whitelists matching keys into `inputRequired.context`. Missing whitelist → empty context on the client.                                                                                                                                                                                                                                                                                                   |
| 4   | **`@wf.action.withData` validates with `deepPartial = true`.** Plain `@ui.form.action 'id'` actions take no input. With-data actions receive partial form data — server-side full validation must run again before advancing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 5   | **Same-form re-validation preserves user input.** The client compares the serialized `payload` identity between successive responses; same type back → render errors without remounting the form. `formKey` (the remount counter) increments only when the payload changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6   | **Outlet pause is "finished" from the HTTP perspective.** Server returns `{ sent: true }` or `{ outlet: '<name>' }` → client fires `@finished`. Actual resume happens out-of-band (email link click → URL with `?wfs=<token>` → mount `<AsWfForm initialToken="...">`). No client-side polling.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 7   | **`AsWfStore` is single-use on resume.** `getAndDelete(handle)` is race-safe — the row is deleted atomically when the resume succeeds. Don't call `get()` then `delete()` separately; use `getAndDelete`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 8   | **Shadow columns require `string \| number \| boolean`.** `@wf.store.fromContext 'path.in.context'` copies the value at every `set()`. Optional fields → `null` on path miss; required fields without DB defaults → insert may fail. Type mismatches log once per field per store instance, write `null`, continue. Run `store.heal()` after schema or path changes.                                                                                                                                                                                                                                                                                                                                                                            |
| 9   | **`@atscript/moost-wf/store` is ESM-only.** Triggered by any import of `@atscript/moost-wf/store` (runtime class) or `@atscript/moost-wf/store.as` (atscript model). Fix: set `"type": "module"` in the consumer's `package.json` and bundle ESM. CJS consumers must drop `AsWfStore` and use the in-memory store from `@moostjs/event-wf`.                                                                                                                                                                                                                                                                                                                                                                                                     |
| 10  | **Token transport survives reloads only if persistent.** `body` transport (default) is lost on reload. `cookie` survives until expiry. `query` (`?wfs=token`) is URL-shareable and single-use. Pick the transport that matches your resume story.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 11  | **HTTP outlet wraps `inputRequired` — conditionally.** Mount `createAsHttpOutlet()` from `@atscript/moost-wf` (not bare `createHttpOutlet`) in `handleAsOutletRequest`. It wraps generic form payloads in `{ inputRequired: { payload, transport: 'http', context } }` so `<AsWfForm>` decodes them. **Pass-through:** payloads already carrying a root-level routing key — `finished`, `sent`, `outlet`, `error` — flow through at the response root (merged with `context` if any), so `outletHttp({ outlet: 'awaiting-payment' })` and `outletHttp({ error: { message } })` keep working without a separate outlet. Bare `createHttpOutlet` flattens everything and crashes `<AsWfForm>` on form payloads with "Unexpected response format". |
| 12  | **Finished-response wrap.** Use `handleAsOutletRequest` from `@atscript/moost-wf` (not bare `handleWfOutletRequest` from `@moostjs/event-wf`) as your trigger. It wraps the `useWfFinished({ value })` unwrap (wooks `index.mjs:198`) so the response carries the `finished: true` marker `<AsWfForm>` requires. Pass-through for non-object responses (redirects, primitives), arrays, and already-marked envelopes (`inputRequired` / `finished` / `error` / `sent` / `outlet`). Step handlers return their domain data via `useWfFinished().set({ value: { ok: true, ... } })` — never embed `finished: true` inside `value`.                                                                                                                |

## Key imports

```ts
// Client
import { AsWfForm, useWfForm } from "@atscript/vue-wf";
import type { UseWfFormOptions, UseWfFormReturn } from "@atscript/vue-wf";

// Server — decorators + helpers (full public surface of @atscript/moost-wf)
import {
  FormInput,
  AltAction,
  FormInputRequired,
  formInputInterceptor,
  serializeFormSchema,
  extractPassContext,
  getFormActions,
  useFormInput,
  useWfAction,
  createAsHttpOutlet,
  handleAsOutletRequest,
} from "@atscript/moost-wf";
import type { TFormInput } from "@atscript/moost-wf";

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
```

## References — load only what's needed

| Domain            | File                                                | When                                                                                                                                                                                                                                                                                                   |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First contact     | [getting-started.md](references/getting-started.md) | Install matrix, two-step "hello" flow end-to-end, `formInputInterceptor()` global wiring, minimal client mount                                                                                                                                                                                         |
| Server authoring  | [server.md](references/server.md)                   | `@Workflow` / `@Step` / `@WorkflowSchema` from `@moostjs/event-wf` (linear vs branched), `@WorkflowParam`, `@FormInput()` auto-validation, `form.requireInput()` pause signal, `useWfFinished`, conditional steps, action handlers (`@AltAction`), error mapping, `useFormInput` mid-step revalidation |
| Context           | [context.md](references/context.md)                 | The workflow context object, mutation across steps, `@wf.context.pass` whitelist, `extractPassContext`, consuming `formContext` on the client, dynamic step titles via `@ui.form.fn.title` (cross-link to atscript-ui-forms dynamic-fields)                                                            |
| State persistence | [state.md](references/state.md)                     | `AsWfStore({ table, clock?, actor? })` wiring, `AsWfStateRecord` base schema + extension with `@meta.id`, `@wf.store.fromContext` shadow columns (uses, limits, race-safe `getAndDelete`), `cleanup(retention?)`, `heal(options?)` backfill, CJS limitation                                            |
| Outlets / resume  | [outlets.md](references/outlets.md)                 | Outlet semantics (`{ sent: true }`, `{ outlet: '<name>' }`), email magic-link pattern with `?wfs=token` resume, webhook resume, token transports (`body` / `cookie` / `query`) — when to pick which, `initialToken` prop                                                                               |
| Client            | [client.md](references/client.md)                   | `<AsWfForm>` props/emits/slots (`@finished`, `@error`, `@form`, `@submit`, `@loading`; slots `#wf.loading`, `#wf.error`, `#wf.finished`, `#form.*`), `useWfForm(options)` composable (`start` / `submit` / `action` / `actionWithData` / `retry`), custom `fetch` for auth headers                     |

## See also

Reference docs: https://ui.atscript.dev/workflows/. Source: https://github.com/moostjs/atscript-ui.
