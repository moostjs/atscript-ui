import type { Client } from "@atscript/db-client";
import { getDefaultClientFactory, type ClientFactory } from "@atscript/ui";

/**
 * The UI locale a presets / app-prefs client asks the server in: fixed, or
 * read on every request (a long-lived client following the app's locale).
 * `undefined` = none (no `Accept-Language`).
 */
export type PresetsLocale = string | (() => string | undefined);

/** The locale `locale` stands for now. */
export function currentLocale(locale: PresetsLocale | undefined): string | undefined {
  return typeof locale === "function" ? locale() : locale;
}

/**
 * `f`'s client for `url`, asked for `{ locale }` like every other atscript-ui
 * client (`ClientFactoryOptions.locale`), so its error bodies and preflight
 * messages come back in that language.
 */
export function localeClient(f: ClientFactory, url: string, locale: string | undefined): Client {
  return locale === undefined ? f(url) : f(url, { locale });
}

/**
 * The client source of a presets / app-prefs client: its pre-built `client`
 * as given, else `clientFactory`'s client for `url` in the current `locale` —
 * one per locale, built on first use.
 */
export function clientPerLocale(cfg: {
  url: string;
  client?: Client;
  clientFactory?: ClientFactory;
  locale?: PresetsLocale;
}): () => Client {
  const { client, url, locale } = cfg;
  if (client) return () => client;
  const f = cfg.clientFactory ?? getDefaultClientFactory();
  const byLocale = new Map<string | undefined, Client>();
  return () => {
    const loc = currentLocale(locale);
    let built = byLocale.get(loc);
    if (!built) byLocale.set(loc, (built = localeClient(f, url, loc)));
    return built;
  };
}
