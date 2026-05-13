# getting-started

Install matrix, end-to-end hello flow, global interceptor wiring, atscript config, minimal client mount.

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

`@atscript/moost-wf` peers: `@atscript/core`, `@atscript/typescript`, `@moostjs/event-wf`, `moost` (see `packages/moost-wf/package.json:peerDependencies`).

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
import {
  Workflow,
  Step,
  WorkflowSchema,
  WorkflowParam,
  useWfFinished,
  outletHttp,
  type WfOutletRequest,
} from "@moostjs/event-wf";
import {
  FormInput,
  type TFormInput,
  serializeFormSchema,
  extractPassContext,
} from "@atscript/moost-wf";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { HelloName } from "./forms.as";

interface Ctx {
  name?: string;
}

/**
 * Helper: build the `inputRequired` outlet response that `<AsWfForm>` expects.
 * Pattern, not a public export — copy into your own `wf-helpers.ts`.
 */
function httpInputRequired(
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

@Controller()
export class HelloWorkflow {
  @Workflow("hello")
  @WorkflowSchema<Ctx>([{ id: "ask" }, { id: "greet" }])
  flow() {}

  @Step("ask")
  ask(
    @WorkflowParam("input") input: { name?: string } | undefined,
    @WorkflowParam("context") ctx: Ctx,
  ) {
    if (!input?.name) return httpInputRequired(HelloName, ctx);
    ctx.name = input.name;
  }

  @Step("greet")
  greet(@WorkflowParam("context") ctx: Ctx) {
    useWfFinished().set({
      type: "data",
      value: { greeting: `Hello, ${ctx.name}!` },
    });
  }
}
```

Key shapes (`packages/moost-wf/src/form-input/decorator.ts:21-29` for `@FormInput()` flavour; `packages/vue-demo/src/server/workflows/wf-helpers.ts` for the `httpInputRequired` pattern):

- `Workflow`, `Step`, `WorkflowSchema`, `WorkflowParam`, `useWfFinished`, `outletHttp` come from **`@moostjs/event-wf`**, not from `moost`. Only `@Controller()` comes from `moost`.
- `@FormInput()` and friends come from **`@atscript/moost-wf`**.

### 3. App bootstrap — mount the global interceptor

```typescript
// src/server.ts
import { Moost } from "moost";
import { MoostHttp } from "@moostjs/event-http";
import { MoostWf } from "@moostjs/event-wf";
import { formInputInterceptor } from "@atscript/moost-wf";
import { HelloWorkflow } from "./wf/hello.workflow";

const app = new Moost();

// MANDATORY: catches FormInputRequired thrown by step handlers / `form.requireInput()`.
// Without it the protocol breaks — see SKILL.md invariant 1.
app.applyGlobalInterceptors(formInputInterceptor());

app.adapter(new MoostHttp()).adapter(new MoostWf());
await app.registerControllers(HelloWorkflow).init();
```

`formInputInterceptor()` is **global**. Mount it exactly once on the Moost app. Skipping it means `throw form.requireInput()` and uncaught `FormInputRequired` bubble out as 500s instead of the `inputRequired` outlet response (`packages/moost-wf/src/form-input/interceptor.ts:18-29`).

### 4. HTTP trigger

Expose `POST /wf/trigger` that forwards the request body to the workflow engine (start by `wfid`, resume by `wfs`). The exact route lives in your Moost app; the contract is the wire protocol from `SKILL.md`.

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

`wfPlugin()` registers (`packages/moost-wf/src/plugin.ts:24-87`):

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
| [server.md](server.md)   | authoring controllers, branching, action handlers, `@FormInput()` validation flow        |
| [context.md](context.md) | `@wf.context.pass` whitelist, `extractPassContext`, consuming `formContext`              |
| [state.md](state.md)     | `AsWfStore`, `@wf.store.fromContext` shadow columns, `cleanup` / `heal` / `getAndDelete` |
| [outlets.md](outlets.md) | outlet response shapes, magic-link / webhook resume, token transports                    |
| [client.md](client.md)   | `<AsWfForm>` props/emits/slots, `useWfForm()` composable, auth via custom `fetch`        |
