import { on401, on403, on410, on500 } from "./error-bus";

const AUTH_SILENT = new Set(["/api/me", "/api/auth/logout", "/api/wf"]);

async function toMessage(res: Response): Promise<string> {
  try {
    const body = (await res.clone().json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    /* not JSON */
  }
  return `${res.status} ${res.statusText}`;
}

export async function sharedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const fire = () => fetch(input, { ...init, credentials: "include" });
  const res = await fire();
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : ((input as Request).url ?? "");
  const path = (() => {
    try {
      return new URL(url, globalThis.location?.origin ?? "http://x").pathname;
    } catch {
      return url;
    }
  })();

  switch (res.status) {
    case 401:
      if (!AUTH_SILENT.has(path)) on401.emit();
      return res;
    case 403: {
      const message = await toMessage(res);
      on403.emit({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message,
      });
      return res;
    }
    case 410:
      on410.emit();
      return res;
    case 500:
    case 502:
    case 503:
    case 504: {
      const message = await toMessage(res);
      on500.emit({ status: res.status, message, retry: fire });
      return res;
    }
    default:
      return res;
  }
}
