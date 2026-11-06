// @vitest-environment node
import {
  getMetaEntry,
  getUiTexts,
  resetDefaultClientFactory,
  resolveValueHelp,
  resetMetaCache,
  setDefaultClientFactory,
  type ClientFactory,
  type ValueHelpInfo,
} from "@atscript/ui";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { useAsValueHelp } from "../composables/use-as-value-help";
import {
  getAsServedTexts,
  provideAsLocale,
  provideAsServedTexts,
  useAsTexts,
} from "../composables/use-as-locale";

afterEach(() => {
  resetDefaultClientFactory();
  resetMetaCache();
});

/** `/meta` as a translating server answers a German viewer's request. */
function germanMeta() {
  const author = defineAnnotatedType("object");
  author.prop("id", defineAnnotatedType().designType("number").annotate("meta.id", true).$type);
  return {
    searchable: true,
    vectorSearchable: false,
    searchIndexes: [],
    primaryKeys: ["id"],
    preferredId: ["id"],
    crud: { query: [], pages: [], one: [] },
    actions: [],
    relations: [],
    fields: {},
    type: { ...serializeAnnotatedType(author.$type), $i18n: { UI_CANCEL: "Abbrechen" } },
  };
}

/** A client factory answering every `/meta` with `meta` (a never-settling one for `null`). */
function serveMeta(meta: unknown) {
  const factory = vi.fn(
    () =>
      ({
        meta: () => (meta === null ? new Promise(() => {}) : Promise.resolve(meta)),
        query: async () => [],
        invalidateMeta: vi.fn(),
      }) as never,
  );
  setDefaultClientFactory(factory as unknown as ClientFactory);
  return factory;
}

describe("server render without provideAsLocale", () => {
  it("what /meta serves one request never reaches the process-global texts", async () => {
    serveMeta(germanMeta());
    expect(typeof window).toBe("undefined");
    const app = createSSRApp(
      defineComponent({
        async setup() {
          await resolveValueHelp("/authors");
          return () => h("div");
        },
      }),
    );
    await renderToString(app);
    expect(getUiTexts().t("UI_CANCEL")).toBe("Cancel");
  });
});

describe("a form value-help picker on a server", () => {
  // Why: the picker only works after mount, yet asked `/meta` during every
  // server render — a request per picker whose texts arrived after the HTML.
  it("asks nothing", async () => {
    const factory = serveMeta(germanMeta());
    const info: ValueHelpInfo = { url: "/authors", targetField: "id" };
    const app = createSSRApp(
      defineComponent({
        setup() {
          provideAsLocale(() => "de");
          useAsValueHelp({ info, model: { value: undefined }, onBlur: () => {} });
          return () => h("div");
        },
      }),
    );
    await renderToString(app);
    expect(factory).not.toHaveBeenCalled();
  });
});

// Why: a server render merged `/meta`'s `$i18n` into that request's texts, but
// the browser app started with an empty dict until its own `/meta` came back —
// German, then English, then German again on hydration. The invariant: what the
// browser renders on hydration equals the server's HTML.
describe("server-rendered texts reach the hydrating app", () => {
  /** Renders `t("UI_CANCEL")` once `/meta` is in (it awaits it, as a prefetching page does). */
  const AwaitsMeta = defineComponent({
    async setup() {
      const texts = useAsTexts();
      await getMetaEntry("/authors", undefined, { texts }).meta;
      return () => h("span", texts.t("UI_CANCEL"));
    },
  });
  /** Renders `t("UI_CANCEL")` right away; its `/meta` answers after the HTML. */
  const ReadsFirst = defineComponent({
    setup() {
      const texts = useAsTexts();
      getMetaEntry("/authors", undefined, { texts });
      return () => h("span", texts.t("UI_CANCEL"));
    },
  });
  const appOf = (Page: ReturnType<typeof defineComponent>) =>
    createSSRApp(
      defineComponent({
        setup() {
          provideAsLocale(() => "de");
          return () => h(Page);
        },
      }),
    );

  /** Server render → transferred (JSON) texts → the browser's first render with them. */
  async function serverThenBrowser(
    Page: ReturnType<typeof defineComponent>,
    serve: () => void = () => serveMeta(germanMeta()),
  ) {
    serve();
    const ssrContext = {};
    const serverHtml = await renderToString(appOf(Page), ssrContext);
    // anything still in flight lands now — after the HTML was written
    await new Promise((resolve) => setTimeout(resolve, 10));
    const served = getAsServedTexts(ssrContext);
    const transferred = served && JSON.parse(JSON.stringify(served));

    // the browser's own `/meta` serves nothing yet (no `$i18n` merged)
    serveMeta({ ...germanMeta(), type: { ...germanMeta().type, $i18n: undefined } });
    const hydrating = appOf(Page);
    provideAsServedTexts(hydrating, transferred);
    return { serverHtml, transferred, browserHtml: await renderToString(hydrating) };
  }

  it("a text the render read from what the server served hydrates the same", async () => {
    const { serverHtml, transferred, browserHtml } = await serverThenBrowser(AwaitsMeta);
    expect(serverHtml).toContain("Abbrechen");
    expect(transferred).toEqual({ de: { UI_CANCEL: "Abbrechen" } });
    expect(browserHtml).toBe(serverHtml);
    expect(getUiTexts().t("UI_CANCEL")).toBe("Cancel");
  });

  it("a text served after the render read it is left out: the fallback hydrates", async () => {
    const { serverHtml, transferred, browserHtml } = await serverThenBrowser(ReadsFirst);
    expect(serverHtml).toContain("Cancel");
    expect(transferred).toBeUndefined();
    expect(browserHtml).toBe(serverHtml);
  });

  /** `inner` below its own `provideAsLocale(() => locale)`. */
  const providing = (inner: ReturnType<typeof defineComponent>, locale = "de") =>
    defineComponent({
      setup() {
        provideAsLocale(() => locale);
        return () => h(inner);
      },
    });
  const both = (...children: ReturnType<typeof defineComponent>[]) =>
    defineComponent(
      () => () =>
        h(
          "div",
          children.map((c) => h(c)),
        ),
    );

  // Why: an id read before it was served and again after showed the fallback
  // in one spot and the translation in another — no one dictionary hydrates both.
  it("an id read before and after it is served shows the fallback throughout", async () => {
    const { serverHtml, transferred, browserHtml } = await serverThenBrowser(
      both(ReadsFirst, AwaitsMeta),
    );
    expect(serverHtml).not.toContain("Abbrechen");
    expect(transferred).toBeUndefined();
    expect(browserHtml).toBe(serverHtml);
  });

  // Why: the unserved ids were tracked per provider, so a nested provider that
  // was served an id the root read unserved put it into the snapshot — the
  // root's spot hydrated translated where the HTML had the fallback.
  it("nested providers: an id the root read unserved stays the fallback in the nested one", async () => {
    const { serverHtml, transferred, browserHtml } = await serverThenBrowser(
      both(ReadsFirst, providing(AwaitsMeta)),
    );
    expect(serverHtml).not.toContain("Abbrechen");
    expect(transferred).toBeUndefined();
    expect(browserHtml).toBe(serverHtml);
  });

  it("nested providers: a text one was served is the other's too, on both sides", async () => {
    // reads after the nested provider was served (its own provider never is)
    const ReadsLater = defineComponent({
      async setup() {
        const texts = useAsTexts();
        await new Promise((resolve) => setTimeout(resolve, 5));
        return () => h("span", texts.t("UI_CANCEL"));
      },
    });
    const { serverHtml, transferred, browserHtml } = await serverThenBrowser(
      both(providing(AwaitsMeta), ReadsLater),
    );
    expect(serverHtml.match(/Abbrechen/g)).toHaveLength(2);
    expect(transferred).toEqual({ de: { UI_CANCEL: "Abbrechen" } });
    expect(browserHtml).toBe(serverHtml);
  });

  it("nested providers: an id the nested one read unserved stays the fallback in the root", async () => {
    const { serverHtml, transferred, browserHtml } = await serverThenBrowser(
      both(providing(ReadsFirst), AwaitsMeta),
    );
    expect(serverHtml).not.toContain("Abbrechen");
    expect(transferred).toBeUndefined();
    expect(browserHtml).toBe(serverHtml);
  });

  it("nested providers: a text the root was served is the nested one's too, on both sides", async () => {
    const ReadsLater = defineComponent({
      async setup() {
        const texts = useAsTexts();
        await new Promise((resolve) => setTimeout(resolve, 5));
        return () => h("span", texts.t("UI_CANCEL"));
      },
    });
    const { serverHtml, transferred, browserHtml } = await serverThenBrowser(
      both(AwaitsMeta, providing(ReadsLater)),
    );
    expect(serverHtml.match(/Abbrechen/g)).toHaveLength(2);
    expect(transferred).toEqual({ de: { UI_CANCEL: "Abbrechen" } });
    expect(browserHtml).toBe(serverHtml);
  });

  // An id read unserved is pinned in its own locale only: another locale's
  // provider of the render still shows (and transfers) what it was served.
  it("two locales in one render: unserved ids and served texts stay per locale", async () => {
    const i18n: Record<string, Record<string, string>> = {
      de: { UI_CANCEL: "Abbrechen" },
      fr: { UI_CANCEL: "Annuler" },
    };
    const perLocale = () => {
      const factory = vi.fn(
        (_url: string, opts?: { locale?: string }) =>
          ({
            meta: async () => ({
              ...germanMeta(),
              type: { ...germanMeta().type, $i18n: i18n[opts?.locale ?? ""] },
            }),
            query: async () => [],
            invalidateMeta: vi.fn(),
          }) as never,
      );
      setDefaultClientFactory(factory as unknown as ClientFactory);
    };
    // fr: read before served (fallback); de: served, then read
    const first = await serverThenBrowser(both(providing(ReadsFirst, "fr"), AwaitsMeta), perLocale);
    expect(first.serverHtml).toContain("Abbrechen");
    expect(first.serverHtml).not.toContain("Annuler");
    expect(first.transferred).toEqual({ de: { UI_CANCEL: "Abbrechen" } });
    expect(first.browserHtml).toBe(first.serverHtml);
    // and the other way round
    const second = await serverThenBrowser(
      both(ReadsFirst, providing(AwaitsMeta, "fr")),
      perLocale,
    );
    expect(second.serverHtml).toContain("Annuler");
    expect(second.serverHtml).not.toContain("Abbrechen");
    expect(second.transferred).toEqual({ fr: { UI_CANCEL: "Annuler" } });
    expect(second.browserHtml).toBe(second.serverHtml);
  });

  it("without the transferred texts the browser would render differently", async () => {
    serveMeta(germanMeta());
    const serverHtml = await renderToString(appOf(AwaitsMeta), {});
    serveMeta({ ...germanMeta(), type: { ...germanMeta().type, $i18n: undefined } });
    expect(await renderToString(appOf(AwaitsMeta))).not.toBe(serverHtml);
  });

  it("collects nothing for an app without provideAsLocale", async () => {
    const ssrContext = {};
    await renderToString(createSSRApp(defineComponent(() => () => h("div"))), ssrContext);
    expect(getAsServedTexts(ssrContext)).toBeUndefined();
  });
});
