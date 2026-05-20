---
outline: deep
---

# Finish Screens

When a workflow terminates, the server returns a `WfFinished` envelope.
`<AsWfForm>` reads it, fires `@finished`, and — by default — renders an
`AsWfFinish` screen that drives the next user action: a redirect, a
countdown, a button choice, or just a final message.

This page documents the envelope shape, the workflow-author helpers
that produce it, the slot contract for customizing the rendering, and
the event contract for hooking the actions into your router.

## Why a unified terminal shape

Different workflows want different post-finish UX — sign-in wants a
silent redirect, a long-running task wants a countdown the user can
skip, a multi-outcome flow wants a choice screen. Without a shared
shape the client either renders nothing (forcing every consumer to
own the screen) or hardcodes one outcome (forcing the server to
write JavaScript). The envelope keeps the server in charge of intent
and lets the client render the corresponding UX without a custom
component per workflow.

## The envelope

```ts
interface WfFinished<TData = unknown> {
  finished: true;
  data?: TData;
  message?: WfMessage;
  next?: WfNext;
  aborted?: boolean;
  reason?: string;
}

interface WfMessage {
  level: "info" | "success" | "warn" | "error";
  text: string;
}

type WfNext =
  | { trigger: "immediate"; action: WfAction }
  | {
      trigger: "auto";
      timeoutMs: number;
      action: WfAction;
      skipButton?: { label: string; behavior?: "now" | "cancel" };
    }
  | {
      trigger: "manual";
      primary?: WfButton;
      options?: WfButton[];
    };

interface WfButton {
  label: string;
  action: WfAction;
}

type WfAction =
  | { type: "redirect"; target: string; reason?: string }
  | { type: "reload" }
  | { type: "dismiss" };
```

- **`finished: true`** — required marker. The HTTP adapter wraps bare
  step results to add it; the helpers below already include it, so
  wrapping is a no-op for them.
- **`data`** — your domain payload. Whatever the consumer reads on
  `@finished`. Type-parameterize via `WfFinished<MyShape>`.
- **`message`** — optional banner rendered at the top of the finish
  screen. Use for "you're signed in" / "submission saved" toasts that
  the screen itself shows for a beat before navigating.
- **`next`** — what to do next. Drives the rendering trigger.
- **`aborted` / `reason`** — soft-failure signal. Used together when
  the flow ends in a recoverable terminal state (`"reason: rate-limited"`).

When `next` is omitted, `AsWfFinish` just renders the `message` (if any)
and waits for the consumer to act. With `next` set, the rendering and
action wiring follow the rules below.

## Helpers

`@atscript/moost-wf` ships two helpers — `finishWf(opts?)` and
`abortWf(reason, opts?)` — that wrap `useWfFinished` from
`@moostjs/event-wf`. Both accept the same shared options bag:

```ts
interface FinishWfOpts<T = unknown> {
  data?: T;
  message?: WfMessage;
  next?: WfNext;
}

function finishWf<T = unknown>(opts?: FinishWfOpts<T>): void;
function abortWf(reason: string, opts?: FinishWfOpts): void;
```

Use them in place of raw `useWfFinished().set({ value: {...} })` whenever
possible — they build the envelope correctly and keep the wire shape
stable across upgrades.

### Terminal data

Domain payload, no transition UI. The client reads `data` on
`@finished` and is responsible for what happens next.

```ts
import { finishWf } from "@atscript/moost-wf";

@Step("invoice-submit-save")
async save(@WorkflowParam("input") input: InvoiceInput) {
  const id = await invoices.insertOne(input);
  finishWf({ data: { ok: true, id } });
}
```

### Message-only

Pure message — no data, no transition. Use when the only outcome is
"tell the user something."

```ts
finishWf({
  message: { level: "success", text: "We've sent a verification email." },
});
```

### Redirect (immediate or auto)

Set `next.trigger` to `"immediate"` for a redirect on mount, or
`"auto"` for a countdown + optional skip button.

```ts
// Immediate — `AsWfFinish` triggers the `navigate` prop on mount, no UI flashes by.
finishWf({
  next: {
    trigger: "immediate",
    action: { type: "redirect", target: "/dashboard", reason: "post-login" },
  },
});

// Auto — countdown ticks down, skip button fires the action immediately.
finishWf({
  message: { level: "success", text: "All set!" },
  next: {
    trigger: "auto",
    timeoutMs: 4000,
    action: { type: "redirect", target: "/dashboard" },
    skipButton: { label: "Go now" },
  },
});
```

`WfAction`'s `reason` field is propagated via `@action` for analytics or
branching. `skipButton.behavior` defaults to `"now"` (fire the action
immediately); set it to `"cancel"` to only clear the timer.

### Manual choice

`trigger: "manual"`. The user picks one of the buttons. Provide either a
`primary` (Enter-key target) or one or more `options`. An empty `manual`
shape with neither `primary` nor `options` produces an unactionable
screen — the renderer expects at least one button.

```ts
finishWf({
  message: { level: "info", text: "Submission queued. What's next?" },
  next: {
    trigger: "manual",
    primary: {
      label: "View submission",
      action: { type: "redirect", target: "/submissions/123" },
    },
    options: [
      { label: "Submit another", action: { type: "redirect", target: "/submit" } },
      { label: "Done", action: { type: "dismiss" } },
    ],
  },
});
```

When `primary` is omitted, all `options` render with equal visual
weight and the first option becomes the Enter-key target.

### Aborted soft-failure

`abortWf(reason, opts?)` sets `aborted: true` plus the reason; the same
`FinishWfOpts` bag lets you attach `data`, a `message`, or a `next`
action that takes the user away from the form.

```ts
import { abortWf } from "@atscript/moost-wf";

abortWf("rate-limited", {
  message: { level: "warn", text: "Too many attempts. Try again in 5 minutes." },
});
```

### Combining shapes

`FinishWfOpts` is one bag — combine `data`, `message`, and `next` as
needed (e.g. `manual` choice with terminal `data` AND a primary button):

```ts
finishWf({
  data: { receiptId: 42 },
  next: {
    trigger: "manual",
    primary: { label: "Print", action: { type: "reload" } },
    options: [{ label: "Done", action: { type: "dismiss" } }],
  },
});
```

## Rendering on the client

`<AsWfForm>` renders the finish screen automatically. The default
behaviour ships in `AsWfFinish` (Tier-2 swappable), wired to
`<AsWfForm>` so consumers get correct rendering without any
template work.

The three triggers:

- **`immediate`** — no DOM is rendered. The action fires on mount.
  Redirects call the `navigate` prop you pass to `<AsWfForm>`; if no
  prop is provided, the component falls back to
  `window.location.assign`. The user sees a screen-reader-only
  "Redirecting…" announcement and that's it.
- **`auto`** — a filled primary CTA (the skip button) whose
  background fills left-to-right with a `bg-black/20` darken overlay
  over `timeoutMs`, with a smaller muted countdown line ("Continuing
  in N…") centered underneath. The button **is** the progress
  indicator — there's no separate progress bar. Clicking it fires the
  action immediately (`behavior: 'now'`, the default) or only clears
  the timer (`behavior: 'cancel'`). The fill is CSS-driven via
  `@keyframes progress-fill` plus a `--progress-duration` custom
  property, so the bar animates smoothly regardless of the JS
  countdown's tick rate. If `skipButton` is omitted from the
  envelope, only the countdown text renders.
- **`manual`** — `message` banner + buttons. The primary button (if
  provided) gets initial focus and is the Enter-key target; options
  render alongside. If no `primary`, the first option is the
  Enter-key target.

## Customizing via slots

`<AsWfForm>` forwards five named scoped slots into `AsWfFinish`. Each
has a working default — override only the pieces you want to
restyle. Every slot scope includes a callback so your custom UI
keeps the action wiring without re-implementing the logic.

| Slot                  | Renders when                                  | Scope                                                                                                                            |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `wf.finished`         | Any finished envelope                         | `{ response, payload }` — full override; ignores the rest of the table                                                           |
| `wf.finish.message`   | `payload.message` is set                      | `{ message: WfMessage }`                                                                                                         |
| `wf.finish.countdown` | `next.trigger === 'auto'`                     | `{ secondsRemaining, totalSeconds, skip, cancel }` — `secondsRemaining` ticks 1/sec (250ms internally; integer transitions only) |
| `wf.finish.skip`      | `next.trigger === 'auto'` + `skipButton`      | `{ button: { label, behavior }, trigger }`                                                                                       |
| `wf.finish.primary`   | `next.trigger === 'manual'` with primary      | `{ button: WfButton, trigger }`                                                                                                  |
| `wf.finish.option`    | `next.trigger === 'manual'` (each option)     | `{ button: WfButton, index: number, trigger }`                                                                                   |

Example — override the primary button with a design-system one,
keeping the trigger contract:

```vue
<AsWfForm path="/api/wf" name="checkout" :types="types" :navigate="navigate">
  <template #wf.finish.primary="{ button, trigger }">
    <MyBrandButton :variant="'filled'" @click="trigger">
      {{ button.label }}
    </MyBrandButton>
  </template>
</AsWfForm>
```

The `trigger` callback runs the action (redirect / reload / dismiss)
exactly as the default button would. Custom UI never needs to
re-implement the redirect-or-emit decision.

## Routing

`redirect` actions go through a `navigate` prop on `<AsWfForm>`. The
prop is a function that receives the target URL — your handler decides
cross-origin vs in-app routing.

```ts
import { useRouter } from "vue-router";
const router = useRouter();
const navigate = (url: string) => router.push(url);
```

```vue
<AsWfForm path="/api/wf" name="checkout" :types="types" :navigate="navigate" />
```

If no `navigate` prop is provided, `AsWfFinish` falls back to
`window.location.assign(url)`. In an SSR or non-browser context with
no prop and no browser `location`, it logs `console.error` and does
nothing — better than crashing the render path.

The same `navigate` handler can be passed to `@atscript/db-client`'s
`Client({ navigate })` option, so one navigation function covers both
workflow redirects and `processor: 'navigate'` DB actions.

## Events

`<AsWfForm>` (and the default `AsWfFinish`) emit two events when an
action runs:

```ts
defineEmits<{
  (e: "dismiss"): void;
  (e: "action", action: WfAction): void;
}>();
```

- **`@dismiss`** — fired for `action.type === 'dismiss'`. The flow
  stays on screen — the consumer decides what to do (close a modal,
  reset state, etc.).

- **`@action`** — fires before every action, including reloads and
  redirects. The `WfAction` payload includes the optional
  `reason` for analytics or telemetry, without intercepting
  navigation.

## Aborted flows

A workflow that calls `abortWf(reason)` still fires `@finished` on the
client — `aborted` and `reason` are exposed on the envelope alongside
`data`. Treat them like a soft-error: render a banner via the `message`
field (if you set one) or branch on `payload.aborted` inside the
`wf.finished` slot for full control.

## Reusing the progress-button primitive

The auto-mode skip button is built on a public `c8-progress` shortcut
family in `@atscript/ui-styles`. The same primitive composes any
"fills then fires" UI — hold-to-confirm CTAs, timed confirmations, any
button you want to double as its own progress indicator. The three
classes:

```html
<button
  class="c8-filled scope-primary c8-progress h-fingertip-m px-$m"
  :style="{ '--progress-duration': '4000ms' }"
>
  <span class="c8-progress-fill" />
  <span class="c8-progress-label">Confirm</span>
</button>
```

- `c8-progress` — adds `relative overflow-hidden`. Layer it on top of
  any `c8-*` base (`c8-filled`, `c8-flat`, `c8-light`).
- `c8-progress-fill` — absolutely-positioned `bg-black/20` overlay
  that animates `width 0% → 100%` over `--progress-duration` via the
  globally-registered `@keyframes progress-fill` (no JS).
- `c8-progress-label` — keeps the label in flow so the button doesn't
  collapse to its padding box. Required.

The keyframes are registered as a UnoCSS preflight by `asPresetVunor`,
so consumers don't have to register anything beyond installing the
preset. See [Styling — the as-\* shortcut system](/styling/shortcuts)
for the broader shortcut tree.

## Reference

- Types and helpers: `packages/moost-wf/src/wf-finished.ts`
- Default component: `packages/vue-wf/src/components/defaults/as-wf-finish.vue`
- Client wiring: `packages/vue-wf/src/components/as-wf-form.vue`

## Where to go next

- [Client: AsWfForm](/workflows/client) — props, emits, full slot
  list, custom fetch.
- [Server-Side Authoring](/workflows/server-authoring) — the
  surrounding decorator stack the helpers plug into.
- [Outlets & Resume](/workflows/outlets-resume) — `{ sent: true }`
  vs. `{ finished: true }` and how the two pause types interact.
