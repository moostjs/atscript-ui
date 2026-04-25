import { Controller } from "moost";
import {
  Authenticate,
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
import { SESSION_COOKIE } from "../auth/session-payload";
import { SessionGuard } from "../auth/session.guard";
import { useSession } from "../auth/use-session";
import type { DemoScope, DemoUserAttrs } from "../auth/arbac-scope";
import { DEMO_ACTION_GROUPS } from "../auth/arbac-policy";

@Controller("auth")
export class AuthController {
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
