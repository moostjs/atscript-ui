import { Controller } from "moost";
import {
  Authenticate,
  Body,
  CookieAttrsRef,
  CookieRef,
  Get,
  HttpError,
  Post,
  SetStatus,
  type TCookieAttributes,
  type TCookieRef,
} from "@moostjs/event-http";
import { SessionService } from "../auth/session.service";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  type SessionPayload,
} from "../auth/session-payload";
import { SessionGuard } from "../auth/session.guard";
import { useSession } from "../auth/use-session";
import { usersTable, rolesTable } from "../db";

interface DevLoginBody {
  username: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly sessions: SessionService) {}

  @Post("dev-login")
  @SetStatus(200)
  async devLogin(
    @Body() body: DevLoginBody,
    @CookieRef(SESSION_COOKIE) cookie: TCookieRef,
    @CookieAttrsRef(SESSION_COOKIE) attrs: { value: TCookieAttributes },
  ) {
    if (!body || typeof body.username !== "string" || !body.username) {
      throw new HttpError(400, "username is required");
    }
    const user = (await usersTable.findOne({ filter: { username: body.username } })) as
      | { id: number; username: string; roleId: number }
      | null;
    if (!user) throw new HttpError(404, `User '${body.username}' not found`);
    const role = (await rolesTable.findOne({ filter: { id: user.roleId } })) as
      | { id: number; name: SessionPayload["roleName"] }
      | null;
    if (!role) throw new HttpError(500, "Role missing for user");
    const payload: SessionPayload = {
      userId: user.id,
      username: user.username,
      roleId: role.id,
      roleName: role.name,
      issuedAt: Math.floor(Date.now() / 1000),
    };
    cookie.value = this.sessions.encode(payload);
    attrs.value = {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      // wooks treats numeric `maxAge` as milliseconds (convertTime/'s' divides by 1000).
      // Multiply seconds by 1000 so the emitted `Max-Age` is in seconds per RFC 6265.
      maxAge: SESSION_MAX_AGE_SEC * 1000,
    };
    return { ok: true, user: payload };
  }

  @Post("logout")
  @SetStatus(200)
  logout(
    @CookieRef(SESSION_COOKIE) cookie: TCookieRef,
    @CookieAttrsRef(SESSION_COOKIE) attrs: { value: TCookieAttributes },
  ) {
    cookie.value = "";
    attrs.value = {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 0,
    };
    return { ok: true };
  }
}

/**
 * `/api/me` lives on its own root controller (empty prefix) so that the
 * final route is `/api/me`, not `/api/auth/me`.
 */
@Authenticate(SessionGuard)
@Controller("")
export class MeController {
  @Get("me")
  me() {
    return useSession();
  }
}
