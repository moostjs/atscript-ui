import { setDefaultClientFactory } from "@atscript/ui";
import { createApp } from "./app";
import { clientFactory, setRouterNavigate } from "./client/api/client-factory";
import "@unocss/reset/tailwind.css";
import "virtual:uno.css";
import "./styles/app.css";

setDefaultClientFactory(clientFactory);

const { app, router } = createApp();
// Wire SPA-mode navigation for `processor: 'navigate'` actions — without
// this, `Client.action()` falls back to `location.assign(url)` and the
// page hard-reloads on every "View orders" / "Edit" action.
setRouterNavigate((url) => {
  router.push(url).catch(() => {
    // Non-route URL or navigation aborted — fall back to a full nav so the
    // user still gets there.
    window.location.assign(url);
  });
});
void router.isReady().then(() => app.mount("#app"));
