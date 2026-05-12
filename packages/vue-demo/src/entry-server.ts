import { installDynamicResolver } from "@atscript/ui-fns";
import { renderToString } from "vue/server-renderer";
import { createApp } from "./app";

// SSR-side activation so server-rendered forms apply the same fn-driven
// title/label/value/etc. resolution as the client; otherwise the HTML
// shipped to the browser would carry static defaults and only "wake up"
// after hydration.
installDynamicResolver();

export async function render(url: string) {
  const { app, router } = createApp();
  await router.push(url);
  await router.isReady();

  const ctx: Record<string, unknown> = {};
  const html = await renderToString(app, ctx);

  const state = JSON.stringify((ctx as { state?: unknown }).state ?? {});
  return { html, state };
}
