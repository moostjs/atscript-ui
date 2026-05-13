---
outline: deep
---

# Workflows

`@atscript/vue-wf` (client) and `@atscript/moost-wf` (server) implement
**HTTP round-trip workflow forms**: long, multi-step user flows where
the *server* decides which screen comes next.

A single workflow is one long-lived conversation: the server pauses,
asks the client for a form, validates the answer, optionally branches,
and resumes — all over plain HTTP, no sockets, no client-side state
machine. Built on top of [`@moostjs/event-wf`](https://moost.org).

## What it solves

The flows everyone writes by hand and gets wrong:

- **Login + MFA** — credentials, then OTP iff `mfaEnabled`, then a
  session cookie.
- **Sign-up with email verification** — register, send code, verify,
  create user, sign in.
- **Invite + register** — admin invites by email, invitee gets a
  magic link, lands on a "finish your account" form.
- **Multi-step checkout** — address, then payment, then confirm,
  with per-step server validation and conditional branches (e.g. skip
  payment for free tier).
- **Password change with re-auth** — confirm current password,
  collect new one, save.

These are all the same shape: a server-owned **state machine** with
**form steps**, branching on server-side state the browser is not
allowed to see (`mfaEnabled`, `roleName`, …).

## The mental model

```
┌─────────┐  POST /wf {wfid}            ┌─────────┐
│ client  │ ─────────────────────────►  │ server  │
│         │                             │         │
│  AsWf   │ ◄───────────────────────── │  Step   │
│  Form   │  {inputRequired, wfs}       │ handler │
│         │                             │         │
│         │  POST /wf {wfs, input}      │         │
│         │ ─────────────────────────►  │         │
│         │                             │  Step   │
│         │ ◄───────────────────────── │ handler │
│         │  {inputRequired, wfs}       │         │
│         │           ...               │         │
│         │ ◄───────────────────────── │  Step   │
│         │  {finished: true, ...}      │ handler │
└─────────┘                             └─────────┘
```

Every round-trip is one POST. The response is one of:

- `{ inputRequired: { payload, transport, context }, wfs }` — render
  this form next, here is the new state token.
- `{ finished: true, ... }` — done; the rest of the body is the
  flow's result payload (session cookie set, redirect URL, …).
- `{ sent: true }` / `{ outlet: "..." }` — flow paused waiting for
  an external event (email link clicked, webhook fired). The current
  HTTP session is done; resume happens later via the token.
- `{ error: { message } }` — recoverable error; the client surfaces
  it and lets the user retry.

The client never decides which form comes next. The client just
**renders whatever the server returns**, posts back the answer, and
keeps going until `finished: true`.

## The two packages

### `@atscript/vue-wf` — the client

One Vue 3 component (Tier 1, auto-imported by `AsResolver`):

```vue
<AsWfForm
  path="/api/wf"
  name="auth/login"
  :types="types"
  @finished="onFinished"
/>
```

Or use the composable `useWfForm({ ... })` directly when you want to
roll your own UI shell around the round-trip.

See [Client: AsWfForm](/workflows/client) for the full API.

### `@atscript/moost-wf` — the server

A thin layer on top of [`@moostjs/event-wf`](https://moost.org)
that:

- Wraps each step's input/output in the wire format the Vue client
  expects (`{ inputRequired: { payload, transport, context } }`).
- Caches the serialized atscript schema per type (so the payload is
  built once per type, not once per step run).
- Validates the incoming input against the form type before the step
  handler runs.
- Filters workflow context through a `@wf.context.pass` whitelist
  before sending it to the browser (no accidental state leakage).
- Catches `requireInput()` signals from step handlers and converts
  them to outlet responses.
- Ships an `AsWfStore` for **durable state persistence** in any
  atscript-db table — opt in for flows that must survive process
  restart (email magic links, multi-day approvals).

See [Server-Side Authoring](/workflows/server-authoring).

## Quick map

| Topic                                              | Page                                                    |
| -------------------------------------------------- | ------------------------------------------------------- |
| Two-step end-to-end example                        | [Hello World](/workflows/hello-world)                   |
| `@Workflow` + `@Step` + `@WorkflowSchema`          | [Server-Side Authoring](/workflows/server-authoring)    |
| `@FormInput`, `requireInput`, server-side errors   | [Form Input & Validation](/workflows/form-input)        |
| Alt actions (resend code, save draft, …)           | [Actions](/workflows/actions)                           |
| Passing context to the client form                 | [Context Passing](/workflows/context)                   |
| Durable state with `AsWfStore`                     | [State Persistence](/workflows/state-persistence)       |
| Magic links, outlets, resume                       | [Outlets & Resume](/workflows/outlets-resume)           |
| `<AsWfForm>` + `useWfForm()` reference             | [Client: AsWfForm](/workflows/client)                   |
| Login+MFA, invite+register, checkout               | [Recipes](/workflows/recipes)                           |

## Related

- [Forms](/forms/) — single-step forms (the rendering layer the
  workflow client reuses for each step).
- [Tables](/tables/) — annotation-driven smart tables.
- [moost.org](https://moost.org) — the moost framework + the
  underlying `@moostjs/event-wf` workflow engine.
- [atscript.dev](https://atscript.dev) — `.as` files, annotations,
  the type system used to declare every form.
- [db.atscript.dev](https://db.atscript.dev) — the DB layer used by
  `AsWfStore`.
