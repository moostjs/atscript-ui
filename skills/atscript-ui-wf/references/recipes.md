# recipes

Production-shaped flows assembled from the primitives in the other references. Each recipe: step graph + the one or two wirings that are easy to get wrong. Full walkthroughs: https://ui.atscript.dev/workflows/recipes

## Login + MFA (conditional branch)

```ts
@WorkflowSchema<LoginCtx>([
  { id: "login-credentials" },
  { id: "login-verify-otp", condition: (ctx) => !!ctx.mfaEnabled },
  { id: "login-issue-session" },
])
```

- One `condition` on the middle step changes the flow shape; the other steps don't know it exists.
- Dispatch the OTP **inline** in the credentials step (email/SMS send), NOT via an outlet — an outlet pauses the workflow and the OTP form never ships in the same response.
- Whitelist `@wf.context.pass 'email'` on the OTP form + `@ui.form.fn.title '(data, ctx) => \`Enter the code sent to ${ctx.email}\`'` for a personalized step title.
- Field-level (`{ password: "Invalid credentials" }`) and form-level (`{ __form: "Account suspended" }`) errors via `requireInput({ errors })` re-render the same form without remount — user-typed values stick (SKILL invariant 4).

## Sign-up with email verification (mid-handler validation)

Linear: `register-details` → `verify-otp` → `create-user` → `finish`. No branch; two consecutive forms.

```ts
const wf = useAtscriptWf(RegisterForm);
if (await usersTable.findOne({ filter: { username: input.username } })) {
  throw wf.requireInput({ errors: { username: "Username already taken" } });
}
```

- Uniqueness checks happen **inside the handler** after `@WfInput()` passed schema validation — re-pause with field-specific errors via `throw wf.requireInput({ errors })`.
- Hash the password in step 1, stash `ctx.passwordHash` / `ctx.passwordSalt`, persist in the later create-user step — never re-validated, never re-entered.
- OTP dispatched inline (same reason as login).

## Invite + register (email magic link, two browser sessions)

```ts
@WorkflowSchema<InviteCtx>([
  { id: "invite-start" },         // admin form
  { id: "invite-send" },          // email outlet → pause
  { id: "invite-accept" },        // invitee form (other browser)
  { id: "invite-issue-session" },
])
```

```ts
@Step("invite-send")
@StepTTL(24 * 60 * 60 * 1000)
sendInvite(@WorkflowParam("context") ctx: InviteCtx) {
  if (ctx.inviteEmailSent) return;     // resume re-enters this step — flag makes it a no-op
  ctx.inviteEmailSent = true;
  return outletEmail(ctx.email!, "user-invite", { userId: ctx.userId, roleId: ctx.roleId });
}
```

- Durable state: `HandleStateStrategy` + `AsWfStore` — the link may be clicked tomorrow. See [state.md](state.md).
- Admin's browser sees `{ sent: true }` → `@finished`; the invitee opens `?wfs=<token>` and mounts `<AsWfForm :initial-token="wfs" name="users/invite">` — engine resumes at `invite-send`, the `ctx.inviteEmailSent` guard skips the re-send. See [outlets.md](outlets.md).
- `@StepTTL` bounds the invite lifetime; `wfStore.cleanup()` on a timer reaps expired rows.
- Shadow columns (`@wf.store.fromContext 'email'`, `'roleName'`) mirror context onto the state row so an admin UI can list pending invites without parsing JSON blobs.
- Gate step 1 with an inline session check — auth interceptors don't auto-cover WF steps.

## Multi-step checkout (conditional + save-draft action)

```ts
@WorkflowSchema<CheckoutCtx>([
  { id: "checkout-address" },
  { id: "checkout-payment", condition: (ctx) => ctx.totalCents > 0 }, // skip free carts
  { id: "checkout-confirm" },
])
```

```ts
@Step("checkout-address")
async address(
  @WorkflowParam("context") ctx: CheckoutCtx,
  @WfAction(AddressForm) action: string | undefined,
  @WfInput({ pass: true }) input?: AddressForm,
) {
  const wf = useAtscriptWf(AddressForm);
  if (action === "saveDraft") {
    ctx.draftAddress = input ?? {};
    throw wf.requireInput();   // re-render same form, no errors
  }
  ctx.address = input!;
}
```

- "Save Draft" is an action-with-data (`@wf.action.withData` on the form): deep-partial validated, lands in `input` next to the `action` name; `@WfInput({ pass: true })` keeps the handler alive for the no-full-data path.
- Read-only confirm screen: pass `@wf.context.pass 'cartSummary'` / `'totalCents'` on a fields-less form; `@ui.form.submit.text 'Place Order'` + `@ui.form.fn.title` render the summary from context.
- FK lookups on address fields (`@db.rel.FK`) work through the `clientFactory` prop on `<AsWfForm>` — drop in the same client your forms layer uses.

## Shared toolbox

All four recipes compose: `.as` forms as SSOT → `@WorkflowSchema` (linear / `condition` branch) → `@WfInput` + `useAtscriptWf().requireInput()` (validate / re-render) → `@WfAction` (resend, forgot, save-draft) → `@wf.context.pass` (safe context exposure) → `AsWfStore` + shadow columns (durable state) → `outletEmail` / `outletHttp` (non-form pauses). Pick one recipe, copy its skeleton, swap the forms.

## See also

- [server.md](server.md) — decorator stack, conditions, action handlers, error mapping
- [context.md](context.md) — `@wf.context.pass` whitelist + dynamic titles
- [state.md](state.md) — `AsWfStore`, shadow columns, cleanup/heal
- [outlets.md](outlets.md) — magic-link resume, token transports, `initialToken`
