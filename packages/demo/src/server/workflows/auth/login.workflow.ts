import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam, useWfFinished } from "@moostjs/event-wf";
import { usersTable, rolesTable } from "../../db";
import { verifyPassword } from "../../auth/password";
import { SessionService } from "../../auth/session.service";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  type SessionPayload,
} from "../../auth/session-payload";
import { LoginForm, MfaPincodeForm } from "../forms/login-form.as";
import { httpInputRequired } from "../wf-helpers";

export interface LoginCtx {
  userId?: number;
  username?: string;
  email?: string;
  roleId?: number;
  roleName?: SessionPayload["roleName"];
  mfaEnabled?: boolean;
  otpCode?: string;
}

/** Exported for the p6-login-schema.spec.ts unit test. */
export const needsMfa = (ctx: LoginCtx): boolean => !!ctx.mfaEnabled;

@Controller()
export class LoginWorkflow {
  constructor(private readonly sessions: SessionService) {}

  @Workflow("auth/login")
  @WorkflowSchema<LoginCtx>([
    { id: "login-credentials" },
    { id: "login-verify-otp", condition: needsMfa },
    { id: "login-issue-session" },
  ])
  flow() {}

  @Step("login-credentials")
  async enterCredentials(
    @WorkflowParam("input") input: { username?: string; password?: string } | undefined,
    @WorkflowParam("context") ctx: LoginCtx,
  ) {
    if (!input || !input.username || !input.password) {
      return httpInputRequired(LoginForm, ctx);
    }

    const user = (await usersTable.findOne({
      filter: { username: input.username },
    })) as {
      id: number;
      username: string;
      email: string;
      roleId: number;
      password?: string;
      salt?: string;
      mfaEnabled?: boolean;
      status?: string;
    } | null;

    if (!user || !(await verifyPassword(input.password, user.password ?? "", user.salt ?? ""))) {
      return httpInputRequired(LoginForm, ctx, { password: "Invalid username or password" });
    }
    if (user.status === "suspended") {
      return httpInputRequired(LoginForm, ctx, { __form: "Account is suspended" });
    }

    const role = await rolesTable.findOne({ filter: { id: user.roleId } });
    if (!role) {
      return httpInputRequired(LoginForm, ctx, { __form: "User role not found" });
    }

    ctx.userId = user.id;
    ctx.username = user.username;
    ctx.email = user.email;
    ctx.roleId = role.id;
    ctx.roleName = role.name as SessionPayload["roleName"];
    ctx.mfaEnabled = !!user.mfaEnabled;
    if (ctx.mfaEnabled) {
      ctx.otpCode = String(Math.floor(100000 + Math.random() * 900000));
      // Dispatch the OTP inline instead of via `outletEmail` — an email outlet
      // would pause the workflow (the client would see `{sent:true}` instead of the
      // next form). We only want the MFA step to pause for input.
      // eslint-disable-next-line no-console
      console.log(`\n📧 [auth-otp] → ${ctx.email}\n    context: {"code":"${ctx.otpCode}"}\n`);
    }
    return;
  }

  @Step("login-verify-otp")
  verifyOtp(
    @WorkflowParam("input") input: { code?: string } | undefined,
    @WorkflowParam("context") ctx: LoginCtx,
  ) {
    if (!input?.code) {
      return httpInputRequired(MfaPincodeForm, ctx);
    }
    if (input.code !== ctx.otpCode) {
      return httpInputRequired(MfaPincodeForm, ctx, { code: "Invalid code" });
    }
    return;
  }

  @Step("login-issue-session")
  issueSession(@WorkflowParam("context") ctx: LoginCtx) {
    const payload: SessionPayload = {
      userId: ctx.userId!,
      username: ctx.username!,
      roleId: ctx.roleId!,
      roleName: ctx.roleName!,
      issuedAt: Math.floor(Date.now() / 1000),
    };
    const token = this.sessions.encode(payload);
    useWfFinished().set({
      type: "data",
      value: {
        finished: true,
        ok: true,
        user: { username: payload.username, roleName: payload.roleName },
      },
      cookies: {
        [SESSION_COOKIE]: {
          value: token,
          options: {
            httpOnly: true,
            sameSite: "Lax",
            path: "/",
            // wooks treats numeric maxAge as milliseconds; multiply by 1000 so Max-Age in seconds per RFC 6265.
            maxAge: SESSION_MAX_AGE_SEC * 1000,
          },
        },
      },
    });
    return;
  }
}
