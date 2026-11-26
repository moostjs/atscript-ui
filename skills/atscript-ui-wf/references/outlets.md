# outlets

Outlet pauses, resume tokens, transport choice (body / cookie / query), magic-link and webhook patterns.

## Contents

- [Outlet concept](#outlet-concept)
- [Outlet response shapes](#outlet-response-shapes)
- [Client behavior on outlet](#client-behavior-on-outlet)
- [Resume mechanism](#resume-mechanism)
  - [Follow the token across reloads](#follow-the-token-across-reloads)
- [Token transports](#token-transports)
- [Picking a transport](#picking-a-transport)
- [Recipe — email magic link flow](#recipe--email-magic-link-flow)
- [Recipe — webhook callback flow](#recipe--webhook-callback-flow)
- [Race-safe resume invariant](#race-safe-resume-invariant)

## Outlet concept

An **outlet** is a workflow pause that hands control to an external channel (email, SMS, webhook, scheduled job) and waits for an out-of-band event to resume the flow. The HTTP request that triggered the pause returns immediately — the flow itself is at rest in the state store, keyed by `handle`.

Two outlet flavours from `@moostjs/event-wf`:

| Outlet                            | Use                                                                                                                                                                                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `outletHttp(payload, context?)`   | embeds payload in the HTTP response. With `createAsHttpOutlet()` mounted in `handleAsOutletRequest`, the outlet wraps the return value as `{ inputRequired: { payload, transport: 'http', context } }` — what `<AsWfForm>` decodes. The flow continues on the next request. |
| `outletEmail(to, template, data)` | sends an email, returns `{ sent: true }` (or `{ outlet: '<name>' }`), client closes the loop. Resume comes from the link in the email.                                                                                                                                      |

You can also write custom outlets (SMS, push, webhook). The runtime treats them all the same way: pause + persist + return a response shape that the client recognizes.

### Why two HTTP outlets?

`createHttpOutlet` (from `@moostjs/event-wf`) is the generic primitive — it flattens `outletHttp(payload, context)` onto the response root unconditionally. `createAsHttpOutlet` (from `@atscript/moost-wf`) pre-configures the `transform` to wrap generic form payloads in the `{ inputRequired: {...} }` envelope `<AsWfForm>` decodes, while letting signal payloads (`finished`/`sent`/`outlet`/`error`) flow through unwrapped. Use `createAsHttpOutlet()` for every trigger fronting `<AsWfForm>`; reach for bare `createHttpOutlet()` only for non-`<AsWfForm>` consumers. Pair it with `handleAsOutletRequest` (also from `@atscript/moost-wf`) as the trigger — that wrapper supplies the `finished: true` marker `<AsWfForm>` reads when a step calls `useWfFinished().set({ value })`. See SKILL.md invariants 11 + 12 for details.

## Outlet response shapes

The wire-level shape `<AsWfForm>` recognizes:

| Body                                                      | Client behavior                                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `{ inputRequired: { payload, transport, context }, wfs }` | render the form, wait for next user action                                             |
| `{ finished: true, ...response }`                         | fire `@finished`, set `wf.response.value`, stop                                        |
| `{ sent: true }`                                          | treat as "finished from HTTP perspective" — fire `@finished` with the body as response |
| `{ outlet: '<name>' }`                                    | same as `sent: true` — fire `@finished`                                                |
| `{ error: { message, status? } }`                         | set `wf.error.value`, fire `@error`                                                    |
| anything else                                             | set `error.value = { message: 'Unexpected response format' }`                          |

The `{ sent: true }` / `{ outlet: '<name>' }` branch was added so the client gets a **clean `@finished`** instead of falling into the "unexpected response" branch and re-submitting. The user closes the tab; the actual resume happens later via a token.

## Client behavior on outlet

From the client's perspective, an outlet pause is identical to a real `finished: true`:

- `wf.finished.value` becomes `true`.
- `wf.response.value` is set to the response body (`{ sent: true }` or `{ outlet: '...' }`).
- The form is cleared (`formDef`, `formData` set to `null`).
- `@finished` emits.

There is no client-side polling. If your UX needs polling (e.g. "waiting for approval" with a spinner), implement it in a separate component, not via `<AsWfForm>`.

## Resume mechanism

The workflow state lives in the store, keyed by `handle`. To resume, the client must submit a request carrying that handle. Two paths:

1. **Same session** — the client keeps the token in memory (`wf.token`; `body` / `query` transport) and replaces it from every answer. Continuing on the same `<AsWfForm>` instance just works.
2. **New session / different client** — the token must come from outside: query param (`?wfs=<token>`), cookie, or app state (e.g. router param). Mount a fresh `<AsWfForm initialToken="<token>">` and the first request resumes the paused flow.

```vue
<!-- The flow was paused via outletEmail; the email link points here -->
<script setup lang="ts">
import { useRoute } from "vue-router";
const route = useRoute();
const token = route.query.wfs as string;
</script>

<template>
  <AsWfForm path="/wf/trigger" name="admin/invite" :initialToken="token" :types />
</template>
```

`initialToken` takes precedence over `tokenTransport: 'query'` auto-detection. Use it when the token comes from app state / router param (`/invite/:token`) rather than `window.location.search`.

### Follow the token across reloads

`persistToken` / `@link-used` / `@token` since 0.1.187. A server may answer with a different token, e.g. renew it at a privilege-raising step (the invite run continues under a fresh token once the invitee set a password; the emailed one stops working). A page that resends the link's token on reload gets `410 WF_EXPIRED`. The renewed token carries the raised privilege (it can finish the acceptance and sign in; encapsulated tokens may never expire) → never put it in the URL / history. Use the option:

```vue
<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
const route = useRoute();
const router = useRouter();
const link = typeof route.query.wfs === "string" ? route.query.wfs : undefined;

function dropLink() {
  const query = { ...route.query };
  delete query.wfs;
  void router.replace({ query }); // replace — never push
}
</script>

<template>
  <AsWfForm
    path="/wf/trigger"
    name="users/invite"
    :initial-token="link"
    persist-token="session"
    :types
    @link-used="dropLink"
  />
</template>
```

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `persistToken: "session"` (off by default; read at setup) keeps `{ link, token }` in this tab's `sessionStorage` under `wf:<page>:<name>` — page = Vue Router route pattern with params filled in except the link's (`/projects/:id/setup` → `/projects/42/setup`, one run per project; `/invite/:token?` → `/invite`, stable when the link leaves) → an admin page and an invitee page running one workflow never share a run. Fallback `location.pathname` (no router, before the first navigation, `useWfForm` outside a component) cannot tell a path-param link apart → set `persistTokenKey`; hash routing without Vue Router keys per workflow name only. `persistTokenKey` also for two runs of one workflow on a page. |
| 2   | Start: saved token wins over **no link** or the **same link** (re-opened email link after a renewal → resumes); a **different link** (re-sent invite) starts from itself and replaces the entry. The start token is saved before the first request.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3   | The entry follows every token change; removed on finish / out-of-band pause; an in-band pause that hands over `wfs` keeps it; a refused request keeps it (reload → same answer) — except a `410` of a run that did not start from a link: entry removed (in-memory token kept, `retry()` unchanged).                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 4   | `@link-used` = the `onLinkUsed` prop/option (one callback for `<AsWfForm>` and `useWfForm`; fires with or without `persistToken`): once, when the link is no longer needed — answered (not a network error) **and** held elsewhere: saved entry (`persistToken`; a failed save keeps the link), cookie (cookie transport: a successful answer or a `410` only — after another refusal no cookie exists, the link stays and `start()` keeps sending it), else on the first answer. Remove it with `router.replace` — never push. Path param: optional (`/invite/:token?`) + `router.replace({ name: "invite" })`. A throwing handler is caught (dev log).                                                                        |
| 5   | No `@link-used` handler + `persistToken`: no Vue Router → `?<tokenName>=` removed via `history.replaceState`; Vue Router present → link left in the URL + dev warning (the router's next navigation would undo a `history.replaceState`). Router apps must pass `@link-used`.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 6   | Storage errors (disabled, quota) → run continues in memory, link stays in the URL (reload restarts from the link). SSR: setup touches neither `window` nor `sessionStorage` (Node 25+ has a process-wide one). Trade-offs on shared computers: reopen-closed-tab / session restore bring the entry back; a duplicated tab copies it (one of the two gets `410` later); XSS reads it like any client state.                                                                                                                                                                                                                                                                                                                      |
| 7   | Cookie transport: stores nothing (the cookie survives a reload); the option only drops the link — a reloaded link would ride the start body and, with `token.read` `body` first, beat the cookie. A reload / second tab during an in-flight request can still fork the run (the server can't tell an in-flight cookie token from a dead one); within one page `start()` waits for the in-flight request ([client.md](client.md#abortcontroller-behavior)).                                                                                                                                                                                                                                                                      |
| 8   | `start()` sends the start token until a request carrying it is answered (or after `initialToken` changes value); otherwise the current token: mid-run → resumes the current pause (`input` reaches the paused step as `formData`); run over → a new run. Cookie transport: the browser still sends the run's cookie until the server clears it (`@wooksjs/event-wf` 0.8.6).                                                                                                                                                                                                                                                                                                                                                     |

#### Doing it yourself (`@token` / `wf.token`)

The low-level API under the option: fires when the token the next request sends changes — a different `wfs` in any answer (refusals included); never for the start token or an unchanged one; `undefined` when the run is over (an in-band pause with `wfs` → that token; already `undefined` → no event). Custom storage follows rules 1–3 by hand: save the start token before the first request (`@token` won't report it), write on every `@token`, remove on `undefined` and on `@finished` unless an in-band token is kept, drop the link in `@link-used` once your save succeeded. Tokens that carry no privilege may follow in the URL instead (`router.replace` of `wfs` on every `@token`, `:initial-token` bound to the route) — never share that URL. Headless: `watch(wf.token, …)`.

## Token transports

```typescript
// useWfForm options
tokenTransport?: 'body' | 'cookie' | 'query'   // default: 'body'
tokenName?: string                              // default: 'wfs'
```

| Transport | Where the token lives                              | Default name | Survives reload?                                     | Cross-browser?         |
| --------- | -------------------------------------------------- | ------------ | ---------------------------------------------------- | ---------------------- |
| `body`    | request / response JSON `wfs` field                | `wfs`        | **no** — JS memory, unless `persistToken: "session"` | no                     |
| `cookie`  | `Set-Cookie` / `Cookie` headers, server-controlled | `wfs`        | yes, until expiry                                    | no (same-origin)       |
| `query`   | URL `?wfs=<token>`                                 | `wfs`        | yes (URL bookmarkable)                               | yes — URL is shareable |

Behaviour detail:

- `body`: client tucks `wfs` into the JSON body of each request after the first response; server returns updated `wfs` in each response.
- `cookie`: client sets `credentials: 'include'` on every fetch and **does not** put the token in the body — except an `initialToken`, in the first start body only. Server handles read/write via headers.
- `query`: client reads `window.location.search` once on `start()` (or uses `initialToken`); after that behaves like `body`.

## Picking a transport

| Story                                                                               | Transport                         |
| ----------------------------------------------------------------------------------- | --------------------------------- |
| Single-session flow that finishes in one go (login, simple multi-step form)         | `body`                            |
| Long flow with potential reload but same browser (multi-day wizard, approval queue) | `cookie`                          |
| Magic-link or webhook resume (email confirm, payment redirect, admin link)          | `query`                           |
| Multi-device handoff (start on desktop, finish on phone)                            | `query` (URL shareable)           |
| API-driven flow (mobile app, no browser)                                            | `body` (carry token in app state) |

`cookie` requires server-side cookie handling on the trigger endpoint — set `Set-Cookie: wfs=<token>; HttpOnly; SameSite=Lax` on each response. The vue-wf client only enables `credentials: 'include'`; it does not parse cookies itself.

`tokenTransport` must match the server's `token.write` (`body` or `cookie` only): client `body` / `query` ↔ `write: 'body'`, client `cookie` ↔ `write: 'cookie'`.

Whether a link keeps working depends on the state strategy: a durable handle (`HandleStateStrategy`) is reused for in-band pauses and changes on an out-of-band delivery, a step's `renewStateToken()`, or a strategy swap; encapsulated strategies mint a new token per pause. Every resume consumes the state it reads (`getAndDelete`) — see [Race-safe resume invariant](#race-safe-resume-invariant).

## Recipe — email magic link flow

End-to-end: collect email, send magic link, resume from `?wfs=<token>`.

### Step 1 — collect email

```typescript
@Step("collect-email")
collectEmail(
  @WfInput() input: EmailForm,
  @WorkflowParam("context") ctx: { email?: string; token?: string },
) {
  ctx.email = input.email;
}
```

### Step 2 — send link and pause

`outletEmail(to, template, data)` pauses the flow and emits the email. The engine persists state via the configured `HandleStateStrategy` and mints the token; the `createEmailOutlet(sender)` adapter (registered in `handleAsOutletRequest({ outlets })`) receives the rendered token through the sender callback and injects it into the template's `url`.

```typescript
import { outletEmail } from "@moostjs/event-wf";

@Step("send-link")
async sendLink(@WorkflowParam("context") ctx: { email?: string }) {
  return outletEmail(ctx.email!, "magic-link", {
    // Template renders the URL using whichever variable the sender exposes
    // (e.g. `{{wfs}}` → resume token). See `createEmailOutlet(sender)` in
    // @moostjs/event-wf for the sender contract.
  });
}
```

Sender callback (passed to `createEmailOutlet(sender)` in the outlet-trigger config) receives the resume token and the rendered template — your sender builds the URL (`https://app.com/resume?wfs=${token}`) and ships the email.

### Step 3 — post-resume step

```typescript
import { finishWf } from "@atscript/moost-wf";

@Step("link-clicked")
async linkClicked(@WorkflowParam("context") ctx: { email?: string }) {
  // The user clicked the link. This step runs after resume.
  await markVerified(ctx.email!);
  finishWf({ data: { verified: true } });
}
```

### Client — resume route

```vue
<!-- /resume?wfs=<token> -->
<script setup lang="ts">
import { useRoute } from "vue-router";
import { AsWfForm } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";

const route = useRoute();
const types = createDefaultTypes();
const token = route.query.wfs as string;
</script>

<template>
  <AsWfForm
    path="/wf/trigger"
    name="auth/magic-link"
    :initialToken="token"
    :types
    @finished="$router.push('/dashboard')"
  />
</template>
```

The first `POST /wf/trigger` carries `{ wfid: 'auth/magic-link', wfs: '<token>' }`. The server resumes the paused flow → step `link-clicked` runs → emits `@finished`.

### AsWfStore behavior on resume

The engine calls `AsWfStore.getAndDelete(handle)` to consume the state — the row is deleted atomically when the resume succeeds. The link stops working on the next click (no row to read).

## Recipe — webhook callback flow

For server-to-server resume (payment gateway, third-party API):

### Step 1 — fire request and pause

```typescript
@Step("charge")
async charge(@WorkflowParam("context") ctx: { orderId: string; token?: string }) {
  // The gateway will POST back to /api/wf/callback once the charge clears.
  // Carry your own correlation id (orderId) in the URL and look the flow up
  // by an indexed shadow column on the wf-state row (see state.md —
  // @wf.store.fromContext). On the callback, resume by the wfs token you
  // persisted alongside it, not by extracting one from the engine here.
  await gateway.charge(ctx.orderId, {
    callback_url: `https://app.com/api/wf/callback/${ctx.orderId}`,
  });
  return outletHttp({ outlet: "awaiting-payment" });
}
```

Works without a separate outlet registration: `createAsHttpOutlet()` recognises `outlet` as a top-level routing key and passes the payload through at the response root. The client routes it via the `typeof data.outlet === 'string'` branch and fires `@finished`.

### Step 2 — webhook receiver

A regular Moost HTTP route (not a step). On callback, invoke the engine's resume API with the token from the URL and the webhook payload as `input`:

```typescript
@Controller()
export class WfCallbackController {
  constructor(private readonly wfEngine: WfEngine) {}

  @Post("/api/wf/callback/:handle")
  async callback(@Param("handle") handle: string, @Body() payload: PaymentResult) {
    await this.wfEngine.resume(handle, { input: payload });
    return { ok: true };
  }
}
```

(`wfEngine.resume(handle, ...)` shape depends on `@moostjs/event-wf` — cross-reference its docs.)

### Step 3 — post-resume step

```typescript
import { finishWf, abortWf } from "@atscript/moost-wf";

@Step("finalize")
finalize(
  @WorkflowParam("input") input: PaymentResult,
  @WorkflowParam("context") ctx: { orderId: string },
) {
  if (input.status !== "ok") {
    abortWf(input.reason, { message: { level: "error", text: "Payment failed." } });
    return;
  }
  // mark order paid, etc.
  finishWf({ data: { ok: true } });
}
```

### Client never sees the callback

The original client got `{ outlet: 'awaiting-payment' }` and fired `@finished`. The webhook resume is server-to-server; the client must poll a separate endpoint or use WebSockets if real-time UX is needed.

## Race-safe resume invariant

`AsWfStore.getAndDelete(handle)` is atomic — `findRow` → `deleteMany({ handle })` → `deletedCount === 1` gate. Two concurrent callers: only one's delete returns 1; the other returns `null`.

Implications:

- A resume consumes the row. The link works again only while the run pauses in band under the same handle; after the finish, an out-of-band delivery, `renewStateToken()` or a strategy swap it answers `410 WF_EXPIRED`.
- Do **not** call `get()` then `delete()` separately. Two concurrent resumes would both observe the row, both proceed, and both fire the post-resume step.
- If you need a multi-use link (e.g. "approve up to N times"), encode that as workflow logic — don't bypass the store contract.

The default expiry policy: rows live until expired (via `expiresAt`) or consumed. Run `cleanup({ retention })` periodically to garbage-collect expired-but-unconsumed rows (e.g. emails that were never clicked).
