import atscript from "unplugin-atscript/vite";
import swc from "unplugin-swc";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [atscript() as any, swc.vite()],
  oxc: false,
});
