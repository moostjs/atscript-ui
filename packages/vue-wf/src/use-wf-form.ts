import type { FormDef, UiT } from "@atscript/ui";
import { createFormDef, createFormData, deserializeServedType } from "@atscript/ui";
import { AS_UI_MESSAGES } from "@atscript/ui/messages";
import { useAsTexts } from "@atscript/vue-form/locale";
import type { WfFinished } from "@atscript/moost-wf";
import type { TSerializedAnnotatedType } from "@atscript/typescript/utils";
import {
  getCurrentInstance,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  shallowRef,
  type Ref,
  type ShallowRef,
} from "vue";
import { sessionRunEntry } from "./session-run";

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

/** What `useWfForm` reads off an app's Vue Router (`$router`), without depending on it. */
interface RouterLike {
  currentRoute?: {
    value?: { matched?: ReadonlyArray<{ path?: string }>; params?: Record<string, unknown> };
  };
}

/**
 * A route pattern with its params filled in (`/projects/:id/setup` →
 * `/projects/42/setup`), leaving out a param that holds the link, so the page
 * stays the same when the link leaves the URL (`/invite/:token?` → `/invite`).
 */
function fillRoutePattern(
  pattern: string,
  params: Record<string, unknown>,
  link: string | undefined,
): string {
  const filled = pattern.replace(/:(\w+)(?:\([^)]*\))?[?*+]?/g, (_, name: string) => {
    const value = params[name];
    const text = Array.isArray(value) ? value.join("/") : typeof value === "string" ? value : "";
    return text === link ? "" : text;
  });
  return filled.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1");
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
   * Takes precedence over `tokenTransport: "query"` auto-detection. `start()`
   * sends it until a request carrying it is answered, or after its value
   * changes; otherwise the run's current token (none once the run is over).
   */
  initialToken?: string;
  /**
   * `"session"`: keep the run's token in this tab's `sessionStorage` (one entry
   * per workflow, `{ link, token }`), so a reload resumes the run while the
   * token stays out of the URL and the history. The saved token wins over no
   * link or the same link; a different link starts from itself. The entry is
   * written on every token change and removed when the run is over (and on a
   * `410` of a run that did not start from a link); storage errors leave the run
   * in memory and the link in the URL. With cookie transport nothing is stored
   * (the cookie survives a reload): only the link is dropped. Off by default.
   */
  persistToken?: "session";
  /**
   * `sessionStorage` key for `persistToken`. Default `wf:<page>:<name>`, the page
   * being the Vue Router route pattern with its params filled in, except one
   * holding the link (`/projects/42/setup`, `/invite`); else `location.pathname`,
   * which cannot tell a path-param link apart (set the key there). Set it also
   * for two runs of one workflow on a page.
   */
  persistTokenKey?: string;
  /**
   * Called once the link (`initialToken`, or the URL's with `tokenTransport:
   * "query"`) is no longer needed: the server has answered it and the run is
   * held elsewhere (the saved entry with `persistToken`, the cookie after a
   * successful answer or a `410`). Remove the link from the URL here (e.g.
   * `router.replace`). Without it, `persistToken` in an app with no Vue Router
   * removes `?<tokenName>=` via `history.replaceState`.
   */
  onLinkUsed?: () => void;
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
  /**
   * The state token the next request sends: the start token (with
   * `persistToken` the saved run's, else `initialToken` or the URL's with
   * `tokenTransport: "query"`), then each answer's `wfs` —
   * refused answers included. `undefined` once the run is over for this client:
   * a finish, or an outlet pause whose answer carries no `wfs` (the token went
   * out of band, e.g. in an email). Always `undefined` with cookie transport.
   */
  token: Readonly<Ref<string | undefined>>;
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

  // `persistToken`: the run's token lives in this tab's sessionStorage, never in
  // the URL. Cookie transport stores nothing (the cookie survives a reload); the
  // link is still dropped from the URL once answered.
  const persist = options.persistToken === "session";
  const router = getCurrentInstance()?.appContext.config.globalProperties.$router as
    | RouterLike
    | undefined;
  const entry =
    persist && transport !== "cookie"
      ? sessionRunEntry(options.persistTokenKey ?? defaultRunKey())
      : undefined;
  // The link (`initialToken`, or the URL's) is used up once the server has answered
  // a request sent while it was present: `start()` then sends the run's own token,
  // which the server may have rotated.
  let answeredLink: string | undefined;
  let pendingLink: string | undefined;
  /** Answered, but kept in the URL until the run is held elsewhere. */
  let linkToDrop: string | undefined;
  /** The link the current run started from — saved along with its token. */
  let runLink: string | undefined;
  /** Whether the last write of the entry went through (no entry: nothing to hold). */
  let runSaved = true;

  // Seeded with the start token, so a watcher sees only the changes the run makes.
  // Cookie transport holds none: the httpOnly cookie is the token.
  const token = ref(transport === "cookie" ? undefined : startTokenFor(readInitialToken()));
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
    // Also read at setup, where SSR has no window.
    if (transport === "query" && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get(tokenName) ?? undefined;
    }
    return undefined;
  }

  /**
   * The token a start sends: the saved run's, when there is no link or the same
   * link (it may have been renewed since); else the link until it is answered.
   */
  function startTokenFor(link: string | undefined): string | undefined {
    const run = entry?.load();
    if (run && (!link || run.link === link)) {
      runLink = run.link;
      return run.token;
    }
    runLink = link;
    return link !== answeredLink ? link : undefined;
  }

  /**
   * `wf:<page>:<name>`: two pages running one workflow (an admin page, an
   * invitee's link page; project 1's and project 2's setup) never share a run.
   * The page is the route pattern with its params filled in except the link's
   * (stable when a path-param link leaves the URL), else the pathname.
   */
  function defaultRunKey(): string {
    const route = router?.currentRoute?.value;
    const pattern = route?.matched?.[route.matched.length - 1]?.path;
    const page =
      pattern === undefined
        ? typeof window === "undefined"
          ? ""
          : window.location.pathname
        : fillRoutePattern(pattern, route?.params ?? {}, readInitialToken());
    return `wf:${page}:${options.name}`;
  }

  function setToken(next: unknown): void {
    if (transport === "cookie") return;
    token.value = typeof next === "string" && next ? next : undefined;
    if (entry)
      runSaved = entry.save(token.value ? { link: runLink, token: token.value } : undefined);
  }

  /**
   * After an answer: the link sent with the request is used up — except a refused
   * request with cookie transport (no cookie was set: the link is still the only
   * copy; a 410 means it is dead anyway). It leaves the URL once the run is held
   * elsewhere: by the cookie, or by a saved entry (a failed save keeps it there).
   */
  function afterAnswer(usedLink: string | undefined, res: Response): void {
    if (usedLink) {
      if (transport === "cookie" && !res.ok && res.status !== 410) {
        pendingLink = usedLink;
      } else {
        answeredLink = usedLink;
        linkToDrop = usedLink;
      }
    }
    if (linkToDrop && (transport === "cookie" || runSaved)) {
      const link = linkToDrop;
      linkToDrop = undefined;
      linkUsed(link);
    }
  }

  /** The link is no longer needed: take it out of the URL. */
  function linkUsed(link: string): void {
    if (options.onLinkUsed) {
      try {
        options.onLinkUsed();
      } catch (err) {
        // The answer stays good: a throwing handler only leaves the link in the URL.
        if (import.meta.env?.DEV) console.error("[useWfForm] onLinkUsed threw:", err);
      }
      return;
    }
    if (!persist || typeof window === "undefined") return;
    if (router) {
      if (import.meta.env?.DEV) {
        console.warn(
          "[useWfForm] persistToken: the link token stays in the URL — pass `onLinkUsed` " +
            "(`@link-used` on <AsWfForm>) and remove it with your router.",
        );
      }
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get(tokenName) !== link) return;
    url.searchParams.delete(tokenName);
    history.replaceState(history.state, "", url);
  }

  function buildBody(payload: Record<string, unknown>): Record<string, unknown> {
    const body = { ...payload };
    if (token.value) {
      body[tokenName] = token.value;
    }
    return body;
  }

  function extractToken(data: Record<string, unknown>): void {
    if (tokenName in data) setToken(data[tokenName]);
  }

  /** The run is over for this client: a finish, or an outlet pause. */
  function endRun(data: Record<string, unknown>, payload: WfFinished | null): void {
    finished.value = true;
    response.value = data;
    finishedPayload.value = payload;
    formDef.value = null;
    formData.value = null;
    lastPayloadJson = undefined;
    // Nothing left to send — unless the answer hands this client a token to
    // resume with (an in-band pause, e.g. `outletHttp({ outlet: "awaiting-payment" })`).
    if (!(tokenName in data)) setToken(undefined);
  }

  function processResponse(data: Record<string, unknown>): void {
    if (data.finished) {
      // Cast: `finished: true` discriminator gates this branch.
      endRun(data, data as unknown as WfFinished);
      return;
    }

    // Outlet-pause response (e.g. `outletEmail` from moost-wf): the workflow
    // paused waiting for out-of-band resumption (magic link, webhook, etc.).
    // From the current client's perspective their session is complete —
    // someone else will resume via the token. Treat it as finished so
    // consumers get a clean `@finished` signal instead of falling into the
    // "Unexpected response format" branch and re-submitting.
    if (data.sent === true || typeof data.outlet === "string") {
      // Outlet pause is conceptually finished-for-this-client but isn't a
      // terminal `WfFinished` envelope — keep finishedPayload null.
      endRun(data, null);
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
      // Served translated when it carries `$i18n`: the form does not translate it again.
      const type = deserializeServedType(ir.payload as TSerializedAnnotatedType);
      formDef.value = createFormDef(type);
      formData.value = reactive(createFormData(type)) as Record<string, unknown>;
    }

    formContext.value = remainingCtx;
    errors.value = (serverErrors as Record<string, string>) ?? {};
    finished.value = false;
    error.value = null;
  }

  /** The request in flight (it settles, never rejects). */
  let inFlight: Promise<void> | undefined;

  async function post(body: Record<string, unknown>): Promise<void> {
    const request = send(body);
    inFlight = request;
    try {
      await request;
    } finally {
      if (inFlight === request) inFlight = undefined;
    }
  }

  /**
   * Cookie transport: a start sends `{ wfid }` with the cookie, and a cookie whose
   * state an in-flight request has just consumed reads as no token — the server
   * would start a second run (aborting the fetch does not stop the server). So a
   * start waits for that request to settle instead of aborting it.
   */
  async function settleInFlight(): Promise<void> {
    const request = inFlight;
    if (!request) return;
    await request;
    // Another request may have begun meanwhile: wait for that one too.
    return settleInFlight();
  }
  const startWaits = (): boolean => transport === "cookie" && inFlight !== undefined;

  async function send(body: Record<string, unknown>): Promise<void> {
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
      const usedLink = pendingLink;
      pendingLink = undefined;

      const data = await res.json().catch(() => null);
      // Served for the locale this request asked for — not when the app sent its own.
      if (!sendsLanguage) texts.merge(locale, servedTexts(data));

      // Always extract token first: a 4xx may carry a fresh wfs handle
      // (HandleStateStrategy single-use handles). Discarding it leaves the
      // form sending a consumed handle on the next submit → permanent 410.
      if (data && typeof data === "object" && !Array.isArray(data)) {
        extractToken(data as Record<string, unknown>);
      }
      afterAnswer(usedLink, res);

      if (!res.ok) {
        // A dead run that no link can bring back: don't resend it on every reload.
        if (res.status === 410 && entry && !runLink) entry.save(undefined);
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
    if (startWaits()) await settleInFlight();
    const link = readInitialToken();
    // The saved run's token, or the link until it is answered (a changed value
    // is a new link). Otherwise the run's own token goes: none once it is over.
    const startToken = startTokenFor(link);
    // With `persistToken` this saves it before the first request.
    if (startToken) setToken(startToken);
    pendingLink = link !== answeredLink ? link : undefined;

    // Dev-only: surface the silent magic-link footgun (URL has ?wfs=… but
    // initialToken was not wired, so the flow restarts instead of resuming).
    if (import.meta.env?.DEV && !link && transport !== "query") {
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
    // `buildBody` adds the token; with cookie transport the start token rides
    // the body (the cookie carries the run after the first answer).
    if (startToken && transport === "cookie") body[tokenName] = startToken;

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
    if (lastRequestBody && wfidName in lastRequestBody && startWaits()) await settleInFlight();
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
    token,
    start,
    submit,
    action,
    actionWithData,
    retry,
  };
}
