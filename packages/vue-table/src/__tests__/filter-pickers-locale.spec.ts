// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { resetDefaultClientFactory, resetMetaCache, setUiLocale } from "@atscript/ui";
import AsFilterField from "../components/defaults/as-filter-field.vue";
import AsFilterDialog from "../components/defaults/as-filter-dialog.vue";
import { mockColumn, mountWithTableContext, ownerColumn, recordingFactory } from "./helpers";

afterEach(() => {
  setUiLocale(undefined);
  resetMetaCache();
  resetDefaultClientFactory();
  document.body.innerHTML = "";
});

const owner = ownerColumn();

// Why: the pickers were keyed by `texts.locale()`, which without a
// `provideAsLocale` reads the browser-global locale — not reactive, so a
// `setUiLocale` switch left them asking in the old locale.
describe("filter pickers follow setUiLocale", () => {
  it("<AsFilterField> rebuilds its pickers in the new locale", async () => {
    const { asked, factory } = recordingFactory();
    setUiLocale("de");
    const { wrapper } = mountWithTableContext(AsFilterField, {
      columns: [owner],
      props: { column: owner },
      clientFactory: factory as never,
    });
    await flushPromises();
    expect(asked).toEqual([["/owners", "de"]]);

    setUiLocale("en");
    await nextTick();
    await flushPromises();
    expect(asked).toEqual([
      ["/owners", "de"],
      ["/owners", "en"],
    ]);
    wrapper.unmount();
  });

  it("the filter dialog rebuilds its value-help picker in the new locale", async () => {
    const { asked, factory } = recordingFactory();
    setUiLocale("de");
    const { wrapper } = mountWithTableContext(AsFilterDialog, {
      columns: [mockColumn("id"), owner],
      clientFactory: factory as never,
      onReady: (state) => state.openFilterDialog(owner),
    });
    await flushPromises();
    await nextTick();
    expect(asked).toContainEqual(["/owners", "de"]);
    expect(asked).not.toContainEqual(["/owners", "en"]);

    setUiLocale("en");
    await nextTick();
    await flushPromises();
    expect(asked).toContainEqual(["/owners", "en"]);
    wrapper.unmount();
  });
});
