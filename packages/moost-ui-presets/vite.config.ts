import atscript from "unplugin-atscript/vite";
import swc from "unplugin-swc";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [atscript(), swc.vite()],
  oxc: false,
  pack: {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm"],
    plugins: [atscript()],
    deps: {
      neverBundle: [
        "@atscript/core",
        "@atscript/db",
        "@atscript/moost-db",
        "@atscript/typescript",
        "@moostjs/event-http",
        "@uniqu/core",
        "@wooksjs/event-http",
        "moost",
      ],
    },
  },
});
