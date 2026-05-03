import { describe, expect, it } from "vite-plus/test";

import { createSpace } from "./helpers";

/**
 * Pin the string-length constraints declared in `as-preset-entry.as`:
 *
 *   - `PresetId`     — minLength 3, maxLength 64 (used by data.defaultPresetId
 *                      and data.favPresetIds[])
 *   - `FieldPath`    — minLength 1, maxLength 256 (used by columnNames,
 *                      filters, sorters[].field, columnWidths[].field,
 *                      filterOps[].field)
 *   - top-level `id` — minLength 3, maxLength 256
 *   - `app`          — minLength 1, maxLength 64
 *   - `tableKey`     — minLength 1, maxLength 64
 *   - `user`         — minLength 1, maxLength 128
 *   - `data.label`   — minLength 1, maxLength 128
 *   - widths[].width — minLength 1, maxLength 32
 *
 * Each test inserts a row whose only invalid bit is the constraint under
 * test; the validator is expected to throw.
 */

const baseValidPreset = (overrides: Record<string, unknown> = {}) => ({
  id: "row-base",
  type: "preset" as const,
  app: "demo",
  tableKey: "products",
  user: "bob",
  data: { label: "ok" },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const baseUserConf = (dataOverride: Record<string, unknown>) => ({
  id: "uc:bob:demo:products",
  type: "userConf" as const,
  app: "demo",
  tableKey: "products",
  user: "bob",
  data: dataOverride,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe("string-length constraints (top-level)", () => {
  it.each([
    ["id shorter than 3 chars", { id: "ab" }],
    ["id longer than 256 chars", { id: "x".repeat(257) }],
    ["empty app", { app: "" }],
    ["empty tableKey", { tableKey: "" }],
    ["user longer than 128 chars", { user: "u".repeat(129) }],
    ["empty label", { data: { label: "" } }],
    ["label longer than 128 chars", { data: { label: "L".repeat(129) } }],
  ])("rejects %s", async (_name, overrides) => {
    const { table } = await createSpace();
    await expect(table.insertOne(baseValidPreset({ ...overrides }))).rejects.toThrow();
  });
});

describe("PresetId constraint (data.defaultPresetId, data.favPresetIds[])", () => {
  it.each([
    ["defaultPresetId shorter than 3 chars", { defaultPresetId: "ab" }],
    ["defaultPresetId longer than 64 chars", { defaultPresetId: "p".repeat(65) }],
    ["a favPresetIds entry shorter than 3 chars", { favPresetIds: ["ok-id", "ab"] }],
  ])("rejects %s", async (_name, data) => {
    const { table } = await createSpace();
    await expect(table.insertOne(baseUserConf(data))).rejects.toThrow();
  });

  it("accepts a 'sys:standard' defaultPresetId (12 chars, well within range)", async () => {
    const { table } = await createSpace();
    await table.insertOne(baseUserConf({ defaultPresetId: "sys:standard" }));
  });

  it("accepts a UUID-shaped defaultPresetId (36 chars)", async () => {
    const { table } = await createSpace();
    await table.insertOne(
      baseUserConf({ defaultPresetId: "b9c47e1c-4f78-4a7e-9e8f-1a2b3c4d5e6f" }),
    );
  });
});

describe("widths[].width constraint (max 32 chars)", () => {
  it("rejects a width string longer than 32 chars", async () => {
    const { table } = await createSpace();
    await expect(
      table.insertOne(
        baseValidPreset({
          data: {
            label: "ok",
            content: {
              columns: {
                columnNames: ["name"],
                columnWidths: [{ field: "name", width: "x".repeat(33) }],
              },
            },
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("accepts a typical width string ('200px')", async () => {
    const { table } = await createSpace();
    await table.insertOne(
      baseValidPreset({
        data: {
          label: "ok",
          content: {
            columns: {
              columnNames: ["name"],
              columnWidths: [{ field: "name", width: "200px" }],
            },
          },
        },
      }),
    );
  });
});
