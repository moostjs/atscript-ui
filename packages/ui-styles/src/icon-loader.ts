import type { CustomIconLoader } from "@iconify/utils";
import { FileSystemIconLoader } from "@iconify/utils/lib/loader/node-loaders";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface IconsLoaderOptions {
  aliases?: Record<string, string>;
  iconsDir?: string;
  iconifyApiUrl?: string;
  enableCache?: boolean;
  processLocalSvg?: (svg: string) => string;
}

const defaultOptions: Required<IconsLoaderOptions> = {
  aliases: {},
  iconsDir: ".icons",
  iconifyApiUrl: "https://api.iconify.design",
  enableCache: true,
  processLocalSvg: (svg: string) => {
    if (svg.startsWith("<!-- colored -->")) {
      return svg;
    }
    return svg
      .replace(/#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/giu, "currentColor")
      .replace(/\b(?:hsla?|rgba?)\([^)]*\)/giu, "currentColor")
      .replace(/\b(?:white|black)\b/giu, "currentColor");
  },
};

export function createIconsLoader(options: IconsLoaderOptions = {}): CustomIconLoader {
  const config = { ...defaultOptions, ...options };
  const { aliases, iconsDir, iconifyApiUrl, enableCache, processLocalSvg } = config;

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
        // biome-ignore lint/suspicious/noConsole: build-time diagnostic
        console.log(`Loading cached icon ${id} from ${iconsDir}/${parts.join("/")}.svg`);
        const svg = readFileSync(cachedPath, "utf-8");
        memoryCache.set(id, svg);
        return svg;
      }
    }

    const cached = memoryCache.get(id);
    if (cached) {
      // biome-ignore lint/suspicious/noConsole: build-time diagnostic
      console.log("Using memory cached icon:", id);
      return cached;
    }

    const url = `${iconifyApiUrl}/${prefix}/${name}.svg`;
    // biome-ignore lint/suspicious/noConsole: build-time diagnostic
    console.log("Fetching icon from API:", id, url);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        // biome-ignore lint/suspicious/noConsole: build-time diagnostic
        console.error(`Failed to fetch icon: ${id}`);
        return undefined;
      }

      const svg = await response.text();
      memoryCache.set(id, svg);

      if (enableCache) {
        const cachedPath = getCachedIconPath(prefix || "", name || "");
        ensureDirectoryExists(cachedPath);
        writeFileSync(cachedPath, svg, "utf-8");
        // biome-ignore lint/suspicious/noConsole: build-time diagnostic
        console.log("Cached icon to disk:", cachedPath);
      }

      return svg;
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: build-time diagnostic
      console.error(`Error fetching icon ${id}:`, error);
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
