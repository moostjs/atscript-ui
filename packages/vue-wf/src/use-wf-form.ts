import type { FormDef } from "@atscript/ui";
import { createFormDef, createFormData } from "@atscript/ui";
import type { TSerializedAnnotatedType } from "@atscript/typescript/utils";
import { deserializeAnnotatedType } from "@atscript/typescript/utils";
import { onMounted, onUnmounted, reactive, ref, shallowRef, type Ref, type ShallowRef } from "vue";

export interface UseWfFormOptions {
  /** HTTP endpoint for the workflow trigger (e.g., '/api/auth/flow') */
  path: string;
  /** Workflow ID to start (e.g., 'auth/login') */
  name: string;
  /** Initial input to send with the start request */
  input?: Record<string, unknown>;
  /**
   * How to transport the workflow state token.
   * - 'body' (default): token travels in request/response JSON body
   * - 'cookie': token travels via Set-Cookie / Cookie headers
   * - 'query': token is read from URL query params (for email magic links)
   */
  tokenTransport?: "body" | "cookie" | "query";
  /** Token parameter name (default: 'wfs') */
  tokenName?: string;
  /** Workflow ID parameter name (default: 'wfid') */
  wfidName?: string;
  /** Custom fetch options (headers, credentials, etc.) */
  fetchOptions?: RequestInit;
  /** Whether to auto-start the workflow on mount (default: true) */
  autoStart?: boolean;
  /**
   * Pre-existing workflow state token to resume from. Use when the token lives
   * outside `window.location.search` — e.g. encoded in a Vue Router path param
   * (`/invite/:token`) or pulled from app state. Included in the first request
   * so the server resumes the paused workflow instead of starting a new one.
   * Takes precedence over `tokenTransport: "query"` auto-detection.
   */
  initialToken?: string;
}

export interface UseWfFormReturn {
  formDef: ShallowRef<FormDef | null>;
  formData: ShallowRef<Record<string, unknown> | null>;
  formContext: ShallowRef<Record<string, unknown>>;
  errors: ShallowRef<Record<string, string>>;
  /** Increments each time the form schema changes — use as :key on AsForm to force remount. */
  formKey: Ref<number>;
  loading: Ref<boolean>;
  finished: Ref<boolean>;
  response: ShallowRef<unknown>;
  error: ShallowRef<unknown>;
  start: (input?: Record<string, unknown>) => Promise<void>;
  submit: (data: unknown) => Promise<void>;
  action: (name: string) => Promise<void>;
  actionWithData: (name: string, data: unknown) => Promise<void>;
  retry: () => Promise<void>;
}

export function useWfForm(options: UseWfFormOptions): UseWfFormReturn {
  const tokenName = options.tokenName ?? "wfs";
  const wfidName = options.wfidName ?? "wfid";
  const transport = options.tokenTransport ?? "body";

  // ── Reactive state (replaced wholesale each round-trip) ────
  const formDef = shallowRef<FormDef | null>(null);
  // Deep reactivity needed: AsForm's field composables mutate nested properties via v-model
  const formData = shallowRef<Record<string, unknown> | null>(null);
  const formContext = shallowRef<Record<string, unknown>>({});
  const errors = shallowRef<Record<string, string>>({});
  const response = shallowRef<unknown>(null);
  const error = shallowRef<unknown>(null);
  const loading = ref(false);
  const finished = ref(false);

  /** Increments each time the form schema changes — used as :key on AsForm to force remount. */
  const formKey = ref(0);

  let token: string | undefined;
  let lastRequestBody: Record<string, unknown> | undefined;
  let lastPayloadJson: string | undefined;
  let abortController: AbortController | undefined;

  // Pre-compute static fetch config once
  const { headers: extraHeaders, ...restFetchOpts } = options.fetchOptions ?? {};
  const mergedHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders instanceof Headers
      ? Object.fromEntries(extraHeaders as unknown as Iterable<[string, string]>)
      : Array.isArray(extraHeaders)
        ? Object.fromEntries(extraHeaders)
        : (extraHeaders as Record<string, string> | undefined)),
  };
  const baseFetchOpts: RequestInit = {
    method: "POST",
    headers: mergedHeaders,
    ...(transport === "cookie" ? { credentials: "include" as RequestCredentials } : {}),
    ...restFetchOpts,
  };

  function readInitialToken(): string | undefined {
    // Explicit prop wins — lets callers seed from path params / app state.
    if (options.initialToken) return options.initialToken;
    if (transport === "query") {
      const params = new URLSearchParams(window.location.search);
      return params.get(tokenName) ?? undefined;
    }
    return undefined;
  }

  function buildBody(payload: Record<string, unknown>): Record<string, unknown> {
    const body = { ...payload };
    if (transport !== "cookie" && token) {
      body[tokenName] = token;
    }
    return body;
  }

  function extractToken(data: Record<string, unknown>): void {
    if (transport !== "cookie" && tokenName in data) {
      token = data[tokenName] as string;
    }
  }

  function processResponse(data: Record<string, unknown>): void {
    extractToken(data);

    if (data.finished) {
      finished.value = true;
      response.value = data;
      formDef.value = null;
      formData.value = null;
      lastPayloadJson = undefined;
      return;
    }

    // Outlet-pause response (e.g. `outletEmail` from moost-wf): the workflow
    // paused waiting for out-of-band resumption (magic link, webhook, etc.).
    // From the current client's perspective their session is complete —
    // someone else will resume via the token. Treat it as finished so
    // consumers get a clean `@finished` signal instead of falling into the
    // "Unexpected response format" branch and re-submitting.
    if (data.sent === true || typeof data.outlet === "string") {
      finished.value = true;
      response.value = data;
      formDef.value = null;
      formData.value = null;
      lastPayloadJson = undefined;
      return;
    }

    if (data.error) {
      error.value = data.error;
      return;
    }

    const ir = data.inputRequired as
      | { payload: unknown; transport: string; context?: Record<string, unknown> }
      | undefined;

    if (!ir) {
      error.value = { message: "Unexpected response format" };
      return;
    }

    const ctx = (ir.context ?? {}) as Record<string, unknown>;
    const { errors: serverErrors, ...remainingCtx } = ctx;

    // Compare serialized payload to detect same-form re-validation.
    // On re-validation the server echoes the same schema with new errors —
    // skip FormDef/FormData rebuild to preserve user-entered values.
    const payloadJson = JSON.stringify(ir.payload);
    if (payloadJson !== lastPayloadJson) {
      lastPayloadJson = payloadJson;
      formKey.value++;
      const type = deserializeAnnotatedType(ir.payload as TSerializedAnnotatedType);
      formDef.value = createFormDef(type);
      formData.value = reactive(createFormData(type)) as Record<string, unknown>;
    }

    formContext.value = remainingCtx;
    errors.value = (serverErrors as Record<string, string>) ?? {};
    finished.value = false;
    error.value = null;
  }

  async function post(body: Record<string, unknown>): Promise<void> {
    abortController?.abort();
    abortController = new AbortController();
    const { signal } = abortController;

    loading.value = true;
    error.value = null;
    lastRequestBody = body;

    try {
      const res = await fetch(options.path, {
        ...baseFetchOpts,
        signal,
        body: JSON.stringify(buildBody(body)),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: res.statusText }));
        error.value = { message: errData.message ?? res.statusText, status: res.status };
        return;
      }

      const data = await res.json();
      processResponse(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      error.value = { message: err instanceof Error ? err.message : "Network error" };
    } finally {
      loading.value = false;
    }
  }

  async function start(input?: Record<string, unknown>): Promise<void> {
    const initialToken = readInitialToken();
    if (initialToken) token = initialToken;

    const body: Record<string, unknown> = { [wfidName]: options.name };
    if (input) body.input = input;
    if (initialToken) body[tokenName] = initialToken;

    await post(body);
  }

  async function submit(data: unknown): Promise<void> {
    await post({ input: data });
  }

  async function action(name: string): Promise<void> {
    await post({ action: name });
  }

  async function actionWithData(name: string, data: unknown): Promise<void> {
    await post({ input: data, action: name });
  }

  async function retry(): Promise<void> {
    if (lastRequestBody) await post(lastRequestBody);
  }

  if (options.autoStart !== false) {
    onMounted(() => start(options.input));
  }

  onUnmounted(() => abortController?.abort());

  return {
    formDef,
    formData,
    formContext,
    errors,
    formKey,
    loading,
    finished,
    response,
    error,
    start,
    submit,
    action,
    actionWithData,
    retry,
  };
}
