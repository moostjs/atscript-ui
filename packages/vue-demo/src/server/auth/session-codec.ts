import { createHmac, timingSafeEqual } from "node:crypto";

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

export function encodeSession(payload: object, secret: string): string {
  const body = b64u(Buffer.from(JSON.stringify(payload)));
  const sig = b64u(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export function decodeSession<T = unknown>(token: string, secret: string): T | null {
  const idx = token.indexOf(".");
  if (idx < 0) return null;
  const body = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expect = createHmac("sha256", secret).update(body).digest();
  const given = fromB64u(sig);
  if (expect.length !== given.length || !timingSafeEqual(expect, given)) return null;
  try {
    return JSON.parse(fromB64u(body).toString("utf8")) as T;
  } catch {
    return null;
  }
}
