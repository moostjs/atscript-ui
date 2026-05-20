import { EventContext, run } from "@wooksjs/event-core";
import { StepRetriableError, resumeKey, wfKind } from "@wooksjs/event-wf";
import { getMoostMate } from "moost";
import { describe, expect, it, vi } from "vite-plus/test";

import { WfAction } from "../wf-io/wf-action.decorator";
import { WfInput } from "../wf-io/wf-input.decorator";
import { useAtscriptWf } from "../wf-io/use-atscript-wf";
import { useWfAction } from "../wf-io/use-wf-action";
import { getCachedValidator } from "../wf-io/validator-cache";

/**
 * Seed the wooks/wf event context with the slots the wf composables read:
 * `wfKind.keys.input` (step input), `wfKind.keys.inputContext` (workflow
 * context). The wf action is set via `useWfAction().setAction(...)`.
 */
function runInWfContext<T>(
  opts: {
    input?: unknown;
    wfContext?: Record<string, unknown>;
    action?: string;
  },
  fn: () => T,
): T {
  const ctx = new EventContext({ logger: { log() {} } as never });
  return run(ctx, () => {
    // Seed every slot `useWfState()` reads — otherwise `slot.get` throws
    // "Key not set". Only `input` and `inputContext` are exercised by the
    // composable under test; the rest are placeholders.
    ctx.set(wfKind.keys.schemaId, "test-schema");
    ctx.set(wfKind.keys.stepId, null);
    ctx.set(wfKind.keys.indexes, undefined);
    ctx.set(wfKind.keys.input, opts.input);
    ctx.set(wfKind.keys.inputContext, opts.wfContext ?? {});
    ctx.set(resumeKey, false);
    if (opts.action !== undefined) {
      useWfAction().setAction(opts.action);
    }
    return fn();
  });
}

function expectIR(err: unknown): {
  outlet: "http";
  payload: unknown;
  context: Record<string, unknown>;
} {
  expect(err).toBeInstanceOf(StepRetriableError);
  const ir = (err as StepRetriableError<unknown>).inputRequired as {
    outlet: "http";
    payload: unknown;
    context: Record<string, unknown>;
  };
  // Sanity: the engine routes on `outlet`, so this must be present.
  expect(ir.outlet).toBe("http");
  return ir;
}

function capture(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected throw but none happened");
}

describe("useAtscriptWf().resolveInput() — pure, no action awareness", () => {
  it("throws StepRetriableError when input is missing", async () => {
    const { NoActionsForm } = await import("./fixtures/wf-forms.as");
    expect(() =>
      runInWfContext({ input: undefined }, () => useAtscriptWf(NoActionsForm).resolveInput()),
    ).toThrow(StepRetriableError);
  });

  it("throws with flattened field errors when input fails validation", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");
    const err = capture(() =>
      runInWfContext({ input: { username: "" } }, () => useAtscriptWf(LoginForm).resolveInput()),
    );
    const ir = expectIR(err);
    const errors = ir.context.errors as Record<string, string>;
    // Why: validators must surface per-field errors so the client renders them
    // next to inputs rather than as a global form-level message.
    expect(errors).toBeDefined();
    expect(typeof errors.username).toBe("string");
  });

  it("returns the typed input when validation passes", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");
    const result = runInWfContext({ input: { username: "alice", password: "secret" } }, () =>
      useAtscriptWf(LoginForm).resolveInput(),
    );
    expect(result).toEqual({ username: "alice", password: "secret" });
  });

  it("validates partially when { partial: 'deep' } is passed", async () => {
    const { WithDataForm } = await import("./fixtures/wf-forms.as");
    // Partial validation: missing `code` is allowed.
    const result = runInWfContext({ input: {} }, () =>
      useAtscriptWf(WithDataForm).resolveInput({ partial: "deep" }),
    );
    expect(result).toEqual({});
  });

  it("throws when partial validation fails", async () => {
    const { WithDataForm } = await import("./fixtures/wf-forms.as");
    const err = capture(() =>
      runInWfContext({ input: { code: 42 } }, () =>
        useAtscriptWf(WithDataForm).resolveInput({ partial: "deep" }),
      ),
    );
    const ir = expectIR(err);
    expect(ir.context.errors).toBeDefined();
  });

  it("uses the cached validator on repeated calls", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");
    // Probe the cache directly: same (type, opts) must hand back the same
    // validator instance — the perf contract the cache exists to enforce.
    const v1 = getCachedValidator(LoginForm, { unknownProps: "strip" });
    const v2 = getCachedValidator(LoginForm, { unknownProps: "strip" });
    expect(v1).toBe(v2);

    // And exercising resolveInput hits the same cached instance — spy on
    // the type's validator factory to confirm it's only created once across
    // the two calls (one from the test, one from resolveInput).
    const spy = vi.spyOn(LoginForm, "validator");
    runInWfContext({ input: { username: "alice", password: "x" } }, () =>
      useAtscriptWf(LoginForm).resolveInput(),
    );
    runInWfContext({ input: { username: "bob", password: "y" } }, () =>
      useAtscriptWf(LoginForm).resolveInput(),
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does NOT look at the wf action", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");
    // Why: the composable's contract is "validate the input"; action policy
    // belongs in the decorator. Setting an unknown action must not trip it.
    const result = runInWfContext(
      { input: { username: "alice", password: "secret" }, action: "something-random" },
      () => useAtscriptWf(LoginForm).resolveInput(),
    );
    expect(result).toEqual({ username: "alice", password: "secret" });
  });
});

describe("useAtscriptWf().resolveAction() — pure, no input awareness", () => {
  it("returns undefined when no action is set", async () => {
    const { ActionForm } = await import("./fixtures/wf-forms.as");
    const result = runInWfContext({}, () => useAtscriptWf(ActionForm).resolveAction());
    expect(result).toBeUndefined();
  });

  it("returns the action name when set", async () => {
    const { ActionForm } = await import("./fixtures/wf-forms.as");
    const result = runInWfContext({ action: "resend" }, () =>
      useAtscriptWf(ActionForm).resolveAction(),
    );
    expect(result).toBe("resend");
  });

  it("throws StepRetriableError when the action is unknown", async () => {
    const { ActionForm } = await import("./fixtures/wf-forms.as");
    const err = capture(() =>
      runInWfContext({ action: "bogus" }, () => useAtscriptWf(ActionForm).resolveAction()),
    );
    expectIR(err);
  });

  it("is idempotent — second call returns the same value without re-reading", async () => {
    const { ActionForm } = await import("./fixtures/wf-forms.as");
    runInWfContext({ action: "resend" }, () => {
      const wf = useAtscriptWf(ActionForm);
      const a1 = wf.resolveAction();
      const a2 = wf.resolveAction();
      // Why: callers (resolveInput, resolveAction, downstream composables)
      // call this multiple times per step. The slot must not be re-read
      // from a body/header on each call.
      expect(a1).toBe("resend");
      expect(a2).toBe("resend");
    });
  });

  it("does NOT look at the wf input", async () => {
    const { ActionForm } = await import("./fixtures/wf-forms.as");
    // Why: the primitives are independent. With input present but no action,
    // resolveAction must still report `undefined` rather than failing.
    const result = runInWfContext({ input: { code: "1234" } }, () =>
      useAtscriptWf(ActionForm).resolveAction(),
    );
    expect(result).toBeUndefined();
  });
});

describe("useAtscriptWf().requireInput() — error builder", () => {
  it("builds StepRetriableError with the form schema payload", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");
    const err = runInWfContext({}, () => useAtscriptWf(LoginForm).requireInput());
    expect(err).toBeInstanceOf(StepRetriableError);
    const ir = (err as StepRetriableError<unknown>).inputRequired as {
      outlet: "http";
      payload: unknown;
      context: Record<string, unknown>;
    };
    expect(ir.outlet).toBe("http");
    // Payload must be the serialized form schema; serializer's exact shape
    // is its own contract — here we just require a non-null object.
    expect(ir.payload).toBeTruthy();
    expect(typeof ir.payload).toBe("object");
  });

  it("includes field errors in context.errors when provided", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");
    const err = runInWfContext({}, () =>
      useAtscriptWf(LoginForm).requireInput({ errors: { username: "is bad" } }),
    );
    const ir = (err as StepRetriableError<unknown>).inputRequired as {
      context: Record<string, unknown>;
    };
    const errors = ir.context.errors as Record<string, string>;
    expect(errors.username).toBe("is bad");
  });

  it("maps formMessage to context.errors.__form", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");
    const err = runInWfContext({}, () =>
      useAtscriptWf(LoginForm).requireInput({ formMessage: "nope" }),
    );
    const ir = (err as StepRetriableError<unknown>).inputRequired as {
      context: Record<string, unknown>;
    };
    const errors = ir.context.errors as Record<string, string>;
    expect(errors.__form).toBe("nope");
  });

  it("omits errors when no field errors and no formMessage given", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");
    const err = runInWfContext({}, () => useAtscriptWf(LoginForm).requireInput());
    const ir = (err as StepRetriableError<unknown>).inputRequired as {
      context: Record<string, unknown>;
    };
    // Why: callers reading `context.errors` should be able to distinguish
    // "no validation failure to report" from "empty error map".
    expect(ir.context.errors).toBeUndefined();
  });
});

// Lightweight harness for the parameter decorators: apply the decorator on
// a fresh class-shaped target, then pull the registered resolver back out
// of moost's metadata store. We invoke it with a synthetic `targetMeta`
// (the param-type the decorator reads at runtime).
type ResolveCb = (metas: { targetMeta?: { type?: unknown } }) => unknown;

let methodCounter = 0;
function Stub() {}
function captureResolve(decorator: ParameterDecorator, type: unknown): ResolveCb {
  const target = { constructor: Stub } as unknown as object;
  const methodName = `m${++methodCounter}`;
  decorator(target, methodName, 0);
  const meta = getMoostMate().read(target, methodName) as
    | { params?: Array<{ resolver?: ResolveCb }> }
    | undefined;
  const resolver = meta?.params?.[0]?.resolver;
  if (!resolver) throw new Error("Resolve callback not registered");
  return (extra: { targetMeta?: { type?: unknown } }) =>
    resolver({ targetMeta: { type, ...extra.targetMeta } } as never);
}

describe("@WfInput — policy matrix", () => {
  it("resolves to the validated input on a clean submit", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");
    const cb = captureResolve(WfInput(), LoginForm);
    const result = runInWfContext({ input: { username: "alice", password: "secret" } }, () =>
      cb({}),
    );
    expect(result).toEqual({ username: "alice", password: "secret" });
  });

  it("throws when input is missing and no action is fired", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");
    const cb = captureResolve(WfInput(), LoginForm);
    expect(() => runInWfContext({ input: undefined }, () => cb({}))).toThrow(StepRetriableError);
  });

  it("throws when input is invalid (no action)", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");
    const cb = captureResolve(WfInput(), LoginForm);
    const err = capture(() => runInWfContext({ input: { username: "" } }, () => cb({})));
    const ir = expectIR(err);
    expect((ir.context.errors as Record<string, string>).username).toBeDefined();
  });

  it("throws when a with-data action fires with no input", async () => {
    const { WithDataForm } = await import("./fixtures/wf-forms.as");
    const cb = captureResolve(WfInput(), WithDataForm);
    const err = capture(() =>
      runInWfContext({ action: "saveDraft", input: undefined }, () => cb({})),
    );
    const ir = expectIR(err);
    expect((ir.context.errors as Record<string, string>).__form).toContain("saveDraft");
  });

  it("validates partially when a with-data action fires with input", async () => {
    const { WithDataForm } = await import("./fixtures/wf-forms.as");
    const cb = captureResolve(WfInput(), WithDataForm);
    // Partial validation: missing `code` is allowed under a with-data action.
    const result = runInWfContext({ action: "saveDraft", input: {} }, () => cb({}));
    expect(result).toEqual({});
  });

  it("throws when input fails partial validation under a with-data action", async () => {
    const { WithDataForm } = await import("./fixtures/wf-forms.as");
    const cb = captureResolve(WfInput(), WithDataForm);
    const err = capture(() =>
      runInWfContext({ action: "saveDraft", input: { code: 42 } }, () => cb({})),
    );
    const ir = expectIR(err);
    expect(ir.context.errors).toBeDefined();
  });

  it("returns undefined when a no-data action fires and pass:true is set", async () => {
    const { ActionForm } = await import("./fixtures/wf-forms.as");
    const cb = captureResolve(WfInput({ pass: true }), ActionForm);
    const result = runInWfContext({ action: "resend", input: undefined }, () => cb({}));
    expect(result).toBeUndefined();
  });

  it("throws when a no-data action fires without pass:true", async () => {
    const { ActionForm } = await import("./fixtures/wf-forms.as");
    const cb = captureResolve(WfInput(), ActionForm);
    const err = capture(() => runInWfContext({ action: "resend", input: undefined }, () => cb({})));
    const ir = expectIR(err);
    // Why: silently returning undefined would let the step handler treat
    // a stateless action as if it were the normal submit — pass:true must
    // be explicit opt-in.
    expect((ir.context.errors as Record<string, string>).__form).toContain("resend");
  });

  it("throws when input is present alongside a no-data action and pass:true is set", async () => {
    const { ActionForm } = await import("./fixtures/wf-forms.as");
    const cb = captureResolve(WfInput({ pass: true }), ActionForm);
    const err = capture(() =>
      runInWfContext({ action: "resend", input: { code: "1234" } }, () => cb({})),
    );
    const ir = expectIR(err);
    // Why: declaring a no-data action means the action contract excludes
    // payloads. Accepting input would let clients smuggle data the step
    // didn't sign up to validate.
    expect((ir.context.errors as Record<string, string>).__form).toContain("not allowed");
  });

  it("throws with __form 'not supported' for an unknown action", async () => {
    const { ActionForm } = await import("./fixtures/wf-forms.as");
    const cb = captureResolve(WfInput(), ActionForm);
    const err = capture(() =>
      runInWfContext({ action: "bogus", input: { code: "1" } }, () => cb({})),
    );
    const ir = expectIR(err);
    expect((ir.context.errors as Record<string, string>).__form).toContain("not supported");
  });
});

describe("@WfAction", () => {
  it("resolves to the action name", async () => {
    const { ActionForm } = await import("./fixtures/wf-forms.as");
    const cb = captureResolve(WfAction(), ActionForm);
    const result = runInWfContext({ action: "resend" }, () => cb({}));
    expect(result).toBe("resend");
  });

  it("returns undefined when no action is set", async () => {
    const { ActionForm } = await import("./fixtures/wf-forms.as");
    const cb = captureResolve(WfAction(), ActionForm);
    const result = runInWfContext({}, () => cb({}));
    expect(result).toBeUndefined();
  });
});
