import { defineWook } from "@wooksjs/event-core";
import { useCookies } from "@wooksjs/event-http";
import { decodeSession } from "./session-codec";
import { SESSION_COOKIE, type SessionPayload } from "./session-payload";

export const useSession = defineWook(() => {
  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-me";
  const raw = useCookies().getCookie(SESSION_COOKIE);
  if (!raw) return null;
  return decodeSession<SessionPayload>(raw, secret);
});
