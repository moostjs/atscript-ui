// @vitest-environment node
import {
  getUiTexts,
  resetDefaultClientFactory,
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

describe("server render without provideAsLocale", () => {
  it("what /meta serves one request never reaches the process-global texts", async () => {
    const meta = germanMeta();
    setDefaultClientFactory((() => ({
      meta: async () => meta,
      query: async () => [],
      invalidateMeta: vi.fn(),
    })) as unknown as ClientFactory);
    expect(typeof window).toBe("undefined");
    const info: ValueHelpInfo = { url: "/authors", targetField: "id" };
    const app = createSSRApp(
      defineComponent({
        setup() {
          useAsValueHelp({ info, model: { value: undefined }, onBlur: () => {} });
          return () => h("div");
        },
      }),
    );
    await renderToString(app);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(getUiTexts().t("UI_CANCEL")).toBe("Cancel");
  });
});
