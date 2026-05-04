import { AsPresetsController } from "@atscript/moost-ui-presets";
import { TableController } from "@atscript/moost-db";
import { Authenticate, HttpError } from "@moostjs/event-http";
import { presetsTable } from "../db";
import { useSession } from "../auth/use-session";
import { SessionGuard } from "../auth/session.guard";

/**
 * Demo preset controller. Plugs the demo session into the Phase-1 controller's
 * `getCurrentUser()` extension point so writes are stamped from the cookie
 * and reads are gated to the current user + public rows.
 *
 * Role policy:
 *   - Read gate: every signed-in user sees their own rows + any `public:true`
 *     row in the same `(app, tableKey)` (handled by the base controller).
 *   - Saving private presets: any role, capped at `maxPresetsPerUser` (10).
 *   - Saving public presets: admins only — `canPublishPresets()` returns
 *     `false` for `manager` / `viewer` so the toggle is hidden client-side
 *     (capabilities query) and a 403 is raised if the wire still attempts it.
 *     Already-public rows are grandfathered (the base only gates
 *     `private → public` transitions).
 */
@Authenticate(SessionGuard)
@TableController(presetsTable, "db/_presets")
export class PresetsController extends AsPresetsController {
  protected async getCurrentUser(): Promise<string> {
    const session = useSession();
    if (!session?.userId) throw new HttpError(401, "Not authenticated");
    return String(session.userId);
  }

  protected async canPublishPresets(): Promise<boolean> {
    const session = useSession();
    return session?.roleName === "admin";
  }

  protected async getUserLabel(): Promise<string | undefined> {
    // Source of truth for "by alice" attribution on public presets. Read
    // straight from the session — the cookie carries `username` so we don't
    // need a roundtrip to the users table on every preset write.
    const session = useSession();
    return session?.username;
  }
}
