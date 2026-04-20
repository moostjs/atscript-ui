import { Injectable } from "moost";
import { ArbacUserProvider } from "@moostjs/arbac";
import { useSession } from "./use-session";
import type { DemoUserAttrs } from "./arbac-scope";

/**
 * Demo-specific ARBAC user provider. Reads user identity / roles / attrs
 * from the P2 session cookie. Scoped per-event so every request gets a
 * fresh provider bound to its own session.
 */
@Injectable("FOR_EVENT")
export class DemoArbacUserProvider extends ArbacUserProvider<DemoUserAttrs> {
  override getUserId(): string {
    const s = useSession();
    if (!s) throw new Error("DemoArbacUserProvider: no session");
    return String(s.userId);
  }

  override getRoles(): string[] {
    const s = useSession();
    return s ? [s.roleName] : [];
  }

  override getAttrs(): DemoUserAttrs {
    const s = useSession();
    if (!s) throw new Error("DemoArbacUserProvider: no session");
    return {
      userId: s.userId,
      username: s.username,
      roleName: s.roleName,
    };
  }
}
