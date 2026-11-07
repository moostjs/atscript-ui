import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, Fragment, h, nextTick, ref } from "vue";
import { defineAnnotatedType } from "@atscript/typescript/utils";
import type { Client } from "@atscript/db-client";
import type { ClientFactory, UiTexts, UiTranslate } from "@atscript/ui";
import { provideAsLocale } from "@atscript/vue-form";
import { useAsTexts } from "@atscript/vue-form/locale";
import { clearTableCache, useTable } from "../composables/use-table";
import AsActionFormDialog from "../components/defaults/as-action-form-dialog.vue";
import type { TVueTableActionInfo } from "../types";
import {
  createMockClient,
  createMockMeta,
  mockColumn,
  mountWithTableContext,
  stubClient,
} from "./helpers";

/** The app's translator and the dialog title it reads, for the dialog-texts tests. */
const titleDe: UiTranslate = (id) =>
  id === "Reschedule order" ? "Bestellung verschieben" : undefined;
const titleOf = () => document.body.querySelector(".as-action-form-title")?.textContent;

afterEach(() => {
  clearTableCache();
});

/** `/meta` as a translating server serves it in `locale`. */
function metaIn(locale: string | undefined) {
  const meta = createMockMeta(["name"]);
  if (locale === "de") {
    meta.type = { ...meta.type, $i18n: { UI_TABLE_NO_MATCHING: "Keine passenden Werte" } };
  }
  return meta;
}

describe("useTable — /meta in the app's UI locale", () => {
  it("asks in the locale, merges the served texts; a remount switches, switching back is cached", async () => {
    const calls: unknown[][] = [];
    const clientFactory: ClientFactory = (url, options) => {
      calls.push(options ? [url, options] : [url]);
      return createMockClient({ meta: metaIn(options?.locale) }).client as Client;
    };
    const locale = ref("de");
    let texts!: UiTexts;
    const Page = defineComponent({
      setup() {
        texts = useAsTexts();
        useTable("/i18n/products", { clientFactory, queryOnMount: false });
        return () => h("div");
      },
    });
    const wrapper = mount(
      defineComponent({
        setup() {
          provideAsLocale(() => locale.value);
          // the documented locale switch: remount the view
          return () => h(Page, { key: locale.value });
        },
      }),
    );
    await flushPromises();
    expect(calls).toEqual([["/i18n/products", { locale: "de" }]]);
    expect(texts.t("UI_TABLE_NO_MATCHING")).toBe("Keine passenden Werte");

    locale.value = "en";
    await nextTick();
    await flushPromises();
    expect(calls.at(-1)).toEqual(["/i18n/products", { locale: "en" }]);
    expect(texts.t("UI_TABLE_NO_MATCHING")).toBe("No matching values");

    locale.value = "de";
    await nextTick();
    await flushPromises();
    expect(calls).toHaveLength(2);
    expect(texts.t("UI_TABLE_NO_MATCHING")).toBe("Keine passenden Werte");
    wrapper.unmount();
  });
});

describe("<AsActionFormDialog> — the action form's own served texts", () => {
  // happy-dom's CSSStyleDeclaration breaks once Reka keeps it in a ref (see
  // dialog-exit-retention.spec.ts); a plain object keeps Presence working.
  const realGetComputedStyle = window.getComputedStyle;
  beforeAll(() => {
    window.getComputedStyle = (() => ({
      animationName: "none",
      display: "block",
      getPropertyValue: () => "",
    })) as unknown as typeof window.getComputedStyle;
  });
  afterAll(() => {
    window.getComputedStyle = realGetComputedStyle;
  });
  // The dialog teleports to <body>: no surface may outlive its test.
  afterEach(() => {
    document.body.innerHTML = "";
  });

  const reschedule: TVueTableActionInfo = {
    name: "reschedule",
    label: "Reschedule",
    level: "row",
    processor: "backend",
    value: "/x/reschedule",
    inputForm: "RescheduleInput",
  };

  const form = defineAnnotatedType("object").prop(
    "when",
    defineAnnotatedType().designType("string").$type,
  ).$type;

  /** The dialog in a table whose client asks in `clientLocale`, under an app in `appLocale`. */
  function mountDialog(
    clientLocale: string,
    appLocale: { value: string },
    getActionFormTexts?: unknown,
    translate?: UiTranslate,
    formType = form,
  ) {
    const asked: string[] = [];
    const client = stubClient({
      getActionForm: () => Promise.resolve(formType),
      getActionFormTexts:
        getActionFormTexts ??
        ((name: string) => {
          asked.push(name);
          return Promise.resolve({ "Some literal": "Ein Literal" });
        }),
    } as never);
    let texts!: UiTexts;
    const Probe = defineComponent({
      setup() {
        texts = useAsTexts();
        return () => null;
      },
    });
    const App = defineComponent({
      setup() {
        provideAsLocale(() => appLocale.value, translate);
        return () => h(Fragment, [h(AsActionFormDialog), h(Probe)]);
      },
    });
    const { state, wrapper } = mountWithTableContext(App, {
      columns: [mockColumn("id")],
      client,
      locale: clientLocale,
    });
    const open = async () => {
      void state.requestActionInput(reschedule, {
        identifiers: [{ id: "A-1" }],
        preferredId: ["id"],
      });
      await flushPromises();
    };
    return { asked, texts: () => texts, open, wrapper };
  }

  it("merges the form's $i18n into the app's texts for its locale when the dialog opens", async () => {
    const { asked, texts, open, wrapper } = mountDialog("de", ref("de"));
    expect(texts().t("Some literal")).toBe("Some literal");
    await open();
    expect(asked).toEqual(["reschedule"]);
    expect(texts().t("Some literal")).toBe("Ein Literal");
    wrapper.unmount();
  });

  it("after a switch without a remount, the table's German texts never land in English", async () => {
    const appLocale = ref("de");
    const { texts, open, wrapper } = mountDialog("de", appLocale);
    appLocale.value = "en";
    await open();
    expect(texts().locale()).toBe("en");
    expect(texts().t("Some literal")).toBe("Some literal");
    wrapper.unmount();
  });

  describe("the dialog's own texts", () => {
    const titled = () =>
      defineAnnotatedType("object")
        .prop("when", defineAnnotatedType().designType("string").$type)
        .annotate("meta.label" as never, "Reschedule order" as never).$type;

    it("a form schema compiled into the client is titled in the app's language", async () => {
      const { open, wrapper } = mountDialog(
        "de",
        ref("de"),
        () => Promise.resolve(undefined),
        titleDe,
        titled(),
      );
      await open();
      expect(titleOf()).toBe("Bestellung verschieben");
      wrapper.unmount();
    });

    it("a form schema the server served translated (with $i18n) is not translated again", async () => {
      const { open, wrapper } = mountDialog("de", ref("de"), undefined, titleDe, titled());
      await open();
      expect(titleOf()).toBe("Reschedule order");
      wrapper.unmount();
    });
  });

  it("a failing lookup of the form's texts never blocks the form", async () => {
    const { open, wrapper } = mountDialog("de", ref("de"), () =>
      Promise.reject(new Error("offline")),
    );
    await open();
    const surfaces = document.body.querySelectorAll(".as-action-form-content");
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]!.textContent).not.toContain("offline");
    expect(surfaces[0]!.querySelector("input")).not.toBeNull();
    wrapper.unmount();
  });
});
