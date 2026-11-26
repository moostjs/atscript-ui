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
   → HTTP response: { sent: true, outlet: "email" } (no token: it
     left by email)
3. Admin's screen: "Invite sent."
4. Alice clicks the email link "https://app/invite?wfs=<uuid>"
   → her browser loads the app, app extracts wfs from URL.
   → <AsWfForm :initialToken="wfs" name="users/invite" />
5. Client POSTs { wfid, wfs } to /wf — with a token present the
   engine resumes it and ignores wfid.
   → engine looks up the handle, resumes the paused step.
6. Server returns the next form (invite-accept) — Alice fills in
   username + password, submits.
7. Server: complete user record, issue session cookie, done.
```

The token (`wfs`) does two jobs: it identifies the paused workflow,
and it serves as a credential (the email recipient proves they got
the email by holding the token). It can change between pauses; see
[How resume works on the wire](#how-resume-works-on-the-wire).

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

| Transport | Read                 | Write                             | Use when                                                                                                              |
| --------- | -------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `body`    | JSON body, key `wfs` | JSON response, key `wfs`          | Default. Token lives in memory; lost on reload unless the page [keeps it](#keeping-the-current-token-across-reloads). |
| `cookie`  | `Cookie: wfs=...`    | `Set-Cookie: wfs=...`             | Survives page reload. Same browser only.                                                                              |
| `query`   | `?wfs=...`           | — (`write` is `body` or `cookie`) | Magic links: the link carries the token into the first request.                                                       |

`token.read` is a list, so the same endpoint can accept all three.
`token.write` is the format the server hands back on every response:
`body` or `cookie`. Set the client's `tokenTransport` to match:
`"body"` or `"query"` for `write: "body"`, `"cookie"` for
`write: "cookie"`.

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

## Keeping the current token across reloads

A server can answer with a different token than the one it was sent. It
may rotate the token at a privilege-raising step: an invitation run
continues under a fresh token once the invitee has set a password, and the
emailed token stops working. `<AsWfForm>` sends the fresh token from then
on, but a page that took the token from its URL still has the old one
there. A reload resends that token, and the server answers that it has
expired or was already used (`410`, `WF_EXPIRED`).

The fresh token must not go into the URL either. After the rotation it
carries the raised privilege: an invite token can then finish the
acceptance and sign in, and an encapsulated token may never expire. A URL
ends up in the history, the address bar and anything the user copies.

`persistToken: "session"` (since 0.1.187) keeps the run in this tab's
`sessionStorage` instead. It survives a reload and never enters the
history. Turn it on, and remove the link from the address when
`@link-used` fires:

```vue
<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { AsWfForm } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";

const route = useRoute();
const router = useRouter();
const types = createDefaultTypes();
const link = typeof route.query.wfs === "string" ? route.query.wfs : undefined;

function dropLink() {
  const query = { ...route.query };
  delete query.wfs;
  void router.replace({ query });
}
</script>

<template>
  <AsWfForm
    path="/api/wf"
    name="users/invite"
    :initial-token="link"
    persist-token="session"
    :types="types"
    @link-used="dropLink"
  />
</template>
```

What the option does:

- **One entry per workflow and page**: key `wf:<page>:<name>`, holding
  `{ link, token }`. With Vue Router, the page is the route pattern with its
  params filled in, except a param that holds the link. So
  `/projects/:id/setup` becomes `/projects/42/setup` (each project keeps its
  own run), and `/invite/:token?` becomes `/invite`, which stays the same
  when the link leaves the URL. An admin page and an invitee's link page
  that run the same workflow never share a run. Set `persist-token-key`
  when one page runs the same workflow twice.
- **The `location.pathname` fallback** is used without a router, before
  the router's first navigation, and for `useWfForm()` outside a component.
  It can't tell a path-param link apart, so set `persist-token-key` there.
  Hash routing without Vue Router has the same pathname on every page, so
  its runs are kept per workflow name only.
- **On start, the saved token wins over no link or the same link.**
  Opening the emailed link again in that tab, after the server renewed the
  token, resumes the run. A different link (a re-sent invitation) starts
  from itself and replaces the entry. The start token is saved before the
  first request.
- **The entry follows every token change.** It is removed when the run
  finishes or pauses out of band. An in-band pause that hands over a `wfs`
  keeps it. A refused request keeps it too, so a reload gets the same
  answer. The exception is a `410` for a run that did not start from a
  link: no link can bring that run back, so the entry goes. The in-memory
  token stays, so `retry()` behaves as before.
- **Without a `@link-used` handler**, an app without Vue Router has
  `?wfs=` removed with `history.replaceState`. An app with Vue Router keeps
  the link and gets a dev warning: the router's next navigation rewrites
  the current entry from its own record, which would undo a
  `history.replaceState`. Only the app's router can remove the link for
  good.
- **Storage that fails** (disabled, full) leaves the run in memory and the
  link in the URL. The run goes on, and a reload starts again from the
  link. Under SSR, setup touches neither `window` nor `sessionStorage`
  (Node 25 and later define a process-wide one).
- **Cookie transport stores nothing**, since the httpOnly cookie already
  survives a reload. The option only drops the link. Without that, a reload
  would send the link in the start body, where the default `token.read`
  order (`body` first) prefers it over the cookie. A reload or a second tab
  during an in-flight request can still fork the run: the server can't tell
  an in-flight cookie token from a dead one. Within one page, `start()`
  waits for the request in flight instead (see
  [Aborting](/workflows/client#aborting)).
- `persistToken` and `persistTokenKey` are read once, at setup.

`@link-used` (the `onLinkUsed` option, with or without `persistToken`)
fires once the link is no longer needed. That means the server has
answered a request sent while the link was present (not a network error),
and the run is held elsewhere:

- With `persistToken`, the entry was saved. A failed save keeps the link.
- With cookie transport, the answer succeeded or was a `410` (the link is
  dead then). The server sets the cookie only on success, so after any
  other refusal the link is still the only copy. `start()` keeps sending it,
  and `@link-used` waits.
- Otherwise, on the first answer (your own storage holds the run).

Remove the link there with `router.replace`, never a push. For a path
param, make it optional (`/invite/:token?`) and drop it with a named
replace, `router.replace({ name: "invite" })`, which leaves an optional
param out. A handler that throws doesn't affect the answer; in
development the error is logged.

`sessionStorage` on a shared computer has trade-offs. Reopening a closed
tab, or a restored browser session, brings the entry back. Duplicating the
tab copies it, so the two tabs share one run and one of them gets a `410`
later. A script injected into the page (XSS) can read it like any other
client state.

### Doing it yourself

`@token`, and `token` on `useWfForm()`, are the low-level API the option
is built on. They report every change of the token the next request
sends:

| When                                                 | `token`                          |
| ---------------------------------------------------- | -------------------------------- |
| An answer carries a different `wfs` (refusals too)   | the new token                    |
| An answer carries the same `wfs`                     | does not fire                    |
| The start token (`initialToken`, or the URL's)       | does not fire                    |
| The run finishes                                     | `undefined`                      |
| An outlet pause whose answer has no `wfs` (an email) | `undefined`: not yours to resume |
| An outlet pause whose answer has a `wfs` (in-band)   | that token                       |
| A refused request with no `wfs` (e.g. `WF_EXPIRED`)  | does not fire                    |

To keep the token somewhere else, follow the option's rules. Save the start
token yourself before the first request, because `@token` doesn't fire for
it. Write on every `@token`, and remove the entry on `undefined`. Also
remove it on `@finished` when there is no in-band token to keep: `@token`
is silent when the token was already `undefined`. Drop the link in
`@link-used`, once your save has succeeded:

```ts
const link = typeof route.query.wfs === "string" ? route.query.wfs : undefined;
const saved = loadRun(); // your storage: { link, token } or undefined
const run = saved && (!link || saved.link === link) ? saved : { link, token: link };
keepToken(run.token);

function keepToken(token: string | undefined) {
  if (token) saveRun({ link: run.link, token });
  else clearRun();
}
```

```vue
<AsWfForm :initial-token="run.token" @token="keepToken" @link-used="dropLink" … />
```

- **Tokens that carry no privilege** may follow in the URL instead: replace
  `wfs` (or the path param) on every `@token` and bind `:initial-token` to
  the route. Don't share that URL. Its token is live until the run is over.
- **A start sends `initialToken` only until a request carrying it has been
  answered**, or after its value changes. See
  [What `start()` sends](/workflows/client#what-start-sends).
- **Cookie transport: `@token` never fires.** The cookie follows the run on
  its own; only drop the link from the URL.
- Headless: `watch(wf.token, keepToken)`.

## How resume works on the wire

A resuming `start()` posts the workflow id and the token. With a token
present, the engine resumes it and ignores `wfid`. Later requests
(submit, action) carry only the token.

```http
POST /wf
{ "wfid": "users/invite", "wfs": "<uuid>" }
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

Common pitfall: the token can change between pauses. A durable
handle (`HandleStateStrategy`) is reused for in-band pauses, and
changes on an out-of-band delivery, on a step's `renewStateToken()`
call, or on a strategy swap. Encapsulated strategies mint a new
token on every pause. Any answer may carry the new one, refusals
included. If your client throws away the new token (e.g. because it
didn't expect another round-trip), the user is stuck. `<AsWfForm>` handles this
automatically: it reads the new `wfs` off every response. A page
that must survive a reload turns on `persistToken` (see
[Keeping the current token across reloads](#keeping-the-current-token-across-reloads)).

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
- Admin sees `{ sent: true, outlet: "email" }`; the token went by
  email only.

Hours later, from Alice's browser via magic link:

- POST `{ wfid, wfs }` → engine resumes at `invite-send`. The
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
