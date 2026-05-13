---
outline: deep
---

# Recipes

Production-shaped flows built from the primitives in the preceding
pages.

## Login + MFA

The canonical conditional-branch flow. Three steps; the middle one
runs only if the user has MFA enabled.

**What's interesting:**

- One `condition: needsMfa` on a single step changes the flow shape
  without touching the other steps.
- The OTP code is dispatched **inline** (`console.log` in the demo;
  email/SMS in production) — _not_ via the email outlet — because
  emitting an outlet would pause the workflow and prevent the next
  form from rendering in the same response.
- The OTP form whitelists `email` via `@wf.context.pass` so the
  title can read "Enter the code sent to alice@example.com".
- Field-level error (`{ password: "Invalid credentials" }`) and
  form-level error (`{ __form: "Account is suspended" }`) both
  re-render the same form without remounting; user-typed values
  stick.

**Sketch:**

```ts
@WorkflowSchema<LoginCtx>([
  { id: "login-credentials" },
  { id: "login-verify-otp", condition: (ctx) => !!ctx.mfaEnabled },
  { id: "login-issue-session" },
])
```

```atscript
@wf.context.pass 'email'
@meta.label 'Verify Identity'
@ui.form.fn.title '(data, ctx) => `Enter the code sent to ${ctx.email}`'
export interface MfaPincodeForm {
    @meta.required 'Code is required'
    @expect.minLength 6, '6 digits expected'
    code: string
}
```

See [Server-Side Authoring](/workflows/server-authoring) and
[Context Passing](/workflows/context) for the full mechanics.

## Sign-up with email verification

A linear four-step flow that combines server-side uniqueness checks
with OTP verification.

**What's interesting:**

- Two consecutive forms (`RegisterForm`, then `OtpForm`) — same
  pattern as login, no condition branch.
- The first step does **mid-handler validation**: checks the DB
  for an existing username/email and re-pauses with field-specific
  errors (`{ email: "Email already registered" }`).
- The password is hashed in step 1 (`enterDetails`), stored in
  `ctx.passwordHash`/`ctx.passwordSalt`, and persisted into the
  user row in step 3 (`createUser`) — never re-validated, never
  re-entered.
- Like login, OTP is dispatched inline so the next form ships in
  the same response.

**Sketch:**

```ts
@Step("register-details")
async enterDetails(
  @WorkflowParam("input") input: { username?: string; email?: string; password?: string } | undefined,
  @WorkflowParam("context") ctx: RegisterCtx,
) {
  if (!input || !input.username || !input.email || !input.password) {
    return httpInputRequired(RegisterForm, ctx);
  }

  if (await usersTable.findOne({ filter: { username: input.username } })) {
    return httpInputRequired(RegisterForm, ctx, { username: "Username already taken" });
  }
  if (await usersTable.findOne({ filter: { email: input.email } })) {
    return httpInputRequired(RegisterForm, ctx, { email: "Email already registered" });
  }

  const pw = await hashPassword(input.password);
  ctx.username = input.username;
  ctx.email = input.email;
  ctx.passwordHash = pw.hash;
  ctx.passwordSalt = pw.salt;
  ctx.otpCode = String(Math.floor(100000 + Math.random() * 900000));
  // ... send OTP inline ...
  return;
}
```

See [Form Input & Validation](/workflows/form-input) for the
re-pause-with-errors mechanics.

## Invite + register (email magic link)

The flagship outlet flow. Two browser sessions, one workflow.

**What's interesting:**

- Uses `HandleStateStrategy` + `AsWfStore` for durable state —
  the magic link might be clicked tomorrow.
- Step 2 (`invite-send`) emits an email outlet; the admin's
  browser sees `{ sent: true }` and the flow pauses.
- The invitee clicks the link `https://app/invite?wfs=<uuid>`,
  the SPA mounts `<AsWfForm :initial-token="wfs" name="users/invite">`,
  and the engine resumes at `invite-send` (which `return`s thanks
  to the `ctx.inviteEmailSent` flag).
- `@StepTTL(24 * 60 * 60 * 1000)` puts a 24-hour expiry on the
  invite — `wfStore.cleanup()` reaps expired rows on a timer.
- Shadow columns (`@wf.store.fromContext 'email'`, `'roleName'`)
  mirror context onto the row so an admin UI can list "pending
  invites for alice@example.com" without scanning JSON blobs.
- Admin gate on step 1: inline `useSession()` check — arbac
  interceptors don't auto-cover WF steps.

**Sketch:**

```ts
@Workflow("users/invite")
@WorkflowSchema<InviteCtx>([
  { id: "invite-start" },        // admin form
  { id: "invite-send" },          // email outlet → pause
  { id: "invite-accept" },        // invitee form
  { id: "invite-issue-session" },// finish, set cookie
])
flow() {}

@Step("invite-send")
@StepTTL(24 * 60 * 60 * 1000)
sendInvite(@WorkflowParam("context") ctx: InviteCtx) {
  if (ctx.inviteEmailSent) return;
  ctx.inviteEmailSent = true;
  return outletEmail(ctx.email!, "user-invite", { userId: ctx.userId, roleId: ctx.roleId });
}
```

```atscript
import { AsWfStateRecord } from '@atscript/moost-wf/store'

@db.table 'wf_states'
export interface WfStateRow extends AsWfStateRecord {
    @meta.id @db.default.uuid
    id: string

    @meta.label 'Invite Email'
    @wf.store.fromContext 'email'
    @db.index.plain 'email_idx'
    inviteEmail?: string

    @meta.label 'Invite Role'
    @wf.store.fromContext 'roleName'
    @db.index.plain 'role_idx'
    inviteRole?: string
}
```

The invitee side:

```vue
<script setup lang="ts">
import { useRoute } from "vue-router";
import { AsWfForm } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";

const route = useRoute();
const wfs = route.query.wfs as string;
const types = createDefaultTypes();
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

See [Outlets & Resume](/workflows/outlets-resume) and
[State Persistence](/workflows/state-persistence) for the full
pattern.

## Multi-step checkout

Skeleton for an e-commerce checkout: collect address, payment,
confirm. Conditional payment step if the cart is not free.

**What's interesting:**

- Three forms in a row, each with its own validation. The first
  pulls country / state lists via the FK value-help mechanism
  (`@db.rel.FK` on the address fields → AsRef component).
- Payment step is **conditional** — skipped if `ctx.totalCents === 0`
  (free promo, gift, …) — same single-line predicate as the MFA
  branch.
- The confirm form is read-only: render the cart summary with
  context-passed values (`@wf.context.pass 'cartSummary'`,
  `@wf.context.pass 'totalCents'`), no editable fields, just one
  "Place order" submit.
- Action with data: a "Save Draft" button on the address step
  posts whatever's been typed so far (deep-partial validated)
  to `ctx.draftAddress`, lets the user come back later.
- Durable state strategy (`HandleStateStrategy`) so abandoned
  carts can be resumed by email.

**Sketch:**

```ts
interface CheckoutCtx {
  cartId: number;
  totalCents: number;
  address?: AddressInput;
  payment?: PaymentToken;
  draftAddress?: Partial<AddressInput>;
  cartSummary?: { items: Array<{ name: string; qty: number; cents: number }> };
}

@Workflow("checkout/place-order")
@WorkflowSchema<CheckoutCtx>([
  { id: "checkout-address" },
  { id: "checkout-payment", condition: (ctx) => ctx.totalCents > 0 },
  { id: "checkout-confirm" },
])
flow() {}

@Step("checkout-address")
async address(
  @FormInput() form: TFormInput<AddressForm>,
  @AltAction() action: string | undefined,
  @WorkflowParam("context") ctx: CheckoutCtx,
) {
  if (action === "saveDraft") {
    ctx.draftAddress = form.data() ?? {};
    throw form.requireInput(); // re-render same form, no errors
  }
  ctx.address = form.data()!;
  return;
}
```

```atscript
@wf.context.pass 'cartSummary'
@wf.context.pass 'totalCents'
@meta.label 'Confirm Order'
@ui.form.submit.text 'Place Order'
@ui.form.fn.title '(data, ctx) => `Total: $${(ctx.totalCents / 100).toFixed(2)}`'
export interface ConfirmForm {
    // Read-only fields rendered from context, or just no fields at all
    // and a custom #form.before slot that shows the cart summary.
}
```

The "address with FK lookups" relies on
[Forms / Field Types](/forms/field-types) and the `clientFactory`
prop on `<AsWfForm>` — drop in the same client your forms layer
uses elsewhere.

## Putting it together

All four recipes share the same toolbox:

- `.as` types as the single source of truth.
- `@WorkflowSchema` for linear or branched flow shape.
- `@FormInput` + `requireInput` for validation + re-render-same-form.
- `@AltAction` for plain actions (resend, forgot, save draft).
- `@wf.context.pass` for safe context exposure.
- `AsWfStore` + shadow columns when state has to outlive the
  request.
- `outletEmail` / `outletHttp` / custom outlets for non-form
  pauses.

Pick one recipe, copy its skeleton, swap out the forms.

## Where to go next

- [Hello World](/workflows/hello-world) — strip every recipe down
  to two steps to see the moving parts.
- [Server-Side Authoring](/workflows/server-authoring) — the
  decorator stack reference.
- [Client: AsWfForm](/workflows/client) — the full client API.
