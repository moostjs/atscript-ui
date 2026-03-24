import { Controller } from "moost";
import { Post, Body } from "@moostjs/event-http";
import { serializeFormSchema, extractPassContext, getFormActions } from "@atscript/moost-wf";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { LoginForm, MfaPincodeForm, ForgotPasswordForm } from "../../workflows/auth-forms.as";
import { ProfileForm } from "../../workflows/profile-forms.as";

// ── In-memory state (no encryption for the demo) ────────────

interface WfState {
  schemaId: string;
  step: string;
  ctx: Record<string, unknown>;
}

let tokenCounter = 0;
const states = new Map<string, WfState>();

function newToken(state: WfState): string {
  const token = `wf-${++tokenCounter}`;
  states.set(token, state);
  return token;
}

// ── Helpers ──────────────────────────────────────────────────

function inputRequired(
  type: TAtscriptAnnotatedType,
  wfCtx: Record<string, unknown>,
  token: string,
  errors?: Record<string, string>,
) {
  const schema = serializeFormSchema(type);
  const passedContext = extractPassContext(type, wfCtx);
  const context: Record<string, unknown> = { ...passedContext };
  if (errors) context.errors = errors;
  return { inputRequired: { payload: schema, transport: "http", context }, wfs: token };
}

function finished(data: unknown, token?: string) {
  return { finished: true, ...(data as object), wfs: token };
}

// ── Controller ───────────────────────────────────────────────

@Controller("wf")
export class WfDemoController {
  @Post("trigger")
  handleTrigger(@Body() body: Record<string, unknown>) {
    const wfid = body.wfid as string | undefined;
    const wfs = body.wfs as string | undefined;
    const input = body.input as Record<string, unknown> | undefined;
    const action = body.action as string | undefined;

    // Start new workflow
    if (wfid && !wfs) {
      return this.startWorkflow(wfid, input);
    }

    // Resume existing workflow
    if (wfs) {
      const state = states.get(wfs);
      if (!state) return { error: { message: "Workflow expired", status: 410 } };
      states.delete(wfs);
      return this.resumeStep(state, input, action);
    }

    return { error: { message: "Missing wfid or wfs", status: 400 } };
  }

  private startWorkflow(wfid: string, _input?: Record<string, unknown>) {
    switch (wfid) {
      case "auth/login": {
        const state: WfState = { schemaId: "auth/login", step: "login", ctx: {} };
        const token = newToken(state);
        return inputRequired(LoginForm, state.ctx, token);
      }
      case "profile/edit": {
        const state: WfState = {
          schemaId: "profile/edit",
          step: "profile",
          ctx: { draft: null },
        };
        const token = newToken(state);
        return inputRequired(ProfileForm, state.ctx, token);
      }
      default:
        return { error: { message: `Unknown workflow: ${wfid}`, status: 404 } };
    }
  }

  private resumeStep(state: WfState, input?: Record<string, unknown>, action?: string): unknown {
    switch (state.step) {
      case "login":
        return this.handleLogin(state, input, action);
      case "mfa":
        return this.handleMfa(state, input, action);
      case "forgot-password":
        return this.handleForgotPassword(state, input);
      case "profile":
        return this.handleProfile(state, input, action);
      default:
        return { error: { message: `Unknown step: ${state.step}`, status: 500 } };
    }
  }

  // ── Auth flow steps ──────────────────────────────────────

  private handleLogin(state: WfState, input?: Record<string, unknown>, action?: string) {
    // Action: forgot password
    if (action === "forgot-password") {
      state.step = "forgot-password";
      const token = newToken(state);
      return inputRequired(ForgotPasswordForm, state.ctx, token);
    }

    // Validate action
    if (action) {
      const { actions } = getFormActions(LoginForm);
      if (!actions.includes(action)) {
        const token = newToken(state);
        return inputRequired(LoginForm, state.ctx, token, {
          __form: `Action "${action}" is not supported`,
        });
      }
    }

    if (!input) {
      const token = newToken(state);
      return inputRequired(LoginForm, state.ctx, token);
    }

    // Validate credentials
    const { username, password } = input;
    if (username !== "admin" || password !== "password") {
      const token = newToken(state);
      return inputRequired(LoginForm, state.ctx, token, {
        password: "Invalid username or password. Try admin/password",
      });
    }

    // Success → go to MFA
    state.step = "mfa";
    state.ctx.email = "admin@example.com";
    state.ctx.pinTimeout = 120;
    const token = newToken(state);
    return inputRequired(MfaPincodeForm, state.ctx, token);
  }

  private handleMfa(state: WfState, input?: Record<string, unknown>, action?: string) {
    // Action: resend code (stateless — just re-show form)
    if (action === "resend") {
      const token = newToken(state);
      return inputRequired(MfaPincodeForm, state.ctx, token);
    }

    // Action: switch method → back to login
    if (action === "switch-method") {
      state.step = "login";
      state.ctx = {};
      const token = newToken(state);
      return inputRequired(LoginForm, state.ctx, token);
    }

    if (action) {
      const { actions } = getFormActions(MfaPincodeForm);
      if (!actions.includes(action)) {
        const token = newToken(state);
        return inputRequired(MfaPincodeForm, state.ctx, token, {
          __form: `Action "${action}" is not supported`,
        });
      }
    }

    if (!input) {
      const token = newToken(state);
      return inputRequired(MfaPincodeForm, state.ctx, token);
    }

    // Validate code
    if (input.code !== "123456") {
      const token = newToken(state);
      return inputRequired(MfaPincodeForm, state.ctx, token, {
        code: "Invalid code. Try 123456",
      });
    }

    // Success — workflow finished
    return finished({
      user: { username: "admin", email: "admin@example.com" },
      message: "Authentication complete!",
    });
  }

  private handleForgotPassword(state: WfState, input?: Record<string, unknown>) {
    if (!input) {
      const token = newToken(state);
      return inputRequired(ForgotPasswordForm, state.ctx, token);
    }

    // Simulate sending reset link
    return finished({
      message: `Password reset link sent to ${String(input.email)}`,
    });
  }

  // ── Profile flow steps ───────────────────────────────────

  private handleProfile(state: WfState, input?: Record<string, unknown>, action?: string) {
    // Action: save draft (with data, deep-partial)
    if (action === "save-draft") {
      state.ctx.draft = input ?? {};
      state.ctx.draftSaved = true;
      const token = newToken(state);
      return inputRequired(ProfileForm, state.ctx, token);
    }

    if (action) {
      const { actions, actionsWithData } = getFormActions(ProfileForm);
      if (!actions.includes(action) && !actionsWithData.includes(action)) {
        const token = newToken(state);
        return inputRequired(ProfileForm, state.ctx, token, {
          __form: `Action "${action}" is not supported`,
        });
      }
    }

    if (!input) {
      const token = newToken(state);
      return inputRequired(ProfileForm, state.ctx, token);
    }

    // Full submit — save profile
    return finished({
      profile: input,
      message: "Profile saved successfully!",
    });
  }
}
