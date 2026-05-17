import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import AsWfFinish from "../components/defaults/as-wf-finish.vue";
import type { WfButton, WfFinished } from "@atscript/moost-wf";

// ── window.location helpers ─────────────────────────────────
// happy-dom's location has a real href setter that triggers navigation;
// we replace with a writable plain object so assertions read setter values.
let origLocation: Location;
let hrefStore: { value: string };

function stubLocation() {
  origLocation = window.location;
  hrefStore = { value: origLocation.href };
  const reloadSpy = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      get href() {
        return hrefStore.value;
      },
      set href(v: string) {
        hrefStore.value = v;
      },
      reload: reloadSpy,
    },
  });
  return { reloadSpy };
}

function restoreLocation() {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: origLocation,
  });
}

// ── Component-mount helpers ─────────────────────────────────
function mountFinish(
  payload: WfFinished | null,
  listeners: { onNavigate?: (p: unknown) => void; onDismiss?: () => void } = {},
) {
  return mount(AsWfFinish, {
    props: { payload, ...listeners } as Record<string, unknown>,
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
    const { reloadSpy } = stubLocation();
    const onNavigate = vi.fn();
    try {
      const w = mountFinish(
        {
          finished: true,
          message: { level: "success", text: "Welcome!" },
        },
        { onNavigate },
      );
      await flushPromises();
      expect(w.text()).toContain("Welcome!");
      expect(w.find('[data-level="success"]').exists()).toBe(true);
      expect(onNavigate).not.toHaveBeenCalled();
      expect(reloadSpy).not.toHaveBeenCalled();
    } finally {
      restoreLocation();
    }
  });
});

describe("AsWfFinish — `immediate` mode", () => {
  // WHY: hard redirect must set href synchronously on mount — no DOM, no race.
  it("redirect/hard sets window.location.href on mount", async () => {
    stubLocation();
    try {
      mountFinish({
        finished: true,
        end: {
          mode: "immediate",
          action: { type: "redirect", target: "/login", mode: "hard" },
        },
      });
      await flushPromises();
      expect(hrefStore.value).toBe("/login");
    } finally {
      restoreLocation();
    }
  });

  // WHY: SPA-routed flows expect `@navigate`, not a page reload.
  it("redirect/soft emits @navigate when listener attached", async () => {
    stubLocation();
    const onNavigate = vi.fn();
    try {
      const initialHref = hrefStore.value;
      const w = mountFinish(
        {
          finished: true,
          end: {
            mode: "immediate",
            action: {
              type: "redirect",
              target: "/home",
              mode: "soft",
              reason: "post-login",
            },
          },
        },
        { onNavigate },
      );
      await flushPromises();
      const emitted = w.emitted("navigate");
      expect(emitted).toBeTruthy();
      expect(emitted![0]![0]).toEqual({
        target: "/home",
        mode: "soft",
        reason: "post-login",
      });
      // Did NOT fall back to location.href.
      expect(hrefStore.value).toBe(initialHref);
    } finally {
      restoreLocation();
    }
  });

  // WHY: silent dead-button is the worst UX — without @navigate, we must navigate.
  it("redirect/soft falls back to location.href when no @navigate attached", async () => {
    stubLocation();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mountFinish({
        finished: true,
        end: {
          mode: "immediate",
          action: { type: "redirect", target: "/fallback", mode: "soft" },
        },
      });
      await flushPromises();
      expect(hrefStore.value).toBe("/fallback");
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      restoreLocation();
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
    const onNavigate = vi.fn();
    try {
      mountFinish(
        {
          finished: true,
          end: {
            mode: "auto",
            timeoutMs: 3000,
            action: { type: "redirect", target: "/next", mode: "soft" },
          },
        },
        { onNavigate },
      );
      await nextTick();
      expect(onNavigate).not.toHaveBeenCalled();
      vi.advanceTimersByTime(3000);
      expect(onNavigate).toHaveBeenCalledTimes(1);
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
    const onNavigate = vi.fn();
    try {
      const w = mountFinish(
        {
          finished: true,
          end: {
            mode: "auto",
            timeoutMs: 10_000,
            action: { type: "redirect", target: "/now", mode: "soft" },
            skipButton: { label: "Skip", behavior: "now" },
          },
        },
        { onNavigate },
      );
      await nextTick();
      await w.find("button").trigger("click");
      expect(onNavigate).toHaveBeenCalledTimes(1);
      // Timer must also be cleared — no double-fire.
      vi.advanceTimersByTime(10_000);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    } finally {
      restoreLocation();
    }
  });

  // WHY: 'cancel' skip is a hard stop — the flow ends, no navigation.
  it("skipButton behavior=cancel halts the timer without firing", async () => {
    vi.useFakeTimers();
    stubLocation();
    const onNavigate = vi.fn();
    try {
      const w = mountFinish(
        {
          finished: true,
          end: {
            mode: "auto",
            timeoutMs: 4000,
            action: { type: "redirect", target: "/skip", mode: "soft" },
            skipButton: { label: "Stay", behavior: "cancel" },
          },
        },
        { onNavigate },
      );
      await nextTick();
      await w.find("button").trigger("click");
      vi.advanceTimersByTime(10_000);
      expect(onNavigate).not.toHaveBeenCalled();
    } finally {
      restoreLocation();
    }
  });

  // WHY: unmount must drop pending timers — otherwise we navigate after teardown.
  it("clears the timer on unmount before timeout", async () => {
    vi.useFakeTimers();
    stubLocation();
    const onNavigate = vi.fn();
    try {
      const w = mountFinish(
        {
          finished: true,
          end: {
            mode: "auto",
            timeoutMs: 2000,
            action: { type: "redirect", target: "/x", mode: "soft" },
          },
        },
        { onNavigate },
      );
      await nextTick();
      w.unmount();
      vi.advanceTimersByTime(5000);
      expect(onNavigate).not.toHaveBeenCalled();
    } finally {
      restoreLocation();
    }
  });
});

describe("AsWfFinish — `manual` mode", () => {
  const primary: WfButton = { label: "Continue", action: { type: "dismiss" } };
  const optA: WfButton = {
    label: "Try again",
    action: { type: "redirect", target: "/retry", mode: "soft" },
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
    const onNavigate = vi.fn();
    try {
      const w = mountFinish(
        {
          finished: true,
          end: { mode: "manual", primary, options: [optA] },
        },
        { onNavigate },
      );
      await flushPromises();
      const tryAgain = w.findAll("button").find((b) => b.text() === "Try again")!;
      await tryAgain.trigger("click");
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate.mock.calls[0]![0]).toMatchObject({
        target: "/retry",
        mode: "soft",
      });
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
    const onNavigate = vi.fn();
    try {
      const w = mountFinish(
        {
          finished: true,
          end: { mode: "manual", options: [optA, optB] },
        },
        { onNavigate },
      );
      await flushPromises();
      await w.find(".as-wf-finish").trigger("keydown", { key: "Enter" });
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate.mock.calls[0]![0]).toMatchObject({ target: "/retry" });
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
