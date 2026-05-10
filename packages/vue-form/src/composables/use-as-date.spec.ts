import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { useAsDate } from "./use-as-date";

describe("useAsDate — date kind", () => {
  it("inputType is 'date'", () => {
    const r = useAsDate({ modelValue: () => null, kind: "date", onCommit: () => {} });
    expect(r.inputType).toBe("date");
  });

  it("displayValue formats epoch-ms as YYYY-MM-DD (local TZ)", () => {
    // 2024-01-15 12:00 UTC — local TZ may vary, but the date portion should
    // reflect the local-TZ rendering. Build via Date constructor for parity
    // with the implementation.
    const sample = new Date(2024, 0, 15, 12, 0, 0).getTime();
    const r = useAsDate({ modelValue: () => sample, kind: "date", onCommit: () => {} });
    expect(r.displayValue.value).toBe("2024-01-15");
  });

  it("blanks for null / undefined / empty", () => {
    const live = ref<number | string | null | undefined>(null);
    const r = useAsDate({ modelValue: () => live.value, kind: "date", onCommit: () => {} });
    expect(r.displayValue.value).toBe("");
    live.value = undefined;
    expect(r.displayValue.value).toBe("");
    live.value = "";
    expect(r.displayValue.value).toBe("");
  });

  it("setFromInput commits epoch-ms when previous value was numeric", () => {
    const commits: (number | string | null)[] = [];
    const r = useAsDate({
      modelValue: () => 0,
      kind: "date",
      onCommit: (v) => commits.push(v),
    });
    r.setFromInput("2024-06-15");
    expect(typeof commits[0]).toBe("number");
    // local-tz parsing — parsing back yields the same date string
    const back = new Date(commits[0] as number);
    const y = back.getFullYear();
    const m = String(back.getMonth() + 1).padStart(2, "0");
    const d = String(back.getDate()).padStart(2, "0");
    expect(`${y}-${m}-${d}`).toBe("2024-06-15");
  });

  it("setFromInput commits string when previous was string", () => {
    const commits: (number | string | null)[] = [];
    const r = useAsDate({
      modelValue: () => "2020-01-01",
      kind: "date",
      onCommit: (v) => commits.push(v),
    });
    r.setFromInput("2024-06-15");
    expect(commits).toEqual(["2024-06-15"]);
  });

  it("setFromInput commits null on empty input", () => {
    const commits: (number | string | null)[] = [];
    const r = useAsDate({
      modelValue: () => Date.now(),
      kind: "date",
      onCommit: (v) => commits.push(v),
    });
    r.setFromInput("");
    expect(commits).toEqual([null]);
  });
});

describe("useAsDate — datetime kind", () => {
  it("inputType is 'datetime-local'", () => {
    const r = useAsDate({ modelValue: () => null, kind: "datetime", onCommit: () => {} });
    expect(r.inputType).toBe("datetime-local");
  });

  it("displayValue formats local epoch-ms as YYYY-MM-DDTHH:mm", () => {
    const sample = new Date(2024, 5, 1, 9, 30, 0).getTime();
    const r = useAsDate({ modelValue: () => sample, kind: "datetime", onCommit: () => {} });
    expect(r.displayValue.value).toBe("2024-06-01T09:30");
  });
});

describe("useAsDate — time kind", () => {
  it("inputType is 'time'", () => {
    const r = useAsDate({ modelValue: () => null, kind: "time", onCommit: () => {} });
    expect(r.inputType).toBe("time");
  });

  it("passes HH:mm strings through unchanged", () => {
    const r = useAsDate({ modelValue: () => "09:30", kind: "time", onCommit: () => {} });
    expect(r.displayValue.value).toBe("09:30");
  });

  it("truncates HH:mm:ss to HH:mm", () => {
    const r = useAsDate({ modelValue: () => "09:30:45", kind: "time", onCommit: () => {} });
    expect(r.displayValue.value).toBe("09:30");
  });

  it("setFromInput commits the raw HH:mm string", () => {
    const commits: (number | string | null)[] = [];
    const r = useAsDate({
      modelValue: () => null,
      kind: "time",
      onCommit: (v) => commits.push(v),
    });
    r.setFromInput("14:45");
    expect(commits).toEqual(["14:45"]);
    r.setFromInput("");
    expect(commits).toEqual(["14:45", null]);
  });
});
