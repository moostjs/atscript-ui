import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { defineAnnotatedType } from "@atscript/typescript/utils";
import { provideAsLocale, useAsLocale } from "@atscript/vue-form";
import { useWfForm } from "../use-wf-form";
import type { UseWfFormOptions, UseWfFormReturn } from "../use-wf-form";
import { mockFetch, mockInputRequired } from "./helpers";

const Form = defineAnnotatedType("object").prop(
  "name",
  defineAnnotatedType().designType("string").$type,
).$type;

/** An `inputRequired` answer whose form schema carries served texts. */
function withTexts(texts: Record<string, string>) {
  const answer = mockInputRequired(Form);
  (answer.inputRequired.payload as { $i18n?: unknown }).$i18n = texts;
  return answer;
}

function mountWf(opts: Partial<UseWfFormOptions>, locale?: () => string | undefined) {
  let wf!: UseWfFormReturn;
  let t!: ReturnType<typeof useAsLocale>["t"];
  const Probe = defineComponent({
    setup() {
      wf = useWfForm({ path: "/wf", name: "flow", autoStart: false, ...opts });
      t = useAsLocale().t;
      return () => h("div");
    },
  });
  const Root = defineComponent({
    setup() {
      if (locale) provideAsLocale(locale);
      return () => h(Probe);
    },
  });
  const wrapper = mount(Root);
  return { wf: () => wf, t: () => t, wrapper };
}

const headersOf = (init?: RequestInit) => (init?.headers ?? {}) as Record<string, string>;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useWfForm — locale", () => {
  it("sends Accept-Language from the provided locale on start, submit and resume", async () => {
    const { calls } = mockFetch([mockInputRequired(Form), mockInputRequired(Form), {}]);
    const lang = ref("de");
    const { wf, wrapper } = mountWf({ initialToken: "tok" }, () => lang.value);
    await wf().start();
    await wf().submit({ name: "a" });
    lang.value = "fr";
    await wf().retry();
    expect(calls.map((c) => headersOf(c.init)["Accept-Language"])).toEqual(["de", "de", "fr"]);
    expect(headersOf(calls[0].init)["Content-Type"]).toBe("application/json");
    wrapper.unmount();
  });

  it("keeps the app's own Accept-Language header, whatever its case", async () => {
    const { calls } = mockFetch([mockInputRequired(Form)]);
    const { wf, wrapper } = mountWf(
      { fetchOptions: { headers: { "accept-language": "it" } } },
      () => "de",
    );
    await wf().start();
    const headers = headersOf(calls[0].init);
    expect(headers["accept-language"]).toBe("it");
    expect(headers["Accept-Language"]).toBeUndefined();
    wrapper.unmount();
  });

  it("sends no Accept-Language without a locale", async () => {
    const { calls } = mockFetch([mockInputRequired(Form)]);
    const { wf, wrapper } = mountWf({});
    await wf().start();
    expect(Object.keys(headersOf(calls[0].init))).toEqual(["Content-Type"]);
    wrapper.unmount();
  });
});

describe("useWfForm — served texts", () => {
  it("merges a form schema's $i18n into the app's texts for the request's locale", async () => {
    mockFetch([withTexts({ UI_FORM_SUBMIT: "Absenden", Name: "Name (de)" })]);
    const { wf, t, wrapper } = mountWf({}, () => "de");
    expect(t()("UI_FORM_SUBMIT")).toBe("Submit");
    await wf().start();
    expect(t()("UI_FORM_SUBMIT")).toBe("Absenden");
    expect(t()("Name")).toBe("Name (de)");
    wrapper.unmount();
  });

  it("marks a form schema that carries $i18n as served: its texts are not translated again", async () => {
    mockFetch([
      withTexts({ UI_FORM_SUBMIT: "Absenden" }),
      mockInputRequired(Form, { token: "t2" }),
    ]);
    const { wf, wrapper } = mountWf({}, () => "de");
    await wf().start();
    expect(wf().formDef.value?.served).toBe(true);
    // a schema without `$i18n` is untranslated source: the app's `t` words it
    await wf().submit({ name: "a" });
    expect(wf().formDef.value?.served).toBeUndefined();
    wrapper.unmount();
  });

  it("texts answering the app's own Accept-Language don't land in the provider's locale", async () => {
    mockFetch([withTexts({ UI_FORM_SUBMIT: "Invia" })]);
    const { wf, t, wrapper } = mountWf(
      { fetchOptions: { headers: { "Accept-Language": "it" } } },
      () => "de",
    );
    await wf().start();
    expect(t()("UI_FORM_SUBMIT")).toBe("Submit");
    wrapper.unmount();
  });

  it("a late answer for a previous locale lands in that locale, not the current one", async () => {
    let answer!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );
    const lang = ref("de");
    const { wf, t, wrapper } = mountWf({}, () => lang.value);
    const started = wf().start();
    lang.value = "fr"; // the user switches before the answer arrives
    answer({ ok: true, json: async () => withTexts({ UI_FORM_SUBMIT: "Absenden" }) } as Response);
    await started;
    await nextTick();
    expect(t()("UI_FORM_SUBMIT")).toBe("Submit");
    lang.value = "de";
    expect(t()("UI_FORM_SUBMIT")).toBe("Absenden");
    wrapper.unmount();
  });

  it("network-error texts come from the served dict, else English", async () => {
    const fail = (status: number) =>
      vi.fn(async () => ({ ok: false, status, json: async () => null }) as unknown as Response);
    mockFetch([withTexts({ UI_WF_STATUS_410: "Sitzung abgelaufen." })]);
    const { wf, wrapper } = mountWf({}, () => "de");
    await wf().start();
    vi.stubGlobal("fetch", fail(410));
    await wf().submit({ name: "x" });
    expect((wf().error.value as { message: string }).message).toBe("Sitzung abgelaufen.");
    vi.stubGlobal("fetch", fail(404));
    await wf().submit({ name: "x" });
    expect((wf().error.value as { message: string }).message).toBe(
      "We couldn't find what you're looking for.",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw "offline";
      }),
    );
    await wf().submit({ name: "x" });
    expect((wf().error.value as { message: string }).message).toBe("Network error");
    await flushPromises();
    wrapper.unmount();
  });
});
