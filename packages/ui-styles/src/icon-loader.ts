import type { CustomIconLoader } from "@iconify/utils";
import { FileSystemIconLoader } from "@iconify/utils/lib/loader/node-loaders";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Where {@link createIconsLoader} reports: `info` for every load, `warn` / `error` for failures. */
export type IconsLoaderLogger = Pick<Console, "info" | "warn" | "error">;

export interface IconsLoaderOptions {
  aliases?: Record<string, string>;
  iconsDir?: string;
  iconifyApiUrl?: string;
  enableCache?: boolean;
  processLocalSvg?: (svg: string) => string;
  /**
   * Where to report. The default reports failures only (an icon the API
   * doesn't have, a failed request) on the console; pass `console` to also
   * see every icon load, or `false` for no output.
   */
  logger?: IconsLoaderLogger | false;
}

const silent: IconsLoaderLogger = { info: () => {}, warn: () => {}, error: () => {} };

// `console` is looked up per call, so a console replaced later still gets the output.
const failuresOnly: IconsLoaderLogger = {
  ...silent,
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

/** The opening `<svg …>` tag. */
const SVG_ROOT_TAG = /<svg\b[^>]*>/iu;
const SIZE_ATTR = /\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/giu;

/** A root attribute's value, or `undefined`. */
function rootAttr(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "iu").exec(tag);
  return match ? (match[1] ?? match[2]) : undefined;
}

/** A plain pixel size (`24`, `24.5`, `24px`) as a number, else `undefined`. */
function pixels(value: string | undefined): number | undefined {
  const match = value === undefined ? null : /^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/u.exec(value);
  return match ? Number(match[1]) : undefined;
}

/**
 * Drop a `width` / `height` pinned on the root `<svg>` so the icon sizes from
 * its `viewBox` and the class (`1em` by default). Without a `viewBox` the
 * pixel size is the only geometry: it becomes `viewBox="0 0 W H"` first, and a
 * size that is not plain pixels is left as it is.
 */
function unpinRootSize(tag: string): string {
  if (rootAttr(tag, "viewBox") !== undefined) return tag.replace(SIZE_ATTR, "");
  const width = pixels(rootAttr(tag, "width"));
  const height = pixels(rootAttr(tag, "height"));
  if (width === undefined || height === undefined) return tag;
  return tag.replace(SIZE_ATTR, "").replace(/^<svg\b/iu, `<svg viewBox="0 0 ${width} ${height}"`);
}

const defaultOptions: Required<Omit<IconsLoaderOptions, "logger">> = {
  aliases: {},
  iconsDir: ".icons",
  iconifyApiUrl: "https://api.iconify.design",
  enableCache: true,
  processLocalSvg: (svg: string) => {
    const sized = svg.replace(SVG_ROOT_TAG, unpinRootSize);
    if (sized.startsWith("<!-- colored -->")) {
      return sized;
    }
    return sized
      .replace(/#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/giu, "currentColor")
      .replace(/\b(?:hsla?|rgba?)\([^)]*\)/giu, "currentColor")
      .replace(/\b(?:white|black)\b/giu, "currentColor");
  },
};

export function createIconsLoader(options: IconsLoaderOptions = {}): CustomIconLoader {
  const config = { ...defaultOptions, ...options };
  const { aliases, iconsDir, iconifyApiUrl, enableCache, processLocalSvg } = config;
  const logger = options.logger === false ? silent : (options.logger ?? failuresOnly);

  const memoryCache = new Map<string, string>();

  const fsIcons = FileSystemIconLoader(iconsDir, processLocalSvg);

  function ensureDirectoryExists(filePath: string) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  function getCachedIconPath(prefix: string, name: string): string {
    return join(iconsDir, prefix, `${name}.svg`);
  }

  async function fetchIconify(id: string): Promise<string | undefined> {
    const parts = id.split(":");
    const [prefix, name] = parts;

    if (enableCache) {
      const cachedPath = getCachedIconPath(prefix || "", name || "");

      if (existsSync(cachedPath)) {
        logger.info(`Loading cached icon ${id} from ${iconsDir}/${parts.join("/")}.svg`);
        const svg = readFileSync(cachedPath, "utf-8");
        memoryCache.set(id, svg);
        return svg;
      }
    }

    const cached = memoryCache.get(id);
    if (cached) {
      logger.info("Using memory cached icon:", id);
      return cached;
    }

    const url = `${iconifyApiUrl}/${prefix}/${name}.svg`;
    logger.info("Fetching icon from API:", id, url);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        logger.warn(`Failed to fetch icon: ${id} (HTTP ${response.status})`);
        return undefined;
      }

      const svg = await response.text();
      memoryCache.set(id, svg);

      if (enableCache) {
        const cachedPath = getCachedIconPath(prefix || "", name || "");
        ensureDirectoryExists(cachedPath);
        writeFileSync(cachedPath, svg, "utf-8");
        logger.info("Cached icon to disk:", cachedPath);
      }

      return svg;
    } catch (error) {
      logger.error(`Error fetching icon ${id}:`, error);
      return undefined;
    }
  }

  return async (name: string) => {
    const resolved = aliases[name] ?? name;
    // Iconify IDs are always `prefix:name`. A bare token = local SVG in iconsDir.
    if (resolved.includes(":")) {
      const svg = await fetchIconify(resolved);
      if (svg) {
        return svg;
      }
    }
    return (await fsIcons(resolved)) ?? fsIcons(name);
  };
}
