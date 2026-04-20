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
import { MoostArbac } from "@moostjs/arbac";
import { SessionService } from "../auth/session.service";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  type SessionPayload,
} from "../auth/session-payload";
import { SessionGuard } from "../auth/session.guard";
import { useSession } from "../auth/use-session";
import { usersTable, rolesTable } from "../db";
import type { DemoScope, DemoUserAttrs } from "../auth/arbac-scope";
import { DEMO_ACTION_GROUPS } from "../auth/arbac-policy";

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

const DEMO_RESOURCES = [
  "users",
  "roles",
  "categories",
  "products",
  "customers",
  "orders",
  "audit_log",
] as const;

type PermEntry = { read: boolean; write: boolean; columns?: string[] };

/**
 * Collapse a list of scope objects into a single `columns` whitelist.
 * - Returns `undefined` when at least one scope grants all columns — the
 *   client side treats "no columns key" as "no restriction".
 * - Otherwise returns the union of `columns` across all scopes.
 */
function columnsOfScopes(scopes: DemoScope[] | undefined): string[] | undefined {
  if (!scopes || scopes.length === 0) return undefined;
  if (scopes.some((s) => !s.columns)) return undefined;
  const set = new Set<string>();
  for (const s of scopes) {
    for (const c of s.columns!) set.add(c);
  }
  return Array.from(set);
}

/**
 * `/api/me` lives on its own root controller (empty prefix) so that the
 * final route is `/api/me`, not `/api/auth/me`.
 */
@Authenticate(SessionGuard)
@Controller("")
export class MeController {
  constructor(private readonly arbac: MoostArbac<DemoUserAttrs, DemoScope>) {}

  @Get("me")
  async me() {
    const session = useSession();
    if (!session) throw new HttpError(401, "Not authenticated");

    const attrs: DemoUserAttrs = {
      userId: session.userId,
      username: session.username,
      roleName: session.roleName,
    };
    const user = { id: String(session.userId), roles: [session.roleName], attrs };

    // The arbac policy uses logical-method names as actions (see arbac-policy.ts).
    // Probe with one representative method per action group — `query` for read,
    // `insert` for write — both are gated by the same scope.
    const readAction = DEMO_ACTION_GROUPS.read[0];
    const writeAction = DEMO_ACTION_GROUPS.write[0];

    const permissions: Record<string, PermEntry> = {};
    for (const resource of DEMO_RESOURCES) {
      const readRes = await this.arbac.evaluate({ resource, action: readAction }, user);
      const writeRes = await this.arbac.evaluate({ resource, action: writeAction }, user);
      const entry: PermEntry = {
        read: readRes.allowed,
        write: writeRes.allowed,
      };
      const cols = columnsOfScopes(readRes.scopes);
      if (cols) entry.columns = cols;
      permissions[resource] = entry;
    }

    return { ...session, permissions };
  }
}
