import type { Client } from "@atscript/db-client";
import {
  resetDefaultClientFactory,
  resetValueHelpCache,
  setDefaultClientFactory,
  type ClientFactory,
  type ValueHelpInfo,
} from "@atscript/ui";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useValueHelp } from "./use-value-help";

function buildAuthorMeta() {
  const author = defineAnnotatedType("object");
  author.prop("id", defineAnnotatedType().designType("number").annotate("meta.id", true).$type);
  author.prop(
    "name",
    defineAnnotatedType().designType("string").annotate("ui.dict.label", true).$type,
  );
  author.prop(
    "bio",
    defineAnnotatedType().designType("string").annotate("ui.dict.descr", true).$type,
  );
  author.annotate("db.http.path" as keyof AtscriptMetadata, "/authors" as never);

  return {
    searchable: true,
    vectorSearchable: false,
    searchIndexes: [],
    primaryKeys: ["id"],
    readOnly: false,
    relations: [],
    fields: {
      id: { sortable: true, filterable: true },
      name: { sortable: true, filterable: true },
    },
    type: serializeAnnotatedType(author.$type),
  };
}

function makeFactory(impl: { meta?: () => Promise<unknown>; query?: () => Promise<unknown> }): {
  factory: ClientFactory;
  metaSpy: ReturnType<typeof vi.fn>;
} {
  const metaSpy = vi.fn(impl.meta ?? (async () => ({})));
  const querySpy = vi.fn(impl.query ?? (async () => []));
  const factory: ClientFactory = () =>
    ({
      meta: metaSpy,
      query: querySpy,
    }) as unknown as Client;
  return { factory, metaSpy };
}

/** Wrap a composable call inside a Vue component so lifecycle hooks run. */
function withComposable<T>(fn: () => T): { ret: T; unmount: () => void } {
  let ret!: T;
  const Harness = defineComponent({
    setup() {
      ret = fn();
      return () => h("div");
    },
  });
  const wrapper = mount(Harness);
  return { ret, unmount: () => wrapper.unmount() };
}

afterEach(() => {
  resetValueHelpCache();
  resetDefaultClientFactory();
});

describe("useValueHelp (eager-on-mount)", () => {
  it("fires a single meta fetch on mount and populates resolved", async () => {
    const meta = buildAuthorMeta();
    const { factory, metaSpy } = makeFactory({ meta: async () => meta });
    setDefaultClientFactory(factory);

    const info: ValueHelpInfo = { url: "/authors", targetField: "id" };
    const model = ref<{ value: unknown }>({ value: undefined });

    const { ret: vh, unmount } = withComposable(() =>
      useValueHelp({ info, model: model.value, onBlur: () => {} }),
    );

    await nextTick();
    await vh.kickoff();

    expect(metaSpy).toHaveBeenCalledTimes(1);
    expect(vh.resolved.value).not.toBeNull();
    expect(vh.resolved.value!.labelField).toBe("name");
    expect(vh.resolved.value!.descrField).toBe("bio");
    expect(vh.status.value).toBe("ready");

    unmount();
  });

  it("calling kickoff() again after mount does not re-fetch", async () => {
    const meta = buildAuthorMeta();
    const { factory, metaSpy } = makeFactory({ meta: async () => meta });
    setDefaultClientFactory(factory);

    const info: ValueHelpInfo = { url: "/authors", targetField: "id" };
    const model = ref<{ value: unknown }>({ value: undefined });

    const { ret: vh, unmount } = withComposable(() =>
      useValueHelp({ info, model: model.value, onBlur: () => {} }),
    );

    await vh.kickoff();
    await vh.kickoff();

    expect(metaSpy).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("flips status = 'error' on fetch rejection", async () => {
    const { factory } = makeFactory({
      meta: async () => {
        throw new Error("forbidden");
      },
    });
    setDefaultClientFactory(factory);

    const info: ValueHelpInfo = { url: "/authors", targetField: "id" };
    const model = ref<{ value: unknown }>({ value: undefined });

    const { ret: vh, unmount } = withComposable(() =>
      useValueHelp({ info, model: model.value, onBlur: () => {} }),
    );

    await nextTick();
    await vh.kickoff();

    expect(vh.resolved.value).toBeNull();
    expect(vh.status.value).toBe("error");

    unmount();
  });
});
