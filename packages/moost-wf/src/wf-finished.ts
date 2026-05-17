import { useWfFinished as wooksUseWfFinished } from "@wooksjs/event-wf";

// ── Types ───────────────────────────────────────────────────────

export interface WfFinished<TData = unknown> {
  finished: true;
  data?: TData;
  message?: WfMessage;
  end?: WfFinishedEnd;
  aborted?: boolean;
  reason?: string;
}

export interface WfMessage {
  level: "info" | "success" | "warn" | "error";
  text: string;
}

export type WfFinishedEnd =
  | { mode: "immediate"; action: WfAction }
  | {
      mode: "auto";
      timeoutMs: number;
      action: WfAction;
      skipButton?: { label: string; behavior?: "now" | "cancel" };
    }
  | {
      mode: "manual";
      // primary is optional — when omitted, AsWfForm renders all `options`
      // with equal visual weight (round-2 delta).
      primary?: WfButton;
      options?: WfButton[];
    };

export interface WfButton {
  label: string;
  action: WfAction;
}

export type WfAction =
  | { type: "redirect"; target: string; reason?: string }
  | { type: "reload" }
  | { type: "dismiss" };

/** Type-guard for the unified envelope. */
export function isWfFinished(v: unknown): v is WfFinished {
  return !!(v && typeof v === "object" && (v as WfFinished).finished);
}

// ── Helpers ─────────────────────────────────────────────────────

// Why `type: 'data'`: wooks's `useWfFinished()` unwraps the `value` field
// before returning the workflow result. Without the explicit data type,
// wooks would emit its own 302 — but redirect semantics live inside our
// envelope's `end.action`, which the client renders via `<AsWfFinish>`
// (countdown / manual choice / immediate). The server always returns the
// envelope as plain JSON; there is no server-side 3xx translation.
function setEnvelope(envelope: WfFinished): void {
  wooksUseWfFinished().set({ type: "data", value: envelope });
}

export function finishWf<T>(payload: WfFinished<T>): void {
  setEnvelope(payload);
}

export function finishWfWithData<T>(data: T, message?: WfMessage): void {
  finishWf({ finished: true, data, message });
}

export function finishWfWithMessage(level: WfMessage["level"], text: string): void {
  finishWf({ finished: true, message: { level, text } });
}

export interface RedirectOpts {
  reason?: string;
  message?: WfMessage;
  /** Present → `mode: 'auto'` with countdown; absent → `mode: 'immediate'`. */
  autoMs?: number;
  /** Only honored when `autoMs` is set — adds a "skip / cancel" button. */
  skipLabel?: string;
}

export function finishWfWithRedirect(target: string, opts: RedirectOpts = {}): void {
  const action: WfAction = { type: "redirect", target, reason: opts.reason };
  const end: WfFinishedEnd = opts.autoMs
    ? {
        mode: "auto",
        timeoutMs: opts.autoMs,
        action,
        skipButton: opts.skipLabel ? { label: opts.skipLabel } : undefined,
      }
    : { mode: "immediate", action };
  finishWf({ finished: true, message: opts.message, end });
}

export interface ChoiceOpts {
  data?: unknown;
  message?: WfMessage;
  primary?: WfButton;
  options?: WfButton[];
}

export function finishWfWithChoice(opts: ChoiceOpts): void {
  if (!opts.primary && (!opts.options || opts.options.length === 0)) {
    throw new Error("finishWfWithChoice() requires at least a primary button or one option.");
  }
  finishWf({
    finished: true,
    data: opts.data,
    message: opts.message,
    end: { mode: "manual", primary: opts.primary, options: opts.options },
  });
}

export function finishWfAborted(
  reason: string,
  opts: { message?: WfMessage; end?: WfFinishedEnd } = {},
): void {
  finishWf({
    finished: true,
    aborted: true,
    reason,
    message: opts.message,
    end: opts.end,
  });
}
