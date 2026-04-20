import { Controller } from "moost";
import {
  Workflow,
  Step,
  WorkflowSchema,
  WorkflowParam,
  useWfFinished,
} from "@moostjs/event-wf";
import { usersTable, rolesTable } from "../../db";
import { hashPassword } from "../../auth/password";
import { SessionService } from "../../auth/session.service";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  type SessionPayload,
} from "../../auth/session-payload";
import { RegisterForm, OtpForm } from "../forms/register-form.as";
import { httpInputRequired } from "../wf-helpers";

interface RegisterCtx {
  username?: string;
  email?: string;
  passwordHash?: string;
  passwordSalt?: string;
  otpCode?: string;
  userId?: number;
  roleId?: number;
  roleName?: SessionPayload["roleName"];
}

@Controller()
export class RegisterWorkflow {
  constructor(private readonly sessions: SessionService) {}

  @Workflow("auth/register")
  @WorkflowSchema<RegisterCtx>([
    { id: "register-details" },
    { id: "register-verify-otp" },
    { id: "register-create-user" },
    { id: "register-issue-session" },
  ])
  flow() {}

  @Step("register-details")
  async enterDetails(
    @WorkflowParam("input")
    input: { username?: string; email?: string; password?: string } | undefined,
    @WorkflowParam("context") ctx: RegisterCtx,
  ) {
    if (!input || !input.username || !input.email || !input.password) {
      return httpInputRequired(RegisterForm, ctx);
    }

    const existingUsername = (await usersTable.findOne({
      filter: { username: input.username },
    })) as { id: number } | null;
    if (existingUsername) {
      return httpInputRequired(RegisterForm, ctx, { username: "Username already taken" });
    }
    const existingEmail = (await usersTable.findOne({
      filter: { email: input.email },
    })) as { id: number } | null;
    if (existingEmail) {
      return httpInputRequired(RegisterForm, ctx, { email: "Email already registered" });
    }

    const pw = await hashPassword(input.password);
    ctx.username = input.username;
    ctx.email = input.email;
    ctx.passwordHash = pw.hash;
    ctx.passwordSalt = pw.salt;
    ctx.otpCode = String(Math.floor(100000 + Math.random() * 900000));
    // Dispatch OTP inline — using outletEmail would pause the workflow and the
    // client would receive `{sent:true}` instead of the next form.
    // eslint-disable-next-line no-console
    console.log(
      `\n📧 [register-otp] → ${ctx.email}\n    context: {"code":"${ctx.otpCode}"}\n`,
    );
    return;
  }

  @Step("register-verify-otp")
  verifyOtp(
    @WorkflowParam("input") input: { code?: string } | undefined,
    @WorkflowParam("context") ctx: RegisterCtx,
  ) {
    if (!input?.code) {
      return httpInputRequired(OtpForm, ctx);
    }
    if (input.code !== ctx.otpCode) {
      return httpInputRequired(OtpForm, ctx, { code: "Invalid code" });
    }
    return;
  }

  @Step("register-create-user")
  async createUser(@WorkflowParam("context") ctx: RegisterCtx) {
    // Self-registered users → role 'viewer', status 'active'.
    const role = (await rolesTable.findOne({ filter: { name: "viewer" } })) as
      | { id: number; name: SessionPayload["roleName"] }
      | null;
    if (!role) throw new Error("viewer role missing");

    await usersTable.insertOne({
      username: ctx.username!,
      email: ctx.email!,
      roleId: role.id,
      status: "active",
      mfaEnabled: false,
      password: ctx.passwordHash,
      salt: ctx.passwordSalt,
    });

    const fresh = (await usersTable.findOne({ filter: { username: ctx.username! } })) as
      | { id: number }
      | null;
    ctx.userId = fresh?.id ?? 0;
    ctx.roleId = role.id;
    ctx.roleName = role.name;
    return;
  }

  @Step("register-issue-session")
  issueSession(@WorkflowParam("context") ctx: RegisterCtx) {
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
            maxAge: SESSION_MAX_AGE_SEC * 1000,
          },
        },
      },
    });
    return;
  }
}
