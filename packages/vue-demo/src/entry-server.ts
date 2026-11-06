import { installDynamicResolver } from "@atscript/ui-fns";
import { getAsServedTexts } from "@atscript/vue-form";
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

  // The texts the server served while rendering (e.g. `/meta` `$i18n`): the
  // browser app starts with them, so hydration shows the same words.
  const state = {
    ...(ctx as { state?: Record<string, unknown> }).state,
    asTexts: getAsServedTexts(ctx),
  };
  // Inlined into a <script>: escape `<` so no text can close it.
  return { html, state: JSON.stringify(state).replace(/</g, "\\u003c") };
}
