---
outline: deep
---

# Outlets & Resume

A workflow doesn't always pause for _form input_. Sometimes it
pauses for an **external event**: an email link clicked, a webhook
fired, an approval submitted from another app. That's what
**outlets** are for, and **resume** is how the flow picks up where
it left off — possibly in a different browser session entirely.

## What an outlet is

An outlet is a side-channel the workflow engine writes to when a
step decides to pause for something other than form input. The HTTP
outlet (which we've used for input forms) is one of several:

| Outlet   | Where it sends                 | Used for                                 |
| -------- | ------------------------------ | ---------------------------------------- |
| HTTP     | The current HTTP response body | Request form input (the round-trip)      |
| Email    | An email sender                | Magic links, confirmation, OTP delivery  |
| (custom) | Anywhere — webhooks, SMS, …    | Whatever your step calls `outletX()` for |

When a step returns an outlet payload that's **not HTTP**, the
client sees `{ sent: true }` or `{ outlet: "name" }` in its current
HTTP response. From the browser's perspective, the flow is _done_.
But on the server it's _paused_, waiting for an out-of-band
resumption.

## A typical email-magic-link flow

A `users/invite` flow:

```
1. Admin posts "invite alice@example.com as viewer"
   → server: insert pending user, persist context, advance.
2. Server step calls outletEmail(email, template, payload)
   → email outlet writes Set-Cookie? No: it dispatches the email
     (with ?wfs=<uuid> in the magic-link URL) and pauses the flow.
   → HTTP response: { sent: true, wfs: <uuid> }
3. Admin's screen: "Invite sent."
4. Alice clicks the email link "https://app/invite?wfs=<uuid>"
   → her browser loads the app, app extracts wfs from URL.
   → <AsWfForm :initialToken="wfs" name="users/invite" />
5. Client POSTs { wfs } to /wf — no wfid, just the token.
   → engine looks up the handle, resumes the paused step.
6. Server returns the next form (invite-accept) — Alice fills in
   username + password, submits.
7. Server: complete user record, issue session cookie, done.
```

The token (`wfs`) does two jobs: it identifies the paused workflow,
and it serves as a single-use credential (the email recipient
proves they got the email by holding the token).

## Returning an outlet from a step

The engine ships built-in helpers; the email outlet is the one used
in the demo:

```ts
import { outletEmail, type WfOutletRequest } from "@moostjs/event-wf";

@Step("invite-send")
@StepTTL(24 * 60 * 60 * 1000) // token expires in 24h
sendInvite(@WorkflowParam("context") ctx: InviteCtx) {
  // First run → emit the email outlet, the engine persists state + pauses.
  // Resume run (invitee POSTs with wfs) → advance past this step.
  if (ctx.inviteEmailSent) return;
  ctx.inviteEmailSent = true;
  return outletEmail(ctx.email!, "user-invite", {
    userId: ctx.userId,
    roleId: ctx.roleId,
  }) as { inputRequired: WfOutletRequest };
}
```

`outletEmail(toAddress, templateId, payload)` builds an outlet
request. The email outlet (registered on the controller — see below)
hands the request to your sender, which composes and sends the
email. The URL inside the email embeds `?wfs=<handle>`.

The `if (ctx.inviteEmailSent) return` guard is essential: when Alice
resumes, the engine re-enters this step, and we must _not_ send the
invite a second time. Flip a flag in context on first run, check it
on resume.

`@StepTTL(ms)` from `@moostjs/event-wf` sets a per-step expiry: the
row gets `expiresAt = now + ms`. After that window, the resume
request returns an error.

## Registering outlets on the controller

The HTTP dispatcher registers every outlet your flows use:

```ts
import { createEmailOutlet } from "@moostjs/event-wf";
import { createAsHttpOutlet, handleAsOutletRequest } from "@atscript/moost-wf";
import { consoleEmailSender } from "../workflows/email-sender";

return handleAsOutletRequest(
  {
    allow: ALLOWED_WORKFLOWS,
    state: handleStrategy,
    outlets: [createAsHttpOutlet(), createEmailOutlet(consoleEmailSender)],
    token: { read: ["body", "query", "cookie"], write: "body", name: "wfs" },
  },
  deps,
);
```

`createAsHttpOutlet()` is the canonical HTTP outlet for atscript-ui
workflows — it wraps generic form payloads in the
`{ inputRequired: { payload, transport, context } }` envelope the
`<AsWfForm>` client decodes. Payloads that already carry one of the
client's root-level routing keys — `finished`, `sent`, `outlet`, or
`error` — pass through at the response root (merged with `context`
if any), so `outletHttp({ outlet: "awaiting-payment" })` for a
webhook pause, `outletHttp({ error: { message } })`, etc. continue
to work without registering a separate outlet.

`handleAsOutletRequest` is the matching trigger: a thin wrapper
around `handleWfOutletRequest` that supplies the `finished: true`
marker `<AsWfForm>` reads when a step calls `finishWf({ data })`
(from `@atscript/moost-wf`). Pass-through for non-object
responses (redirect's empty-string body, primitives), arrays, and
already-marked envelopes (`inputRequired` / `finished` / `error` /
`sent` / `outlet`). If you need a bare HTTP outlet + trigger for
non-`<AsWfForm>` consumers (a custom JS client, an inline-data
response, …), use `createHttpOutlet` and `handleWfOutletRequest`
from `@moostjs/event-wf` directly — they flatten payload + context
onto the response root unconditionally and leave the shape to you.

`createEmailOutlet(sender)` takes a sender — your function that
actually composes + dispatches the email. A `consoleEmailSender` that
just logs the link to stdout is fine for development; production
plugs in SES, SendGrid, Postmark.

## Token transport for resume

The `token` config on `handleAsOutletRequest` controls how the token
crosses the wire on _resume_. Three places it can live:

| Transport | Read                 | Write                    | Use when                                             |
| --------- | -------------------- | ------------------------ | ---------------------------------------------------- |
| `body`    | JSON body, key `wfs` | JSON response, key `wfs` | Default. Token lives only in memory; lost on reload. |
| `cookie`  | `Cookie: wfs=...`    | `Set-Cookie: wfs=...`    | Survives page reload. Same browser only.             |
| `query`   | `?wfs=...`           | Append to redirect URLs  | Magic links — URL-shareable; single-use.             |

`token.read` is a list, so the same endpoint can accept all three.
`token.write` is the format the server hands back on every response.

Configured globally on the controller — the _client_ picks how to
read the initial token via `<AsWfForm tokenTransport="...">` or the
`initialToken` prop (see below).

## The client side: resuming

### Option A: `initialToken` prop

The cleanest: the host route knows where the token lives (Vue Router
param, app state, query, …) and hands it to the form:

```vue
<script setup lang="ts">
import { useRoute } from "vue-router";
import { AsWfForm } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";

const route = useRoute();
const types = createDefaultTypes();
const wfs = route.query.wfs as string;
</script>

<template>
  <AsWfForm
    path="/api/wf"
    name="users/invite"
    :initial-token="wfs"
    :types="types"
    @finished="onFinished"
  />
</template>
```

`initialToken` is included in the first request, so the server
resumes the paused flow instead of starting a new one. Works
regardless of `tokenTransport`.

### Option B: `tokenTransport: "query"` auto-detection

If the token sits in `window.location.search`, the form auto-reads
it on mount:

```vue
<AsWfForm path="/api/wf" name="users/invite" token-transport="query" :types="types" />
```

The composable's `readInitialToken()` pulls `?wfs=...` from the URL
and seeds the first request.

### Option C: `tokenTransport: "cookie"`

The browser sends the cookie automatically; the form just mounts. No
token wiring at all:

```vue
<AsWfForm path="/api/wf" name="auth/login" token-transport="cookie" :types="types" />
```

Good for "save and continue later" on the same machine.

## How resume works on the wire

On resume, the client posts **just the token**, no `wfid`:

```http
POST /wf
{ "wfs": "<uuid>" }
```

The engine:

1. Looks up the handle in the store (`HandleStateStrategy.consume`
   → `wfStore.getAndDelete`).
2. Reads `state.schemaId` to know which workflow.
3. Re-runs the paused step (which usually advances past its
   `outletX` call thanks to the context flag).
4. Continues until the next pause or finish.

The race-safe `getAndDelete` (see [State Persistence](/workflows/state-persistence#race-safe-consume-getanddelete))
ensures two simultaneous clicks on the same link only resume once.

Common pitfall: the token is single-use by default. The flow's
_next_ outlet request mints a new token. If your client throws away
the new token (e.g. because it didn't expect another round-trip),
the user is stuck. `<AsWfForm>` handles this automatically — it
reads the new `wfs` off every response.

## Combining outlets and form steps

A real flow mixes both — email pause, then form input, then another
email pause:

```ts
@Workflow("users/invite")
@WorkflowSchema<InviteCtx>([
  { id: "invite-start" },      // admin form
  { id: "invite-send" },        // email outlet → pause
  { id: "invite-accept" },      // invitee form
  { id: "invite-issue-session" }, // finish
])
```

From the admin's browser:

- POST start → form (invite-start).
- POST input → next step (`invite-send` emits email, pauses).
- Admin sees `{ sent: true, wfs: <uuid> }`.

Hours later, from Alice's browser via magic link:

- POST `{ wfs }` → engine resumes at `invite-send`. The
  `ctx.inviteEmailSent` flag is set, so the step `return`s.
- Engine advances to `invite-accept` → emits the form.
- Alice fills it in, submits.
- Engine advances to `invite-issue-session` → the step writes the
  session cookie and calls `finishWf({ data })`.
- Alice sees `@finished` with the session payload.

## Custom outlets

`createXxxOutlet(...)` is just a function that converts your step's
return value into an `WfOutletRequest`. Roll your own when you need
SMS, push, Slack, a webhook — anything that's _not_ the current HTTP
response.

The pattern: define an `outletX(args)` helper that returns
`{ outlet: "name", payload: ... }`; register `createXOutlet(sender)`
on the controller; the engine routes requests to your sender and
emits `{ outlet: "name" }` (or `{ sent: true }`) to the client.

See [@moostjs/event-wf docs](https://moost.org) for the full outlet
contract.

## Where to go next

- [State Persistence](/workflows/state-persistence) — durable
  storage required for any outlet flow that has to survive process
  restart.
- [Recipes](/workflows/recipes) — the invite + register pattern
  end-to-end.
- [moost.org](https://moost.org) — the underlying workflow
  engine and outlet primitives.
