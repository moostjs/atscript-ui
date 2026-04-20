import { AuthGuard, HttpError } from "@moostjs/event-http";
import { Inherit, Injectable } from "moost";
import { useSession } from "./use-session";
import { SESSION_COOKIE } from "./session-payload";

@Inherit()
@Injectable()
export class SessionGuard extends AuthGuard<{ cookie: { name: typeof SESSION_COOKIE } }> {
  static transports = { cookie: { name: SESSION_COOKIE } } as const;

  handle() {
    const session = useSession();
    if (!session) throw new HttpError(401, "Not authenticated");
  }
}
