import atscript from "unplugin-atscript/vite";
import swc from "unplugin-swc";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { moostVite } from "@moostjs/vite";

export default defineConfig({
  plugins: [
    atscript() as any,
    vue(),
    moostVite({
      entry: "./src/server/main.ts",
      middleware: true,
      prefix: "/db",
    }),
    swc.vite(),
  ],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  oxc: false,
  ssr: {
    external: ["@atscript/db", "@atscript/db-sqlite", "better-sqlite3"],
  },
});
