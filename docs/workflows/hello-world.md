---
outline: deep
---

# Hello World

A two-step workflow end-to-end: the server asks for a name, then
returns a greeting. Demonstrates the full round-trip without any of
the production-flow noise (auth, DB, MFA).

## Install

```bash
# Server
pnpm add moost @moostjs/event-http @moostjs/event-wf @atscript/moost-wf

# Client
pnpm add @atscript/vue-form @atscript/vue-wf
```

Both packages depend on `@atscript/core` + `@atscript/typescript` for
`.as` compilation. Make sure your `atscript.config.*` registers the
`moost-wf` plugin so the `@wf.*` annotations resolve:

```ts
// atscript.config.ts
import wfPlugin from "@atscript/moost-wf/plugin";

export default {
  plugins: [wfPlugin()],
};
```

See [atscript.dev](https://atscript.dev) for `asc` CLI setup.

## 1. Define the form types

`shared/forms/hello.as` — shared between server and client; the
server uses it as input validation, the client renders it.

```atscript
@meta.label 'Hello'
@ui.form.submit.text 'Say hi'
export interface HelloForm {
    @meta.label 'Your name'
    @ui.form.placeholder 'World'
    @meta.required 'Name is required'
    @expect.minLength 1, 'At least 1 character'
    name: string
}
```

That is the entire schema. The submit button label, the field label,
the placeholder, the required rule, the min-length validation — all
declared once, lifted out by the build, consumed by both ends.

## 2. Server: the workflow

`server/workflows/hello.workflow.ts`:

```ts
import { Controller } from "moost";
import {
  Workflow,
  Step,
  WorkflowSchema,
  WorkflowParam,
  useWfFinished,
  outletHttp,
} from "@moostjs/event-wf";
import { serializeFormSchema, extractPassContext } from "@atscript/moost-wf";
import { HelloForm } from "../../shared/forms/hello.as";

interface HelloCtx {
  name?: string;
}

@Controller()
export class HelloWorkflow {
  @Workflow("hello")
  @WorkflowSchema<HelloCtx>([{ id: "ask-name" }, { id: "greet" }])
  flow() {}

  @Step("ask-name")
  ask(
    @WorkflowParam("input") input: { name?: string } | undefined,
    @WorkflowParam("context") ctx: HelloCtx,
  ) {
    if (!input?.name) {
      return outletHttp(serializeFormSchema(HelloForm), extractPassContext(HelloForm, ctx));
    }
    ctx.name = input.name;
    return;
  }

  @Step("greet")
  greet(@WorkflowParam("context") ctx: HelloCtx) {
    useWfFinished().set({
      type: "data",
      value: { finished: true, message: `Hello, ${ctx.name}!` },
    });
    return;
  }
}
```

`createAsHttpOutlet()` (registered below) wraps the `inputRequired`
envelope automatically, so the step body stays at one line:
`outletHttp(schema, context)`. A thin helper that also merges
field-level errors into the context is shown in
[Server-Side Authoring](/workflows/server-authoring).

### Mount the workflow on a Moost app

`server/main.ts`:

```ts
import { Moost } from "moost";
import { MoostHttp, Post } from "@moostjs/event-http";
import {
  MoostWf,
  handleWfOutletRequest,
  EncapsulatedStateStrategy,
  type WfOutletTriggerDeps,
} from "@moostjs/event-wf";
import { createAsHttpOutlet } from "@atscript/moost-wf";
import { Controller } from "moost";
import { HelloWorkflow } from "./workflows/hello.workflow";

@Controller()
class WfController {
  constructor(private readonly wf: MoostWf) {}

  @Post("wf")
  async handle() {
    const wfApp = this.wf.getWfApp();
    const deps: WfOutletTriggerDeps = {
      start: (schemaId, ctx, opts) => wfApp.start(schemaId, ctx as never, { input: opts?.input }),
      resume: (state, opts) => wfApp.resume(state as never, { input: opts?.input }),
    };
    return handleWfOutletRequest(
      {
        allow: ["hello"],
        state: () =>
          new EncapsulatedStateStrategy({
            secret: Buffer.from(process.env.WF_SECRET!, "hex"),
          }),
        outlets: [createAsHttpOutlet()],
        token: { read: ["body"], write: "body", name: "wfs" },
      },
      deps,
    );
  }
}

const app = new Moost();
void app.adapter(new MoostHttp()).listen(3000);
app.adapter(new MoostWf());
app.registerControllers(WfController, HelloWorkflow);
void app.init();
```

The HTTP controller forwards every `POST /wf` to the workflow engine
via `handleWfOutletRequest` — that helper reads the body, routes to
start vs resume, runs the matched step, and serializes the outlet
response. We use `EncapsulatedStateStrategy` here: the state token
is a signed, self-contained blob; no DB needed. See
[State Persistence](/workflows/state-persistence) for the durable
option.

## 3. Client: mount the form

`src/views/HelloView.vue`:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { AsWfForm } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";

const types = createDefaultTypes();
const greeting = ref<string | null>(null);

function onFinished(response: unknown) {
  greeting.value = (response as { message: string }).message;
}
</script>

<template>
  <div v-if="greeting">{{ greeting }}</div>
  <AsWfForm v-else path="/wf" name="hello" :types="types" @finished="onFinished" />
</template>
```

Nine lines of Vue. `<AsWfForm>` posts `{ wfid: "hello" }` on mount,
the server returns the `HelloForm` schema, the client renders it,
the user submits, the server returns `{ finished: true, message }`,
and `@finished` fires.

## The round-trip, traced

The wire conversation, abbreviated:

```http
POST /wf
{ "wfid": "hello" }
```

→

```json
{
  "inputRequired": {
    "payload": { "$as": "...serialized HelloForm metadata..." },
    "transport": "http",
    "context": {}
  },
  "wfs": "<state-token>"
}
```

Client deserializes `payload` back into a runtime atscript type,
builds a `FormDef`, renders the form. User types `World`, submits:

```http
POST /wf
{ "wfs": "<state-token>", "input": { "name": "World" } }
```

→

```json
{
  "finished": true,
  "message": "Hello, World!"
}
```

The state token (`wfs`) is the entire workflow state in encrypted
form. Lose it and the flow is gone — but with `EncapsulatedStateStrategy`
there is no server-side row to clean up either.

## Next steps

- [Server-Side Authoring](/workflows/server-authoring) — the full
  decorator stack, branching, error returns.
- [Form Input & Validation](/workflows/form-input) — `@FormInput()`,
  validation errors that re-render the same form.
- [Client: AsWfForm](/workflows/client) — props, slots, the
  composable form.
