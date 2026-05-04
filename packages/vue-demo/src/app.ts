import { AS_PRESETS_APP } from "@atscript/vue-table";
import { createSSRApp } from "vue";
import App from "./App.vue";
import { createRouter } from "./router";

export function createApp() {
  const app = createSSRApp(App);
  const router = createRouter();
  app.use(router);
  // SSR-injected — `useAppPrefs` consumes this during the SSR pass.
  app.provide(AS_PRESETS_APP, "vuedemo");
  return { app, router };
}
