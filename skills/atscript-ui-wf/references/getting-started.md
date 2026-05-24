# getting-started

Install matrix, end-to-end hello flow, atscript config, minimal client mount.

## Contents

- [Install matrix](#install-matrix)
- [Two-step hello flow end-to-end](#two-step-hello-flow-end-to-end)
- [atscript.config.ts](#atscriptconfigts)
- [Vite config note (server)](#vite-config-note-server)
- [Client mount minimum](#client-mount-minimum)
- [Reading list](#reading-list)

## Install matrix

| Scenario                                              | Packages                                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Client only** (forms-only flows, separate backend)  | `vue`, `@atscript/core`, `@atscript/typescript`, `@atscript/ui`, `@atscript/vue-form`, `@atscript/vue-wf`                                                    |
| **Server only** (HTTP service, no Vue)                | `moost`, `@moostjs/event-http`, `@moostjs/event-wf`, `@prostojs/wf`, `@atscript/core`, `@atscript/typescript`, `@atscript/moost-wf`                          |
| **Server + persistence** (multi-tenant durable state) | add `@atscript/db` and one adapter (`@atscript/db-sqlite` / `@atscript/db-postgres` / `@atscript/db-mysql` / `@atscript/db-mongo`) — see `atscript-db` skill |
| **Both ends**                                         | union of the above                                                                                                                                           |

```bash
# Client
pnpm add @atscript/core @atscript/typescript @atscript/ui @atscript/vue-form @atscript/vue-wf vue

# Server (HTTP trigger)
pnpm add moost @moostjs/event-http @moostjs/event-wf @prostojs/wf @atscript/moost-wf
pnpm add -D @atscript/core @atscript/typescript unplugin-atscript

# Optional: persistence
pnpm add @atscript/db @atscript/db-sqlite better-sqlite3
```

`@atscript/moost-wf` peers: `@atscript/core`, `@atscript/typescript`, `@moostjs/event-wf`, `moost`.

## Two-step hello flow end-to-end

Authoring order: form `.as` → controller → app bootstrap → client.

### 1. Form type

```atscript
// src/wf/forms.as
export interface HelloName {
    @meta.label 'Your name'
    @meta.required 'Name is required'
    name: string
}
```

### 2. Controller

```typescript
// src/wf/hello.workflow.ts
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { WfInput, finishWf } from "@atscript/moost-wf";
import { HelloName } from "./forms.as";

interface Ctx {
  name?: string;
}

@Controller()
export class HelloWorkflow {
  @Workflow("hello")
  @WorkflowSchema<Ctx>([{ id: "ask" }, { id: "greet" }])
  flow() {}

  @Step("ask")
  ask(@WfInput() input: HelloName, @WorkflowParam("context") ctx: Ctx) {
    // @WfInput() validates against the schema; the body only runs with valid input.
    // Missing/invalid input throws StepRetriableError — the engine re-pauses the step.
    ctx.name = input.name;
  }

  @Step("greet")
  greet(@WorkflowParam("context") ctx: Ctx) {
    finishWf({ data: { greeting: `Hello, ${ctx.name}!` } });
  }
}
```

Key shapes:

- `Workflow`, `Step`, `WorkflowSchema`, `WorkflowParam` come from **`@moostjs/event-wf`**, not from `moost`. Only `@Controller()` comes from `moost`.
- `WfInput`, `WfAction`, `useAtscriptWf`, `finishWf`, `abortWf`, `serializeFormSchema`, `extractPassContext`, `createAsHttpOutlet`, `handleAsOutletRequest` come from **`@atscript/moost-wf`**.

### 3. App bootstrap

```typescript
// src/server.ts
import { Moost } from "moost";
import { MoostHttp } from "@moostjs/event-http";
import { MoostWf } from "@moostjs/event-wf";
import { HelloWorkflow } from "./wf/hello.workflow";

const app = new Moost();

app.adapter(new MoostHttp()).adapter(new MoostWf());
await app.registerControllers(HelloWorkflow).init();
```

`StepRetriableError` thrown by `@WfInput()` or
`useAtscriptWf().requireInput()` is caught natively by the workflow
engine and turned into the `inputRequired` outlet response — no
global interceptor mount is required.

### 4. HTTP trigger

Expose `POST /wf/trigger` that forwards the request body to the workflow engine (start by `wfid`, resume by `wfs`). Register `createAsHttpOutlet()` in the outlet list so `outletHttp(...)` returns the `inputRequired` envelope `<AsWfForm>` expects, and use `handleAsOutletRequest` as the trigger so the envelope `finishWf(...)` writes reaches the client with the `finished: true` marker `<AsWfForm>` routes on:

```typescript
import { EncapsulatedStateStrategy } from "@moostjs/event-wf";
import { createAsHttpOutlet, handleAsOutletRequest } from "@atscript/moost-wf";

// inside the @Post('wf/trigger') handler:
return handleAsOutletRequest(
  {
    allow: ["hello"],
    state: () => new EncapsulatedStateStrategy({ secret: WF_SECRET }),
    outlets: [createAsHttpOutlet()],
    token: { read: ["body"], write: "body", name: "wfs" },
  },
  deps,
);
```

See `outlets.md` for the bare-`createHttpOutlet` + `handleWfOutletRequest` alternative and SKILL.md invariants 11 + 12.

### 5. Client mount

```vue
<!-- src/views/HelloFlow.vue -->
<script setup lang="ts">
import { AsWfForm } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";

const types = createDefaultTypes();

function onFinished(r: unknown) {
  alert((r as { greeting: string }).greeting);
}
</script>

<template>
  <AsWfForm path="/wf/trigger" name="hello" :types @finished="onFinished" />
</template>
```

That's the full loop: client posts `{ wfid: 'hello' }` → step `ask` returns `inputRequired` → client renders `HelloName` form → user submits → step `ask` advances → step `greet` finishes → client fires `@finished`.

## atscript.config.ts

Register `wfPlugin()` so `@wf.*` annotations resolve at compile time. Without it, `@wf.context.pass`, `@wf.action.withData`, and `@wf.store.fromContext` are unknown to the validator and to generated types.

```typescript
// atscript.config.ts
import { defineConfig } from "@atscript/core";
import ts from "@atscript/typescript";
import wfPlugin from "@atscript/moost-wf/plugin";

export default defineConfig({
  rootDir: "src",
  plugins: [ts(), wfPlugin()],
  format: "dts",
});
```

If you also use `@atscript/db` (for `AsWfStore`), add `dbPlugin()` too — see `atscript-db` skill's `getting-started.md`.

`wfPlugin()` registers:

| Annotation                         | Node                 | Argument   | Notes                                                                 |
| ---------------------------------- | -------------------- | ---------- | --------------------------------------------------------------------- |
| `@wf.context.pass 'key'`           | `interface` / `type` | string key | `multiple: true`, `mergeStrategy: 'append'` — declare once per key    |
| `@wf.action.withData 'id'`         | `prop` / `type`      | action id  | partial-validation action                                             |
| `@wf.store.fromContext 'path.a.b'` | `prop`               | dot-path   | string/number/boolean fields only; must be optional or have a default |

## Vite config note (server)

`@atscript/moost-wf/store` ships ESM only. Triggered by any import of `@atscript/moost-wf/store` or `@atscript/moost-wf/store.as`. Fix: set `"type": "module"` in the server's `package.json` and bundle ESM (CJS consumers must drop `AsWfStore` and use the in-memory store from `@moostjs/event-wf`). See SKILL.md invariant 9.

For ESM Moost servers the standard `unplugin-atscript/vite` config from the atscript skill applies — no extra wiring needed for `moost-wf` itself.

## Client mount minimum

`<AsWfForm>` requires exactly three props: `path`, `name`, `types`. Everything else has a default.

```vue
<AsWfForm path="/wf/trigger" name="hello" :types />
```

See `client.md` for the full props/emits/slots reference.

## Reading list

| File                     | When                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| [server.md](server.md)   | authoring controllers, branching, action handlers, `@WfInput()` validation flow          |
| [context.md](context.md) | `@wf.context.pass` whitelist, `extractPassContext`, consuming `formContext`              |
| [state.md](state.md)     | `AsWfStore`, `@wf.store.fromContext` shadow columns, `cleanup` / `heal` / `getAndDelete` |
| [outlets.md](outlets.md) | outlet response shapes, magic-link / webhook resume, token transports                    |
| [client.md](client.md)   | `<AsWfForm>` props/emits/slots, `useWfForm()` composable, auth via custom `fetch`        |
