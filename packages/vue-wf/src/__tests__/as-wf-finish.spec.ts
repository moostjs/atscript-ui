import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import AsWfFinish from "../components/defaults/as-wf-finish.vue";
import type { WfButton, WfFinished } from "@atscript/moost-wf";

// ── window.location helpers ─────────────────────────────────
// happy-dom's location.assign triggers real navigation; we replace with a
// writable plain object so assertions read setter values.
let origLocation: Location;
let assignSpy: ReturnType<typeof vi.fn>;
let reloadSpy: ReturnType<typeof vi.fn>;

function stubLocation() {
  origLocation = window.location;
  assignSpy = vi.fn();
  reloadSpy = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      assign: assignSpy,
      reload: reloadSpy,
    },
  });
  return { assignSpy, reloadSpy };
}

function restoreLocation() {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: origLocation,
  });
}

// ── Component-mount helpers ─────────────────────────────────
function mountFinish(payload: WfFinished | null, extraProps: Record<string, unknown> = {}) {
  return mount(AsWfFinish, {
    props: { payload, ...extraProps } as Record<string, unknown>,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AsWfFinish — no `end` directive", () => {
  // WHY: without `end`, AsWfFinish must stay quiet — parent decides.
  it("fires no action and renders the message banner", async () => {
    const { assignSpy, reloadSpy } = stubLocation();
    const navigate = vi.fn();
    try {
      const w = mountFinish(
        {
          finished: true,
          message: { level: "success", text: "Welcome!" },
        },
        { navigate },
      );
      await flushPromises();
      expect(w.text()).toContain("Welcome!");
      expect(w.find('[data-level="success"]').exists()).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
      expect(assignSpy).not.toHaveBeenCalled();
      expect(reloadSpy).not.toHaveBeenCalled();
    } finally {
      restoreLocation();
    }
  });
});

describe("AsWfFinish — `immediate` mode", () => {
  // WHY: when `navigate` is provided, the prop is the sole dispatcher.
  it("redirect with `navigate` prop calls the prop with the target URL", async () => {
    const { assignSpy } = stubLocation();
    const navigate = vi.fn();
    try {
      mountFinish(
        {
          finished: true,
          end: {
            mode: "immediate",
            action: { type: "redirect", target: "/home", reason: "post-login" },
          },
        },
        { navigate },
      );
      await flushPromises();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith("/home");
      // Did NOT fall back to location.assign.
      expect(assignSpy).not.toHaveBeenCalled();
    } finally {
      restoreLocation();
    }
  });

  // WHY: SSR-style fallback path — without `navigate` prop, drive the browser.
  it("redirect without `navigate` prop calls window.location.assign", async () => {
    const { assignSpy } = stubLocation();
    try {
      mountFinish({
        finished: true,
        end: {
          mode: "immediate",
          action: { type: "redirect", target: "/fallback" },
        },
      });
      await flushPromises();
      expect(assignSpy).toHaveBeenCalledTimes(1);
      expect(assignSpy).toHaveBeenCalledWith("/fallback");
    } finally {
      restoreLocation();
    }
  });

  // WHY: without `navigate` AND without a browser, we log + soft-fail rather
  // than crash the render path. Mirrors the SSR-throw posture in db-client
  // but stays out of Vue's render error path.
  it("redirect without `navigate` and no browser logs console.error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: undefined,
    });
    try {
      mountFinish({
        finished: true,
        end: {
          mode: "immediate",
          action: { type: "redirect", target: "/no-browser" },
        },
      });
      await flushPromises();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0]![0]).toContain("/no-browser");
    } finally {
      // Restore a fresh location object so subsequent tests have a baseline.
      Object.defineProperty(globalThis, "location", {
        configurable: true,
        value: { assign: () => {}, reload: () => {} },
      });
    }
  });

  // WHY: dismiss is the parent's signal to close a modal/overlay.
  it("dismiss action emits @dismiss", async () => {
    stubLocation();
    try {
      const w = mountFinish({
        finished: true,
        end: { mode: "immediate", action: { type: "dismiss" } },
      });
      await flushPromises();
      expect(w.emitted("dismiss")).toBeTruthy();
    } finally {
      restoreLocation();
    }
  });

  // WHY: reload covers "auth state changed, restart app" flows.
  it("reload action calls window.location.reload", async () => {
    const { reloadSpy } = stubLocation();
    try {
      mountFinish({
        finished: true,
        end: { mode: "immediate", action: { type: "reload" } },
      });
      await flushPromises();
      expect(reloadSpy).toHaveBeenCalled();
    } finally {
      restoreLocation();
    }
  });

  // WHY: analytics hook must fire before navigation unloads the page.
  it("emits @action with the WfAction descriptor", async () => {
    stubLocation();
    try {
      const w = mountFinish({
        finished: true,
        end: { mode: "immediate", action: { type: "dismiss" } },
      });
      await flushPromises();
      const emitted = w.emitted("action");
      expect(emitted).toBeTruthy();
      expect(emitted![0]![0]).toEqual({ type: "dismiss" });
    } finally {
      restoreLocation();
    }
  });
});

describe("AsWfFinish — `auto` mode", () => {
  // WHY: timer must fire the action after timeoutMs, no sooner.
  it("fires the action after timeoutMs elapses", async () => {
    vi.useFakeTimers();
    stubLocation();
    const navigate = vi.fn();
    try {
      mountFinish(
        {
          finished: true,
          end: {
            mode: "auto",
            timeoutMs: 3000,
            action: { type: "redirect", target: "/next" },
          },
        },
        { navigate },
      );
      await nextTick();
      expect(navigate).not.toHaveBeenCalled();
      vi.advanceTimersByTime(3000);
      expect(navigate).toHaveBeenCalledTimes(1);
    } finally {
      restoreLocation();
    }
  });

  // WHY: countdown variable must decrement so consumers can render progress.
  it("decrements secondsRemaining over time", async () => {
    vi.useFakeTimers();
    stubLocation();
    try {
      let captured: number | undefined;
      const Host = defineComponent({
        components: { AsWfFinish },
        setup() {
          return () =>
            h(
              AsWfFinish,
              {
                payload: {
                  finished: true,
                  end: {
                    mode: "auto",
                    timeoutMs: 5000,
                    action: { type: "dismiss" },
                  },
                } as WfFinished,
              },
              {
                countdown: (scope: { secondsRemaining: number }) => {
                  captured = scope.secondsRemaining;
                  return h("span", `${scope.secondsRemaining}`);
                },
              },
            );
        },
      });
      const w = mount(Host);
      await nextTick();
      expect(captured).toBe(5);
      vi.advanceTimersByTime(1100);
      await nextTick();
      expect(captured).toBeLessThanOrEqual(4);
      w.unmount();
    } finally {
      restoreLocation();
    }
  });

  // WHY: 'now' skip must fire the action immediately, not at timeout.
  it("skipButton behavior=now fires the action right away", async () => {
    vi.useFakeTimers();
    stubLocation();
    const navigate = vi.fn();
    try {
      const w = mountFinish(
        {
          finished: true,
          end: {
            mode: "auto",
            timeoutMs: 10_000,
            action: { type: "redirect", target: "/now" },
            skipButton: { label: "Skip", behavior: "now" },
          },
        },
        { navigate },
      );
      await nextTick();
      await w.find("button").trigger("click");
      expect(navigate).toHaveBeenCalledTimes(1);
      // Timer must also be cleared — no double-fire.
      vi.advanceTimersByTime(10_000);
      expect(navigate).toHaveBeenCalledTimes(1);
    } finally {
      restoreLocation();
    }
  });

  // WHY: 'cancel' skip is a hard stop — the flow ends, no navigation.
  it("skipButton behavior=cancel halts the timer without firing", async () => {
    vi.useFakeTimers();
    stubLocation();
    const navigate = vi.fn();
    try {
      const w = mountFinish(
        {
          finished: true,
          end: {
            mode: "auto",
            timeoutMs: 4000,
            action: { type: "redirect", target: "/skip" },
            skipButton: { label: "Stay", behavior: "cancel" },
          },
        },
        { navigate },
      );
      await nextTick();
      await w.find("button").trigger("click");
      vi.advanceTimersByTime(10_000);
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      restoreLocation();
    }
  });

  // WHY: unmount must drop pending timers — otherwise we navigate after teardown.
  it("clears the timer on unmount before timeout", async () => {
    vi.useFakeTimers();
    stubLocation();
    const navigate = vi.fn();
    try {
      const w = mountFinish(
        {
          finished: true,
          end: {
            mode: "auto",
            timeoutMs: 2000,
            action: { type: "redirect", target: "/x" },
          },
        },
        { navigate },
      );
      await nextTick();
      w.unmount();
      vi.advanceTimersByTime(5000);
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      restoreLocation();
    }
  });
});

describe("AsWfFinish — `manual` mode", () => {
  const primary: WfButton = { label: "Continue", action: { type: "dismiss" } };
  const optA: WfButton = {
    label: "Try again",
    action: { type: "redirect", target: "/retry" },
  };
  const optB: WfButton = { label: "Go home", action: { type: "reload" } };

  // WHY: manual must render every button until the user picks one.
  it("renders primary + every option", async () => {
    stubLocation();
    try {
      const w = mountFinish({
        finished: true,
        end: { mode: "manual", primary, options: [optA, optB] },
      });
      await flushPromises();
      const labels = w.findAll("button").map((b) => b.text());
      expect(labels).toContain("Continue");
      expect(labels).toContain("Try again");
      expect(labels).toContain("Go home");
    } finally {
      restoreLocation();
    }
  });

  // WHY: clicking each button fires the matching action exactly once.
  it("clicking a button fires its action", async () => {
    stubLocation();
    const navigate = vi.fn();
    try {
      const w = mountFinish(
        {
          finished: true,
          end: { mode: "manual", primary, options: [optA] },
        },
        { navigate },
      );
      await flushPromises();
      const tryAgain = w.findAll("button").find((b) => b.text() === "Try again")!;
      await tryAgain.trigger("click");
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith("/retry");
    } finally {
      restoreLocation();
    }
  });

  // WHY: round-2 delta — primary is optional; first option must be reachable.
  it("renders only options when primary is omitted", async () => {
    stubLocation();
    try {
      const w = mountFinish({
        finished: true,
        end: { mode: "manual", options: [optA, optB] },
      });
      await flushPromises();
      const labels = w.findAll("button").map((b) => b.text());
      expect(labels).toEqual(["Try again", "Go home"]);
    } finally {
      restoreLocation();
    }
  });

  // WHY: Enter is the dominant keyboard affordance — must route to primary.
  it("Enter key triggers the primary action when set", async () => {
    stubLocation();
    try {
      const w = mountFinish({
        finished: true,
        end: { mode: "manual", primary, options: [optA] },
      });
      await flushPromises();
      await w.find(".as-wf-finish").trigger("keydown", { key: "Enter" });
      expect(w.emitted("dismiss")).toBeTruthy();
    } finally {
      restoreLocation();
    }
  });

  // WHY: when no primary, Enter must route to the first option (round-2 delta).
  it("Enter key triggers the first option when primary is omitted", async () => {
    stubLocation();
    const navigate = vi.fn();
    try {
      const w = mountFinish(
        {
          finished: true,
          end: { mode: "manual", options: [optA, optB] },
        },
        { navigate },
      );
      await flushPromises();
      await w.find(".as-wf-finish").trigger("keydown", { key: "Enter" });
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith("/retry");
    } finally {
      restoreLocation();
    }
  });
});

describe("AsWfFinish — slot overrides", () => {
  // WHY: custom #primary slot is the consumer's escape hatch — `trigger` must work.
  it("primary slot receives { button, trigger } and trigger fires the action", async () => {
    stubLocation();
    try {
      const primary: WfButton = {
        label: "Custom",
        action: { type: "dismiss" },
      };
      const Host = defineComponent({
        components: { AsWfFinish },
        setup() {
          return () =>
            h(
              AsWfFinish,
              {
                payload: {
                  finished: true,
                  end: { mode: "manual", primary },
                } as WfFinished,
              },
              {
                primary: (scope: { button: WfButton; trigger: () => void }) =>
                  h(
                    "button",
                    {
                      class: "custom-cta",
                      "data-label": scope.button.label,
                      onClick: scope.trigger,
                    },
                    scope.button.label,
                  ),
              },
            );
        },
      });
      const w = mount(Host);
      await flushPromises();
      const btn = w.find(".custom-cta");
      expect(btn.exists()).toBe(true);
      expect(btn.attributes("data-label")).toBe("Custom");
      await btn.trigger("click");
      // dismiss bubbles to Host via @dismiss; check vnode emit on AsWfFinish:
      expect(w.findComponent(AsWfFinish).emitted("dismiss")).toBeTruthy();
    } finally {
      restoreLocation();
    }
  });
});
