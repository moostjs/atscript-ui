import { useWfFinished as wooksUseWfFinished } from "@wooksjs/event-wf";
import type { TTranslation } from "moost";
import { currentTranslation } from "./wf-io/i18n";

// ── Types ───────────────────────────────────────────────────────

export interface WfFinished<TData = unknown> {
  finished: true;
  data?: TData;
  message?: WfMessage;
  next?: WfNext;
  aborted?: boolean;
  reason?: string;
}

export interface WfMessage {
  level: "info" | "success" | "warn" | "error";
  text: string;
}

export type WfNext =
  | { trigger: "immediate"; action: WfActionRequest }
  | {
      trigger: "auto";
      timeoutMs: number;
      action: WfActionRequest;
      skipButton?: { label: string; behavior?: "now" | "cancel" };
    }
  | {
      trigger: "manual";
      // primary is optional — when omitted, AsWfForm renders all `options`
      // with equal visual weight.
      primary?: WfButton;
      options?: WfButton[];
    };

export interface WfButton {
  label: string;
  action: WfActionRequest;
}

export type WfActionRequest =
  | { type: "redirect"; target: string; reason?: string }
  | { type: "reload" }
  | { type: "dismiss" };

/** Type-guard for the unified envelope. */
export function isWfFinished(v: unknown): v is WfFinished {
  return !!(v && typeof v === "object" && (v as WfFinished).finished);
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Options bag shared by `finishWf` and `abortWf`. Every field is optional
 * — pick whichever envelope properties the terminal screen needs.
 */
export interface FinishWfOpts<T = unknown> {
  data?: T;
  message?: WfMessage;
  next?: WfNext;
}

// Why `type: 'data'`: wooks's `useWfFinished()` unwraps the `value` field
// before returning the workflow result. Without the explicit data type,
// wooks would emit its own 302 — but redirect semantics live inside our
// envelope's `next.action`, which the client renders via `<AsWfFinish>`
// (countdown / manual choice / immediate). The server always returns the
// envelope as plain JSON; there is no server-side 3xx translation.
function setEnvelope(envelope: WfFinished): void {
  const translation = currentTranslation();
  wooksUseWfFinished().set({
    type: "data",
    value: translation ? translateEnvelope(envelope, translation.t) : envelope,
  });
}

type TextT = TTranslation["t"];

/**
 * The envelope's user-facing texts in the request's language (each text is
 * its own id): `message.text`, button labels and `skipButton.label`. The
 * abort `reason` is a machine value (analytics) and stays as it is. A new
 * envelope — the caller's objects (and `data`) stay as they are.
 */
function translateEnvelope(envelope: WfFinished, t: TextT): WfFinished {
  const out: WfFinished = { ...envelope };
  if (out.message) out.message = { ...out.message, text: t(out.message.text) };
  const next = out.next;
  if (next?.trigger === "auto" && next.skipButton) {
    out.next = { ...next, skipButton: { ...next.skipButton, label: t(next.skipButton.label) } };
  } else if (next?.trigger === "manual") {
    const manual = { ...next };
    if (manual.primary) manual.primary = translateButton(manual.primary, t);
    if (manual.options) manual.options = manual.options.map((b) => translateButton(b, t));
    out.next = manual;
  }
  return out;
}

function translateButton(button: WfButton, t: TextT): WfButton {
  return { ...button, label: t(button.label) };
}

/**
 * Build a `WfFinished` envelope and hand it to wooks. All envelope
 * properties are optional; pass `data`, `message`, and/or `next`.
 * With moost's translator (`setTranslator`) the message text and button
 * labels are sent in the request's language (each text is its own id):
 *
 *   finishWf({ data: { id: 42 } });
 *   finishWf({ message: { level: "success", text: "Saved." } });
 *   finishWf({
 *     next: {
 *       trigger: "auto",
 *       timeoutMs: 3000,
 *       action: { type: "redirect", target: "/home" },
 *     },
 *   });
 */
export function finishWf<T = unknown>(opts?: FinishWfOpts<T>): void {
  setEnvelope({ finished: true, ...opts });
}

/**
 * Build an aborted `WfFinished` envelope (`aborted: true` + `reason`) and
 * hand it to wooks. The same options as `finishWf` are accepted — an
 * aborted flow may still carry partial `data`, a `message`, or a `next`
 * action that lets the user navigate away.
 *
 *   abortWf("user-cancelled");
 *   abortWf("rate-limited", {
 *     message: { level: "warn", text: "Try again later." },
 *   });
 */
export function abortWf(reason: string, opts?: FinishWfOpts): void {
  setEnvelope({ finished: true, aborted: true, reason, ...opts });
}
