import { describe, expect, it } from "vite-plus/test";
import { createAsHttpOutlet } from "../outlet";

const SCHEMA = { kind: "form", id: "TestForm" } as const;

describe("createAsHttpOutlet", () => {
  it("wraps form payload + context in the inputRequired envelope", async () => {
    const outlet = createAsHttpOutlet();
    const result = await outlet.deliver(
      { outlet: "http", payload: SCHEMA, context: { x: 1 } },
      "token",
    );

    expect(result).toEqual({
      response: {
        inputRequired: {
          payload: SCHEMA,
          transport: "http",
          context: { x: 1 },
        },
      },
    });
  });

  it("defaults missing context to {} (not undefined)", async () => {
    const outlet = createAsHttpOutlet();
    const result = await outlet.deliver({ outlet: "http", payload: SCHEMA }, "token");

    expect(result).toEqual({
      response: {
        inputRequired: {
          payload: SCHEMA,
          transport: "http",
          context: {},
        },
      },
    });
    // Explicit guard: the field must be present, not undefined.
    expect(
      (result as { response: { inputRequired: { context: unknown } } }).response.inputRequired
        .context,
    ).toEqual({});
  });

  it("passes through `outlet` signal payload without wrapping", async () => {
    const outlet = createAsHttpOutlet();
    const result = await outlet.deliver(
      { outlet: "http", payload: { outlet: "awaiting-payment" } },
      "token",
    );

    expect(result).toEqual({
      response: { outlet: "awaiting-payment" },
    });
  });

  it("passes through `sent` signal payload without wrapping", async () => {
    const outlet = createAsHttpOutlet();
    const result = await outlet.deliver({ outlet: "http", payload: { sent: true } }, "token");

    expect(result).toEqual({
      response: { sent: true },
    });
  });

  it("passes through `error` signal payload without wrapping", async () => {
    const outlet = createAsHttpOutlet();
    const result = await outlet.deliver(
      { outlet: "http", payload: { error: { message: "boom" } } },
      "token",
    );

    expect(result).toEqual({
      response: { error: { message: "boom" } },
    });
  });

  it("passes through `finished` signal payload without wrapping", async () => {
    const outlet = createAsHttpOutlet();
    const result = await outlet.deliver(
      { outlet: "http", payload: { finished: true, value: 42 } },
      "token",
    );

    expect(result).toEqual({
      response: { finished: true, value: 42 },
    });
  });

  it("merges context into a signal payload at the response root", async () => {
    const outlet = createAsHttpOutlet();
    const result = await outlet.deliver(
      {
        outlet: "http",
        payload: { outlet: "awaiting-payment" },
        context: { traceId: "abc" },
      },
      "token",
    );

    expect(result).toEqual({
      response: { outlet: "awaiting-payment", traceId: "abc" },
    });
  });

  it("wraps a null payload (treated as form payload, not a signal)", async () => {
    const outlet = createAsHttpOutlet();
    const result = await outlet.deliver({ outlet: "http", payload: null }, "token");

    expect(result).toEqual({
      response: {
        inputRequired: {
          payload: null,
          transport: "http",
          context: {},
        },
      },
    });
  });

  it("identifies as a valid http outlet with caller-bound token delivery", () => {
    const outlet = createAsHttpOutlet();
    expect(outlet.name).toBe("http");
    // `tokenDelivery` was added in @prostojs/wf@0.2 but is not in the typed
    // `WfOutlet` shape we depend on. Read it dynamically to keep the smoke
    // test honest without leaking the cast type-side.
    const meta = outlet as unknown as { tokenDelivery?: string };
    expect(meta.tokenDelivery).toBe("caller");
  });
});
