// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, ref, shallowRef } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import type { AsPresetEntryRow } from "@atscript/ui-table";
import AsPresetDialog from "../components/defaults/as-preset-dialog.vue";
import AsPresetPicker from "../components/as-preset-picker.vue";
import { provideTableContext } from "../composables/use-table-state";
import type { PresetSurface, ReactiveTableState } from "../types";
import { stubClient } from "./helpers";

// Regression: every preset mutation failure used to be swallowed — the
// popover/dialog closed as if the write had landed, and nothing said why.

function row(id: string, label: string): AsPresetEntryRow {
  return {
    id,
    type: "preset",
    app: "demo",
    tableKey: "t",
    user: "me",
    label,
    data: { label },
    createdAt: 0,
    updatedAt: 0,
  } as AsPresetEntryRow;
}

function makePresetSurface(overrides: Partial<PresetSurface> = {}) {
  const presets = shallowRef<AsPresetEntryRow[]>([]);
  const surface = {
    presets,
    presetsById: computed(() => new Map(presets.value.map((r) => [r.id, r]))),
    userConf: shallowRef(null),
    capabilities: ref(null),
    systemPresets: computed(() => []),
    systemPresetsById: computed(() => new Map()),
    availableAspects: ["columns", "filters", "filterOps", "sorters"],
    systemAspects: ["columns", "filters", "filterOps", "sorters"],
    ownedAspects: () => ["columns", "filters", "filterOps", "sorters"],
    available: computed(() => true),
    activeId: ref<string | null>(null),
    activeSnapshot: computed(() => ({})),
    isDirty: computed(() => false),
    canSaveActive: computed(() => false),
    currentUser: computed(() => "me"),
    isOwned: () => true,
    dialogOpen: ref(false),
    ready: computed(() => true),
    captureSnapshot: () => ({}),
    apply: vi.fn(),
    resetActive: vi.fn(),
    clearLocalDraft: vi.fn(),
    resolveDefaultId: () => "sys:standard",
    saveActive: vi.fn(async () => {}),
    saveAs: vi.fn(async () => "new"),
    rename: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    togglePublic: vi.fn(async () => {}),
    setDefault: vi.fn(async () => {}),
    toggleFav: vi.fn(async () => {}),
    setFavorites: vi.fn(async () => {}),
    batch: async <T>(fn: () => Promise<T>) => fn(),
    lastError: ref<Error | null>(null),
    ...overrides,
  };
  return surface as unknown as PresetSurface;
}

const mounted: { unmount: () => void }[] = [];
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount();
  document.body.innerHTML = "";
});

function mountWithPreset(component: unknown, preset: PresetSurface) {
  const state = { preset, residualFilters: shallowRef([]) } as unknown as ReactiveTableState;
  const Host = defineComponent({
    setup() {
      provideTableContext({ state, client: stubClient(), controls: {} });
      return () => h(component as never);
    },
  });
  const wrapper = mount(Host, { attachTo: document.body });
  mounted.push(wrapper);
  return wrapper;
}

/** Open the picker menu and step into the inline Save-as popover. */
async function openSaveAsPopover(): Promise<void> {
  document.querySelector<HTMLElement>(".as-preset-picker-trigger")!.click();
  await flushPromises();
  [...document.querySelectorAll<HTMLElement>(".as-preset-picker-action")]
    .find((el) => el.textContent?.includes("Save as"))!
    .click();
  await flushPromises();
}

/** Type a preset name into the open popover and hit Save. */
async function submitSaveAs(label: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(".as-preset-picker-popover-input")!;
  input.value = label;
  input.dispatchEvent(new Event("input"));
  await flushPromises();
  document.querySelector<HTMLElement>(".as-preset-picker-popover-save")!.click();
  await flushPromises();
}

describe("<AsPresetPicker> — mutation failures", () => {
  it("keeps the popover open and renders the message when save-as fails", async () => {
    // Mirrors the real slice: the mutator RECORDS on `lastError` (the single
    // channel the picker renders) and rethrows.
    let preset!: PresetSurface;
    const saveAs = vi.fn(async () => {
      const err = new Error("A preset with that name already exists");
      preset.lastError.value = err;
      throw err;
    });
    preset = makePresetSurface({ saveAs: saveAs as never });
    mountWithPreset(AsPresetPicker, preset);

    await openSaveAsPopover();
    await submitSaveAs("My view");

    expect(saveAs).toHaveBeenCalledTimes(1);
    // Popover still open…
    expect(document.querySelector(".as-preset-picker-popover-input")).not.toBeNull();
    // …and the reason is on screen for a screen reader too.
    const alert = document.querySelector<HTMLElement>('.as-preset-picker-error[role="alert"]')!;
    expect(alert.textContent).toContain("already exists");

    // Layout contract, not styling: the Cancel/Save pair and the failure note
    // are SIBLINGS of the scrolling region, never inside it. When one box both
    // caps and scrolls, they ride out of view on a short viewport — so the
    // reason a save just failed can only be read by scrolling to it.
    const body = document.querySelector(".as-preset-picker-popover-body")!;
    const inner = document.querySelector(".as-preset-picker-popover-inner")!;
    const footer = document.querySelector(".as-preset-picker-popover-footer")!;
    expect(body.querySelector(".as-preset-picker-popover-input")).not.toBeNull();
    for (const pinned of [footer, alert]) {
      expect(body.contains(pinned)).toBe(false);
      expect(inner.contains(pinned)).toBe(true);
    }
  });

  it("closes the popover on success", async () => {
    const preset = makePresetSurface();
    mountWithPreset(AsPresetPicker, preset);

    await openSaveAsPopover();
    await submitSaveAs("My view");

    expect(document.querySelector(".as-preset-picker-popover-input")).toBeNull();
    expect(document.querySelector(".as-preset-picker-error")).toBeNull();
  });
});

describe("<AsPresetDialog> — mutation failures", () => {
  async function openDialogWithRows() {
    const rename = vi.fn(async (_id: string, _label: string) => {
      throw new Error("Rename was rejected by the server");
    });
    const preset = makePresetSurface({ rename: rename as never });
    (preset.presets as { value: AsPresetEntryRow[] }).value = [row("p1", "Alpha")];
    mountWithPreset(AsPresetDialog, preset);
    preset.dialogOpen.value = true;
    await flushPromises();
    return { preset, rename };
  }

  it("stays open, keeps the failed edit staged and shows the error", async () => {
    const { preset, rename } = await openDialogWithRows();

    const labelText = document.querySelector<HTMLElement>(".as-preset-dialog-row-label-text")!;
    labelText.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await flushPromises();

    const input = document.querySelector<HTMLInputElement>(".as-preset-dialog-row-rename")!;
    input.value = "Beta";
    input.dispatchEvent(new Event("input"));
    await flushPromises();

    const saveBtn = document.querySelector<HTMLButtonElement>(".as-preset-dialog-footer-save")!;
    expect(saveBtn.disabled).toBe(false);
    saveBtn.click();
    await flushPromises();

    expect(rename).toHaveBeenCalledWith("p1", "Beta");
    // Dialog is still open…
    expect(preset.dialogOpen.value).toBe(true);
    // …the error is announced…
    const alert = document.querySelector<HTMLElement>(
      '.as-preset-dialog-footer-error[role="alert"]',
    );
    expect(alert?.textContent).toContain("rejected by the server");
    // …and the staged rename survived, so Save can be retried.
    expect(saveBtn.disabled).toBe(false);
    expect(document.querySelector<HTMLInputElement>(".as-preset-dialog-row-rename")?.value).toBe(
      "Beta",
    );
  });

  it("closes when every write succeeds", async () => {
    const preset = makePresetSurface();
    (preset.presets as { value: AsPresetEntryRow[] }).value = [row("p1", "Alpha")];
    mountWithPreset(AsPresetDialog, preset);
    preset.dialogOpen.value = true;
    await flushPromises();

    document
      .querySelector<HTMLElement>(".as-preset-dialog-row-label-text")!
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await flushPromises();
    const input = document.querySelector<HTMLInputElement>(".as-preset-dialog-row-rename")!;
    input.value = "Beta";
    input.dispatchEvent(new Event("input"));
    await flushPromises();

    document.querySelector<HTMLButtonElement>(".as-preset-dialog-footer-save")!.click();
    await flushPromises();

    expect(preset.rename).toHaveBeenCalledWith("p1", "Beta");
    expect(preset.dialogOpen.value).toBe(false);
  });
});
