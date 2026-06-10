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
import { getProjectionMode, unionProjections } from "@aooth/arbac";
import { type ArbacDbScope, MoostArbac } from "@aooth/arbac-moost";
import { SESSION_COOKIE } from "../auth/session-payload";
import { SessionGuard } from "../auth/session.guard";
import { useSession } from "../auth/use-session";
import type { DemoUserAttrs } from "../auth/arbac-scope";
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
  "wf_states",
] as const;

type PermEntry = { read: boolean; write: boolean; columns?: string[] };

/**
 * Collapse a list of scope objects into a single `columns` whitelist.
 * - Returns `undefined` when at least one scope grants all columns (no
 *   `projection`, or the union resolves to the universe) — the client side
 *   treats "no columns key" as "no restriction".
 * - Otherwise returns the union of projected columns across all scopes.
 */
function columnsOfScopes(scopes: ArbacDbScope[] | undefined): string[] | undefined {
  if (!scopes || scopes.length === 0) return undefined;
  const union = unionProjections(...scopes.map((s) => s.projection ?? {}));
  if (getProjectionMode(union) !== "include") return undefined;
  return Object.keys(union);
}

/**
 * `/api/me` lives on its own root controller (empty prefix) so that the
 * final route is `/api/me`, not `/api/auth/me`.
 */
@Authenticate(SessionGuard)
@Controller("")
export class MeController {
  constructor(private readonly arbac: MoostArbac<DemoUserAttrs, ArbacDbScope>) {}

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
