import { setDefaultClientFactory } from "@atscript/ui";
import { createApp } from "./app";
import { clientFactory } from "./client/api/client-factory";
import "@unocss/reset/tailwind.css";
import "virtual:uno.css";
import "./styles/app.css";

setDefaultClientFactory(clientFactory);

const { app, router } = createApp();
void router.isReady().then(() => app.mount("#app"));
