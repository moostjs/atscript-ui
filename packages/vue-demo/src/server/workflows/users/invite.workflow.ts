import { Controller } from "moost";
import { HttpError } from "@moostjs/event-http";
import {
  Workflow,
  Step,
  StepTTL,
  WorkflowSchema,
  WorkflowParam,
  outletEmail,
  useWfFinished,
  type WfOutletRequest,
} from "@moostjs/event-wf";
import { WfInput, useAtscriptWf, type WfFinished } from "@atscript/moost-wf";
import { usersTable, rolesTable } from "../../db";
import { hashPassword } from "../../auth/password";
import { useSession } from "../../auth/use-session";
import { SessionService } from "../../auth/session.service";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  type SessionPayload,
} from "../../auth/session-payload";
import { InviteStartForm, InviteAcceptForm } from "../forms/invite-form.as";

interface InviteCtx {
  userId?: number;
  email?: string;
  roleId?: number;
  roleName?: SessionPayload["roleName"];
  // Set the first time `invite-send` runs so the step advances on resume
  // instead of re-emitting the email outlet.
  inviteEmailSent?: boolean;
}

// Default 1 day. Tests override via `DEMO_INVITE_TTL_MS` (only honored when
// `DEMO_TEST_MODE=1`) so the magic-link expiry path is testable in real time.
const INVITE_TTL_MS =
  process.env.DEMO_TEST_MODE === "1" && process.env.DEMO_INVITE_TTL_MS
    ? Number(process.env.DEMO_INVITE_TTL_MS)
    : 24 * 60 * 60 * 1000;

@Controller()
export class InviteWorkflow {
  constructor(private readonly sessions: SessionService) {}

  @Workflow("users/invite")
  @WorkflowSchema<InviteCtx>([
    { id: "invite-start" },
    { id: "invite-send" },
    { id: "invite-accept" },
    { id: "invite-issue-session" },
  ])
  flow() {}

  @Step("invite-start")
  async start(
    @WorkflowParam("input") input: { email?: string; roleId?: number } | undefined,
    @WorkflowParam("context") ctx: InviteCtx,
  ) {
    // Admin-only gate. arbac interceptor does not automatically cover WF steps,
    // so assert the session inline.
    const session = useSession();
    if (!session) throw new HttpError(401, "Not authenticated");
    if (session.roleName !== "admin") throw new HttpError(403, "Admin only");

    if (!input || !input.email || input.roleId == null) {
      throw useAtscriptWf(InviteStartForm).requireInput();
    }

    const existing = await usersTable.findOne({ filter: { email: input.email } });
    if (existing) {
      throw new HttpError(409, "A user with that email already exists");
    }

    const role = await rolesTable.findOne({ filter: { id: input.roleId } });
    if (!role) {
      throw useAtscriptWf(InviteStartForm).requireInput({ errors: { roleId: "Invalid role" } });
    }

    const placeholderUsername = `pending-${Date.now().toString(36)}`;
    await usersTable.insertOne({
      username: placeholderUsername,
      email: input.email,
      roleId: role.id,
      status: "invited",
      mfaEnabled: false,
      password: "",
      salt: "",
      profile: { firstName: "", lastName: "" },
    });
    const fresh = await usersTable.findOne({ filter: { username: placeholderUsername } });

    ctx.userId = fresh?.id ?? 0;
    ctx.email = input.email;
    ctx.roleId = role.id;
    ctx.roleName = role.name as SessionPayload["roleName"];
    return;
  }

  @Step("invite-send")
  @StepTTL(INVITE_TTL_MS)
  sendInvite(@WorkflowParam("context") ctx: InviteCtx) {
    // First run: emit the email outlet (engine persists state, sender logs link, flow pauses).
    // Resume run (invitee POSTs with wfs): advance past this step.
    if (ctx.inviteEmailSent) return;
    ctx.inviteEmailSent = true;
    return outletEmail(ctx.email!, "user-invite", {
      userId: ctx.userId,
      roleId: ctx.roleId,
    }) as { inputRequired: WfOutletRequest };
  }

  @Step("invite-accept")
  async acceptInvite(@WfInput() input: InviteAcceptForm, @WorkflowParam("context") ctx: InviteCtx) {
    if (!ctx.userId) throw new HttpError(500, "Invite context missing userId");
    const clash = await usersTable.findOne({ filter: { username: input.username } });
    if (clash && clash.id !== ctx.userId) {
      throw useAtscriptWf(InviteAcceptForm).requireInput({
        errors: { username: "Username already taken" },
      });
    }
    const { hash, salt } = await hashPassword(input.password);
    await usersTable.updateOne({
      id: ctx.userId,
      username: input.username,
      password: hash,
      salt,
      status: "active",
    });
    return;
  }

  @Step("invite-issue-session")
  async issueSession(@WorkflowParam("context") ctx: InviteCtx) {
    const user = await usersTable.findOne({ filter: { id: ctx.userId! } });
    const payload: SessionPayload = {
      userId: user?.id ?? ctx.userId!,
      username: user?.username ?? "",
      roleId: ctx.roleId!,
      roleName: ctx.roleName!,
      issuedAt: Math.floor(Date.now() / 1000),
    };
    const token = this.sessions.encode(payload);
    // Envelope wraps the domain data; cookies remain on the wooks call.
    const envelope: WfFinished<{ ok: boolean; user: { username: string; roleName: string } }> = {
      finished: true,
      data: {
        ok: true,
        user: { username: payload.username, roleName: payload.roleName },
      },
    };
    useWfFinished().set({
      type: "data",
      value: envelope,
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
