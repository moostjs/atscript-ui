import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  p: string,
  s: Buffer | string,
  k: number,
) => Promise<Buffer>;

const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16);
  const buf = await scryptAsync(password, salt, KEY_LEN);
  return { hash: buf.toString("hex"), salt: salt.toString("hex") };
}

export async function verifyPassword(
  password: string,
  hashHex: string,
  saltHex: string,
): Promise<boolean> {
  if (!hashHex || !saltHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const buf = await scryptAsync(password, salt, KEY_LEN);
  const expected = Buffer.from(hashHex, "hex");
  if (buf.length !== expected.length) return false;
  return timingSafeEqual(buf, expected);
}
