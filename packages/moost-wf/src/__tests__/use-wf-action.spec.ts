import { EventContext, run } from "@wooksjs/event-core";
import { describe, expect, it } from "vitest";
import { useWfAction } from "../use-wf-action";

describe("useWfAction", () => {
  function runInContext<T>(fn: () => T): T {
    const ctx = new EventContext({ logger: { log() {} } as never });
    return run(ctx, fn);
  }

  it("getAction returns undefined when no action set", () => {
    runInContext(() => {
      const { getAction } = useWfAction();
      expect(getAction()).toBeUndefined();
    });
  });

  it("setAction + getAction round-trip", () => {
    runInContext(() => {
      const { setAction, getAction } = useWfAction();
      setAction("resend");
      expect(getAction()).toBe("resend");
    });
  });

  it("setAction(undefined) clears the action", () => {
    runInContext(() => {
      const { setAction, getAction } = useWfAction();
      setAction("resend");
      setAction(undefined);
      expect(getAction()).toBeUndefined();
    });
  });
});
