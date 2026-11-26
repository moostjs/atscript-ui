import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { serializeAnnotatedType } from "@atscript/typescript/utils";
import type { Mock } from "vitest";
import { vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount, type MountingOptions } from "@vue/test-utils";
import { useWfForm } from "../use-wf-form";
import type { UseWfFormOptions, UseWfFormReturn } from "../use-wf-form";

// ── Composable host ──────────────────────────────────────────

/** Mounts a component that calls `useWfForm(opts)` and hands back its return. */
export function mountComposable(
  opts: UseWfFormOptions,
  mountOptions?: { global?: MountingOptions<unknown>["global"] },
) {
  let result!: UseWfFormReturn;
  const Comp = defineComponent({
    setup() {
      result = useWfForm(opts);
      return () => h("div");
    },
  });
  const wrapper = mount(Comp, mountOptions);
  return { result, wrapper };
}

// ── Server response builders ─────────────────────────────────

export function mockInputRequired(
  type: TAtscriptAnnotatedType,
  opts?: {
    errors?: Record<string, string>;
    context?: Record<string, unknown>;
    token?: string;
  },
) {
  const schema = serializeAnnotatedType(type);
  const context: Record<string, unknown> = { ...opts?.context };
  if (opts?.errors) context.errors = opts.errors;
  return {
    inputRequired: { payload: schema, transport: "http", context },
    wfs: opts?.token ?? "test-token",
  };
}

export function mockFinished(data?: Record<string, unknown>) {
  return { finished: true, ...data };
}

export function mockError(message: string, status?: number) {
  return { error: { message, status } };
}

// ── window.location stub ─────────────────────────────────────

const originalLocation = window.location;

export function stubLocationSearch(search: string) {
  Object.defineProperty(window, "location", {
    value: { ...originalLocation, search },
    writable: true,
    configurable: true,
  });
}

export function restoreLocation() {
  Object.defineProperty(window, "location", {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
}

// ── Fetch mock ───────────────────────────────────────────────

export function mockFetch(
  responses: Array<Record<string, unknown> | (() => Record<string, unknown>)>,
) {
  let callIndex = 0;
  const calls: Array<{ url: string; init?: RequestInit; body: unknown }> = [];

  const fakeFetch = vi.fn(async (url: string, init?: RequestInit) => {
    const resp = responses[callIndex++];
    const data = typeof resp === "function" ? resp() : resp;
    calls.push({ url, init, body: init?.body ? JSON.parse(init.body as string) : undefined });
    return { ok: true, json: async () => data } as Response;
  }) as Mock;

  vi.stubGlobal("fetch", fakeFetch);

  return { calls, fetchMock: fakeFetch };
}

export function mockFetchError(status: number, message: string) {
  const calls: Array<{ url: string; body: unknown }> = [];

  const fakeFetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined });
    return {
      ok: false,
      status,
      statusText: message,
      json: async () => ({ message }),
    } as unknown as Response;
  }) as Mock;

  vi.stubGlobal("fetch", fakeFetch);

  return { calls, fetchMock: fakeFetch };
}
