import { createSSRApp } from "vue";
import App from "./App.vue";
import { createRouter } from "./router";
import "@unocss/reset/tailwind.css";
import "virtual:uno.css";
import "./styles/app.css";

export function createApp() {
  const app = createSSRApp(App);
  const router = createRouter();
  app.use(router);
  return { app, router };
}
