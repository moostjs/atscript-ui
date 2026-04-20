import atscript from "unplugin-atscript/vite";
import swc from "unplugin-swc";
import UnoCSS from "unocss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { moostVite } from "@moostjs/vite";

export default defineConfig({
  server: { port: 3200 },
  plugins: [
    atscript() as any,
    UnoCSS(),
    vue(),
    moostVite({
      entry: "/src/server/main.ts",
      middleware: true,
      prefix: "/api",
      ssrEntry: "/src/entry-server.ts",
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
    noExternal: ["@moostjs/vite"],
  },
});
