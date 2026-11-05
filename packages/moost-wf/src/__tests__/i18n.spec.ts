import type { TSerializedAnnotatedType } from "@atscript/typescript/utils";
import { HandleStateStrategy, WfStateStoreMemory } from "@prostojs/wf/outlets";
import { EventContext, run, useLocale } from "@wooksjs/event-core";
import { createHttpApp, useAcceptLanguage } from "@wooksjs/event-http";
import { createWfApp, useWfState } from "@wooksjs/event-wf";
import { getTranslatorLocales, setTranslator } from "moost";
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { handleAsOutletRequest } from "../handle";
import { createAsHttpOutlet } from "../outlet";
import { abortWf, finishWf } from "../wf-finished";
import { serializeFormSchema } from "../wf-io/serialize";
import { useAtscriptWf } from "../wf-io/use-atscript-wf";
import { I18nForm } from "./fixtures/wf-forms.as";

const DE = {
  Profile: "Profil",
  "Your name": "Ihr Name",
  Skip: "Überspringen",
  MIN_LENGTH: "Mindestens {min} Zeichen",
  UI_CANCEL: "Abbrechen",
  "Name is taken": "Name ist vergeben",
  "Please check": "Bitte prüfen",
  'Action "{action}" is not supported': 'Aktion "{action}" wird nicht unterstützt',
  "Saved.": "Gespeichert.",
  "Go home": "Zur Startseite",
  "Too many tries": "Zu viele Versuche",
  // An abort reason is a machine slug: never translated, even with an entry.
  "rate-limited": "begrenzt",
  // A value of the workflow's context: never translated.
  "keep me": "NICHT ÜBERSETZEN",
};

const store = new WfStateStoreMemory();
const strategy = new HandleStateStrategy({ store });
const http = createHttpApp({
  // What MoostHttp does by default: negotiate against the translator's locales.
  resolveLocale: () => {
    const locales = getTranslatorLocales();
    return locales.length ? useAcceptLanguage().negotiate(locales, locales[0]) : undefined;
  },
});
const wf = createWfApp<Record<string, unknown>>();

beforeAll(() => {
  wf.step("i18n-ask", {
    handler: () => {
      const form = useAtscriptWf(I18nForm);
      form.resolveAction();
      const input = form.resolveInput();
      if (input.name === "taken") throw form.requireInput({ errors: { name: "Name is taken" } });
      if (input.name === "check") throw form.requireInput({ formMessage: "Please check" });
      useWfState().ctx<Record<string, unknown>>().name = input.name;
    },
  });
  wf.step("i18n-done", {
    handler: () =>
      finishWf({
        message: { level: "success", text: "Saved." },
        next: {
          trigger: "manual",
          primary: { label: "Go home", action: { type: "dismiss" } },
          options: [{ label: "Skip", action: { type: "reload" } }],
        },
      }),
  });
  wf.step("i18n-abort", {
    handler: () =>
      abortWf("rate-limited", {
        message: { level: "warn", text: "Too many tries" },
        next: {
          trigger: "auto",
          timeoutMs: 1,
          action: { type: "reload" },
          skipButton: { label: "Skip" },
        },
      }),
  });
  wf.flow("i18n/form", ["i18n-ask", "i18n-done"]);
  wf.flow("i18n/abort", ["i18n-abort"]);
  http.post("/wf", () =>
    handleAsOutletRequest(
      {
        allow: ["i18n/form", "i18n/abort"],
        state: strategy,
        outlets: [createAsHttpOutlet()],
        token: { read: ["body"], write: "body", name: "wfs" },
        initialContext: () => ({ note: "keep me" }),
      },
      {
        start: (schemaId, context, opts) => wf.start(schemaId, context as never, opts as never),
        resume: (state, opts) => wf.resume(state as never, opts as never),
      },
    ),
  );
});

afterEach(() => setTranslator(undefined));

interface Answer {
  status: number;
  json: {
    wfs?: string;
    inputRequired?: { payload: TSerializedAnnotatedType; context: Record<string, unknown> };
    [key: string]: unknown;
  };
}

async function post(body: Record<string, unknown>, lang?: string): Promise<Answer> {
  const res = await http.request("/wf", {
    method: "POST",
    headers: { "content-type": "application/json", ...(lang ? { "accept-language": lang } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res!.status, json: (await res!.json()) as Answer["json"] };
}

/** Starts the form flow and submits `formData` (with `action`). */
async function submit(formData: unknown, lang?: string, action?: string) {
  const start = await post({ wfid: "i18n/form" }, lang);
  return post({ wfs: start.json.wfs, input: { formData, action } }, lang);
}

const deTranslator = () => setTranslator({ en: {}, de: DE });

/** `fn` inside an event whose locale is `locale`. */
function inLocale<T>(locale: string, fn: () => T): T {
  const ctx = new EventContext({ logger: console as never });
  return run(ctx, () => {
    useLocale().set(locale);
    return fn();
  });
}
const props = (schema: TSerializedAnnotatedType) =>
  (schema.type as unknown as { props: Record<string, TSerializedAnnotatedType> }).props;

describe("moost-wf in the request's language", () => {
  it("serves the form schema translated, with $i18n, for Accept-Language: de", async () => {
    deTranslator();
    const { json } = await post({ wfid: "i18n/form" }, "de");
    const schema = json.inputRequired!.payload;
    expect(schema.metadata["meta.label"]).toBe("Profil");
    expect(props(schema).name!.metadata["ui.form.placeholder"]).toBe("Ihr Name");
    expect(props(schema).skipAction!.metadata["ui.form.action"]).toEqual({
      id: "skip",
      label: "Überspringen",
    });
    // The validator's and the UI components' templates, in German.
    expect(schema.$i18n).toMatchObject({
      MIN_LENGTH: "Mindestens {min} Zeichen",
      UI_CANCEL: "Abbrechen",
    });
    // The passed context is data, never translated.
    expect(json.inputRequired!.context.note).toBe("keep me");
  });

  it("serves the source schema without Accept-Language (default locale) and without translator", async () => {
    const untranslated = (await post({ wfid: "i18n/form" })).json.inputRequired!.payload;
    expect(untranslated).toEqual(serializeFormSchema(I18nForm));
    expect(untranslated).not.toHaveProperty("$i18n");
    deTranslator();
    const english = (await post({ wfid: "i18n/form" })).json.inputRequired!.payload;
    expect(JSON.stringify(english)).toBe(JSON.stringify(untranslated));
  });

  it("is the same object without a translator, and one memoized object per locale", () => {
    const source = serializeFormSchema(I18nForm);
    expect(serializeFormSchema(I18nForm)).toBe(source);
    deTranslator();
    const de = inLocale("de", () => serializeFormSchema(I18nForm));
    expect(de).not.toBe(source);
    expect(inLocale("de", () => serializeFormSchema(I18nForm))).toBe(de);
    // Nothing to translate in the source language: the source schema itself.
    expect(inLocale("en", () => serializeFormSchema(I18nForm))).toBe(source);
    // Opt-out: the source texts.
    expect(inLocale("de", () => serializeFormSchema(I18nForm, { translate: false }))).toBe(source);
    // A new translator is a new generation: the locale's entry is replaced.
    setTranslator({ en: {}, de: { ...DE, Profile: "Profil!" } });
    const de2 = inLocale("de", () => serializeFormSchema(I18nForm)) as TSerializedAnnotatedType;
    expect(de2).not.toBe(de);
    expect(de2.metadata["meta.label"]).toBe("Profil!");
    // A locale outside the translator's locales: translated per call, not memoized.
    setTranslator((id, _params, { locale }) =>
      locale === "de" ? DE[id as keyof typeof DE] : undefined,
    );
    const a = inLocale("de", () => serializeFormSchema(I18nForm));
    const b = inLocale("de", () => serializeFormSchema(I18nForm));
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("localizes validation errors by code before building the error map", async () => {
    deTranslator();
    const de = await submit({ name: "ab" }, "de");
    expect(de.json.inputRequired!.context.errors).toEqual({ name: "Mindestens 3 Zeichen" });
    setTranslator(undefined);
    const en = await submit({ name: "ab" });
    expect(en.json.inputRequired!.context.errors).toEqual({
      name: "Expected minimum length of 3 characters, got 2 characters",
    });
  });

  it("translates requireInput errors and formMessage by their text", async () => {
    deTranslator();
    expect((await submit({ name: "taken" }, "de")).json.inputRequired!.context.errors).toEqual({
      name: "Name ist vergeben",
    });
    expect((await submit({ name: "check" }, "de")).json.inputRequired!.context.errors).toEqual({
      __form: "Bitte prüfen",
    });
    expect((await submit(undefined, "de", "nope")).json.inputRequired!.context.errors).toEqual({
      __form: 'Aktion "nope" wird nicht unterstützt',
    });
  });

  it("translates finishWf / abortWf texts at call time, never the abort reason", async () => {
    deTranslator();
    const done = await submit({ name: "Alice" }, "de");
    expect(done.json).toMatchObject({
      finished: true,
      message: { level: "success", text: "Gespeichert." },
      next: {
        trigger: "manual",
        primary: { label: "Zur Startseite" },
        options: [{ label: "Überspringen" }],
      },
    });
    const aborted = await post({ wfid: "i18n/abort" }, "de");
    expect(aborted.json).toMatchObject({
      aborted: true,
      reason: "rate-limited",
      message: { text: "Zu viele Versuche" },
      next: { skipButton: { label: "Überspringen" } },
    });
    expect((await post({ wfid: "i18n/abort" })).json.message).toMatchObject({
      text: "Too many tries",
    });
  });

  it("never translates the persisted state", async () => {
    deTranslator();
    const start = await post({ wfid: "i18n/form" }, "de");
    const persisted = await strategy.retrieve(start.json.wfs!.replace(/^[^.]*\./, ""));
    expect(persisted?.context).toEqual({ note: "keep me" });
  });
});
