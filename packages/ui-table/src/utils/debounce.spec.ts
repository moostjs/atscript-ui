import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "./debounce";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays invocation by the specified ms", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("resets the timer on each call", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(80);
    debounced();
    vi.advanceTimersByTime(80);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("passes the latest arguments", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);

    debounced("a");
    debounced("b");
    debounced("c");

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith("c");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("cancel() prevents pending invocation", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced.cancel();
    vi.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel() is safe to call when nothing is pending", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced.cancel();
    expect(fn).not.toHaveBeenCalled();
  });

  it("can fire again after previous invocation", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);

    debounced();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledOnce();

    debounced();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
