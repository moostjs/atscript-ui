import type { FormDef, UiT } from "@atscript/ui";
import { createFormDef, createFormData } from "@atscript/ui";
import { AS_UI_MESSAGES } from "@atscript/ui/messages";
import { useAsTexts } from "@atscript/vue-form/locale";
import type { WfFinished } from "@atscript/moost-wf";
import type { TSerializedAnnotatedType } from "@atscript/typescript/utils";
import { deserializeAnnotatedType } from "@atscript/typescript/utils";
import { onMounted, onUnmounted, reactive, ref, shallowRef, type Ref, type ShallowRef } from "vue";

/**
 * A status with its own friendly text (`UI_WF_STATUS_<status>`: client errors
 * that map to specific user actions, server errors generic but human), else a
 * generic one.
 */
function friendlyMessageForStatus(status: number, t: UiT): string {
  const code = `UI_WF_STATUS_${status}`;
  if (Object.hasOwn(AS_UI_MESSAGES, code)) return t(code);
  if (status >= 500) return t("UI_WF_STATUS_500");
  if (status >= 400) return t("UI_WF_REQUEST_FAILED");
  return t("UI_WF_UNEXPECTED_RESPONSE");
}

/** The `$i18n` texts a form schema in an answer carries (`inputRequired.payload.$i18n`). */
function servedTexts(data: unknown): unknown {
  const ir = (data as { inputRequired?: { payload?: { $i18n?: unknown } } } | null)?.inputRequired;
  return ir?.payload?.$i18n;
}

export interface UseWfFormOptions {
  /** HTTP endpoint for the workflow trigger (e.g., '/api/auth/flow') */
  path: string;
  /** Workflow ID to start (e.g., 'auth/login') */
  name: string;
  /**
   * Initial form data for the start request. Sent as the first request's
   * `input.formData` (the workflow protocol envelope), so the start step
   * reads it with `useWfState().input().formData` — or validated, with
   * unknown keys stripped, via `useAtscriptWf(Form).resolveInput()`.
   */
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
  /**
   * Custom fetch options (headers, credentials, etc.). Requests carry an
   * `Accept-Language` of the locale `provideAsLocale` gives, unless these
   * headers set one.
   */
  fetchOptions?: RequestInit;
  /**
   * Override the global `fetch` — lets the host wire its own status-code
   * bus or interceptors (e.g. a wrapper that emits on `on410` so the app's
   * expiry banner lights up). Defaults to `globalThis.fetch`.
   */
  fetch?: typeof fetch;
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

/** A failed round-trip, as `error` holds it (and `AsWfForm` emits it). */
export interface WfFormError {
  /** Text to show: the answer's `message` (or `error`), else a friendly text for the status. */
  message: string;
  /** HTTP status of a refused request (absent for a network error). */
  status?: number;
  /** The answer's machine-readable `code`, when it has one (e.g. a step's own refusal code). */
  code?: string;
  /** The parsed JSON body of a refused request (`code`, `params`, …), when it has one. */
  body?: unknown;
}

/**
 * A `{ error }` answer as a `WfFormError`: a string is the message; an
 * object keeps its `message` / `status` / `code` and is the `body`.
 */
function bodyError(raw: unknown, t: UiT): WfFormError {
  if (typeof raw === "string") return { message: raw };
  const body =
    typeof raw === "object" && raw !== null
      ? (raw as { message?: unknown; status?: unknown; code?: unknown })
      : undefined;
  const status = typeof body?.status === "number" ? body.status : undefined;
  const failed: WfFormError = {
    message:
      typeof body?.message === "string"
        ? body.message
        : status !== undefined
          ? friendlyMessageForStatus(status, t)
          : t("UI_WF_REQUEST_FAILED"),
  };
  if (status !== undefined) failed.status = status;
  if (typeof body?.code === "string") failed.code = body.code;
  if (body) failed.body = body;
  return failed;
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
  /** Typed envelope on finish — null while running, on outlet pause, or before first response. */
  finishedPayload: ShallowRef<WfFinished | null>;
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
  // The app's locale and UI texts: requests say which language they want, and
  // the texts the server serves for it join the app's dict for that locale.
  const texts = useAsTexts();
  const { t } = texts;

  // ── Reactive state (replaced wholesale each round-trip) ────
  const formDef = shallowRef<FormDef | null>(null);
  // Deep reactivity needed: AsForm's field composables mutate nested properties via v-model
  const formData = shallowRef<Record<string, unknown> | null>(null);
  const formContext = shallowRef<Record<string, unknown>>({});
  const errors = shallowRef<Record<string, string>>({});
  const response = shallowRef<unknown>(null);
  const finishedPayload = shallowRef<WfFinished | null>(null);
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
  // The app's own `Accept-Language` wins over the provided locale.
  const sendsLanguage = new Headers(mergedHeaders).has("accept-language");
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
      // Cast: `finished: true` discriminator gates this branch.
      finishedPayload.value = data as unknown as WfFinished;
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
      // Outlet pause is conceptually finished-for-this-client but isn't a
      // terminal `WfFinished` envelope — keep finishedPayload null.
      finishedPayload.value = null;
      formDef.value = null;
      formData.value = null;
      lastPayloadJson = undefined;
      return;
    }

    if (data.error) {
      error.value = bodyError(data.error, t);
      return;
    }

    const ir = data.inputRequired as
      | { payload: unknown; transport: string; context?: Record<string, unknown> }
      | undefined;

    if (!ir) {
      error.value = { message: t("UI_WF_UNEXPECTED_FORMAT") };
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
    // The locale this request is made in: its served texts belong to it, even
    // when the app has switched locale by the time it answers.
    const locale = texts.locale();
    const headers =
      locale && !sendsLanguage ? { ...mergedHeaders, "Accept-Language": locale } : mergedHeaders;

    try {
      const doFetch = options.fetch ?? fetch;
      const res = await doFetch(options.path, {
        ...baseFetchOpts,
        headers,
        signal,
        body: JSON.stringify(buildBody(body)),
      });

      const data = await res.json().catch(() => null);
      // Served for the locale this request asked for — not when the app sent its own.
      if (!sendsLanguage) texts.merge(locale, servedTexts(data));

      // Always extract token first: a 4xx may carry a fresh wfs handle
      // (HandleStateStrategy single-use handles). Discarding it leaves the
      // form sending a consumed handle on the next submit → permanent 410.
      if (data && typeof data === "object" && !Array.isArray(data)) {
        extractToken(data as Record<string, unknown>);
      }

      if (!res.ok) {
        const errData = data as { error?: string; message?: string; code?: unknown } | null;
        const msg = errData?.message ?? errData?.error ?? friendlyMessageForStatus(res.status, t);
        const failed: WfFormError = { message: msg, status: res.status };
        if (typeof errData?.code === "string") failed.code = errData.code;
        if (data !== null) failed.body = data;
        error.value = failed;
        return;
      }

      if (!data) {
        error.value = { message: t("UI_WF_UNEXPECTED_FORMAT") };
        return;
      }

      processResponse(data as Record<string, unknown>);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      error.value = { message: err instanceof Error ? err.message : t("UI_WF_NETWORK_ERROR") };
    } finally {
      loading.value = false;
    }
  }

  async function start(input?: Record<string, unknown>): Promise<void> {
    const initialToken = readInitialToken();
    if (initialToken) token = initialToken;

    // Dev-only: surface the silent magic-link footgun (URL has ?wfs=… but
    // initialToken was not wired, so the flow restarts instead of resuming).
    if (import.meta.env?.DEV && !initialToken && transport !== "query") {
      const urlToken = new URLSearchParams(window.location.search).get(tokenName);
      if (urlToken) {
        console.warn(
          `[useWfForm] URL contains ?${tokenName}=… but no \`initialToken\` ` +
            `was passed and \`tokenTransport\` is "${transport}". ` +
            `Workflow will start fresh instead of resuming the magic-link flow. ` +
            `Pass \`initial-token="route.query.${tokenName}"\` or set ` +
            `\`tokenTransport: "query"\`.`,
        );
      }
    }

    const body: Record<string, unknown> = { [wfidName]: options.name };
    if (input) body.input = { formData: input };
    if (initialToken) body[tokenName] = initialToken;

    await post(body);
  }

  async function submit(data: unknown): Promise<void> {
    await post({ input: { formData: data } });
  }

  async function action(name: string): Promise<void> {
    await post({ input: { action: name } });
  }

  async function actionWithData(name: string, data: unknown): Promise<void> {
    await post({ input: { action: name, formData: data } });
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
    finishedPayload,
    error,
    start,
    submit,
    action,
    actionWithData,
    retry,
  };
}
