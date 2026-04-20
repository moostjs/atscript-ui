export const SESSION_COOKIE = "demo.sid";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: number;
  username: string;
  roleId: number;
  roleName: "admin" | "manager" | "viewer";
  issuedAt: number; // unix seconds
}
