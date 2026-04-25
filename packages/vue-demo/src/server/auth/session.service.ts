import { Injectable } from "moost";
import { encodeSession } from "./session-codec";
import type { SessionPayload } from "./session-payload";

@Injectable("SINGLETON")
export class SessionService {
  readonly secret = process.env.SESSION_SECRET ?? "dev-secret-change-me";

  encode(payload: SessionPayload) {
    return encodeSession(payload, this.secret);
  }
}
