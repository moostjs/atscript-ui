import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import presetIcons from "@unocss/preset-icons";
import { createGenerator } from "unocss";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createIconsLoader } from "../icon-loader";

const PINNED =
  '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
  '<rect width="4" height="4" fill="#000"/></svg>';

let iconsDir: string;

beforeAll(() => {
  iconsDir = mkdtempSync(join(tmpdir(), "as-icons-"));
  writeFileSync(join(iconsDir, "pinned.svg"), PINNED);
  writeFileSync(
    join(iconsDir, "bare-px.svg"),
    '<svg width="24px" height="16" xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>',
  );
  writeFileSync(
    join(iconsDir, "bare-em.svg"),
    '<svg width="2em" height="2em" xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>',
  );
  mkdirSync(join(iconsDir, "ph"));
  writeFileSync(join(iconsDir, "ph", "star.svg"), '<svg viewBox="0 0 1 1"></svg>');
});

afterAll(() => rmSync(iconsDir, { recursive: true, force: true }));

afterEach(() => vi.restoreAllMocks());

function spyConsole() {
  return (["log", "info", "warn", "error"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
}

describe("createIconsLoader logging", () => {
  it("is quiet by default when icons load", async () => {
    const spies = spyConsole();
    const load = createIconsLoader({ iconsDir });
    expect(await load("ph:star")).toContain("<svg");
    expect(await load("pinned")).toContain("<svg");
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("reports failures on the console by default", async () => {
    const [, , warn] = spyConsole();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    const load = createIconsLoader({ iconsDir, enableCache: false });
    expect(await load("ph:missing")).toBeUndefined();
    expect(warn).toHaveBeenCalledWith("Failed to fetch icon: ph:missing (HTTP 404)");
  });

  it("sends every load to a given logger", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const load = createIconsLoader({ iconsDir, logger });
    await load("ph:star");
    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      `Loading cached icon ph:star from ${iconsDir}/ph/star.svg`,
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs nothing with logger: false", async () => {
    const spies = spyConsole();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const load = createIconsLoader({ iconsDir, enableCache: false, logger: false });
    expect(await load("ph:missing")).toBeUndefined();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("createIconsLoader local SVGs", () => {
  it("drops a pinned width / height from the root only", async () => {
    const svg = await createIconsLoader({ iconsDir, logger: false })("pinned");
    expect(svg).toMatch(/^<svg viewBox="0 0 24 24"/);
    expect(svg).toContain('<rect width="4" height="4" fill="currentColor"/>');
  });

  it("turns a pixel size into the viewBox when the root has none", async () => {
    const svg = await createIconsLoader({ iconsDir, logger: false })("bare-px");
    expect(svg).toMatch(/^<svg viewBox="0 0 24 16" xmlns="http:\/\/www.w3.org\/2000\/svg">/);
    expect(svg).toContain('<rect width="4" height="4"/>');
  });

  it("keeps a non-pixel size when the root has no viewBox", async () => {
    const svg = await createIconsLoader({ iconsDir, logger: false })("bare-em");
    expect(svg).toMatch(/^<svg width="2em" height="2em" xmlns=/);
    expect(svg).not.toContain("viewBox");
  });

  it("sizes in em in UnoCSS, not in the file's pixels", async () => {
    const uno = await createGenerator({
      presets: [
        presetIcons({ collections: { x: createIconsLoader({ iconsDir, logger: false }) } }),
      ],
    });
    const { css } = await uno.generate("i-x-pinned", { preflights: false });
    expect(css).toContain("width:1em;height:1em;");
  });
});
