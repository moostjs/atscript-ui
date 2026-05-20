import { EventContext, run } from "@wooksjs/event-core";
import { describe, expect, it } from "vitest";
import { useWfActionSlot } from "../wf-io/use-wf-action-slot";

describe("useWfActionSlot", () => {
  function runInContext<T>(fn: () => T): T {
    const ctx = new EventContext({ logger: { log() {} } as never });
    return run(ctx, fn);
  }

  it("getAction returns undefined when no action set", () => {
    runInContext(() => {
      const { getAction } = useWfActionSlot();
      expect(getAction()).toBeUndefined();
    });
  });

  it("setAction + getAction round-trip", () => {
    runInContext(() => {
      const { setAction, getAction } = useWfActionSlot();
      setAction("resend");
      expect(getAction()).toBe("resend");
    });
  });

  it("setAction(undefined) clears the action", () => {
    runInContext(() => {
      const { setAction, getAction } = useWfActionSlot();
      setAction("resend");
      setAction(undefined);
      expect(getAction()).toBeUndefined();
    });
  });
});
