import atscript from "unplugin-atscript/vite";
import swc from "unplugin-swc";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [atscript() as any, vue(), swc.vite()],
  oxc: false,
  test: {
    environment: "happy-dom",
  },
});
