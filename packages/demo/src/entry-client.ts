import { createApp } from "./app";
import "@unocss/reset/tailwind.css";
import "virtual:uno.css";
import "./styles/app.css";

const { app, router } = createApp();
void router.isReady().then(() => app.mount("#app"));
