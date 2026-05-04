<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";
import { computed, onScopeDispose, ref, watch } from "vue";
import {
  type AsPresetEntryRow,
  type AspectMask,
  type PresetAspect,
  type SystemPreset,
  isSystemPresetId,
} from "@atscript/ui-table";
import { useTableContext } from "../composables/use-table-state";
import {
  ASPECT_ICONS,
  ASPECT_LABELS,
  aspectsOf,
  ownerNameOf,
  readPresetLabel,
} from "../composables/preset-aspect-display";

/**
 * Tier-1 dropdown picker. Renders nothing when the presets feature is
 * disabled (`presetsAvailable = false`), so consumers can place
 * `<AsPresetPicker />` unconditionally in their toolbar.
 */
const { state } = useTableContext();

const open = ref(false);
const saveAsOpen = ref(false);
const saveAsLabel = ref("");
const saveAsPublic = ref(false);
const saveAsAspectsMask = ref<AspectMask>({});
const saveAsInputRef = ref<HTMLInputElement | null>(null);

// Two RAF ticks past Reka's DropdownMenuContent focus management — one
// for Vue mount, one for Reka's settle — lets focus + select stick.
watch(saveAsOpen, (open) => {
  if (!open) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      saveAsInputRef.value?.focus();
      saveAsInputRef.value?.select();
    });
  });
});

const aspects = computed<PresetAspect[]>(() => state.preset.availableAspects);

function resetSaveAsForm() {
  // "Copy of …" prefill makes branching from an existing preset legible;
  // Standard / no-active starts blank.
  const base = activePresetLabel.value;
  saveAsLabel.value = base ? `Copy of ${base}` : "";
  saveAsPublic.value = false;
  const claimed = activePresetClaimedAspects.value;
  const initial: AspectMask = {};
  for (const a of aspects.value) initial[a] = claimed.has(a);
  saveAsAspectsMask.value = initial;
}

const activePresetClaimedAspects = computed<Set<PresetAspect>>(() => {
  const id = state.preset.activeId.value;
  // System presets claim every available aspect (spec §3.7); same default
  // when there's no active preset (Save-as prefills from current state).
  if (!id || isSystemPresetId(id)) return new Set(aspects.value);
  const row = state.preset.presetsById.value.get(id);
  if (!row) return new Set(aspects.value);
  return new Set(aspectsOf(row, aspects.value));
});

function openSaveAs() {
  resetSaveAsForm();
  saveAsOpen.value = true;
}

function cancelSaveAs() {
  saveAsOpen.value = false;
}

async function commitSaveAs() {
  const label = saveAsLabel.value.trim();
  if (!label) return;
  try {
    await state.preset.saveAs(label, {
      aspects: saveAsAspectsMask.value,
      public: saveAsPublic.value,
    });
    saveAsOpen.value = false;
    open.value = false;
  } catch (_err) {
    // Surface upstream via state.lastError; keep the popover open so the
    // user can retry or tweak the label after a 409 / publish-name conflict.
  }
}

interface PresetItem {
  id: string;
  label: string;
  meta?: string;
  fav?: boolean;
  system?: boolean;
  /** Aspects this preset will write on apply — drives the per-item icon strip. */
  aspects: PresetAspect[];
}

interface PickerSection {
  /** Stable key for `v-for` and used as a per-item key prefix. */
  kind: "system" | "mine" | "fav";
  /** Section header label; rendered only when `showHeader` is true. */
  label: string;
  showHeader: boolean;
  items: PresetItem[];
}

function authorMeta(row: AsPresetEntryRow): string {
  const name = ownerNameOf(row);
  return name ? `· ${name}` : "";
}

function systemItem(p: SystemPreset, fav?: boolean): PresetItem {
  return {
    id: p.id,
    label: p.label,
    system: true,
    fav,
    // Spec §3.7 — system presets claim every available aspect.
    aspects: [...state.preset.availableAspects],
  };
}

function storedItem(row: AsPresetEntryRow, fav: boolean, meta?: string): PresetItem {
  return {
    id: row.id,
    label: readPresetLabel(row),
    fav,
    meta,
    aspects: aspectsOf(row, state.preset.availableAspects),
  };
}

const favIds = computed<Set<string>>(() => {
  const arr = (state.preset.userConf.value?.data as { favPresetIds?: string[] } | undefined)?.favPresetIds;
  return new Set(arr ?? []);
});

// Favorites excludes own rows (they already render under "My presets");
// system favorites surface here since system presets aren't "owned".
const sections = computed<PickerSection[]>(() => {
  const ids = favIds.value;
  const sys = state.preset.systemPresets.value;
  const mine: PresetItem[] = [];
  const fav: PresetItem[] = [];
  for (const row of state.preset.presets.value) {
    if (state.preset.isOwned(row.id)) {
      mine.push(storedItem(row, ids.has(row.id), row.public === true ? "public" : undefined));
    }
  }
  for (const id of ids) {
    if (isSystemPresetId(id)) {
      const sp = state.preset.systemPresetsById.value.get(id);
      if (sp) fav.push(systemItem(sp, true));
      continue;
    }
    if (state.preset.isOwned(id)) continue;
    const row = state.preset.presetsById.value.get(id);
    if (row) fav.push(storedItem(row, true, authorMeta(row)));
  }
  return [
    {
      kind: "system",
      label: "System",
      // Hide the header when there's only the Standard preset — it
      // renders without a "System" caption like a default row.
      showHeader: sys.length > 1,
      items: sys.map((p) => systemItem(p)),
    },
    { kind: "mine", label: "My presets", showHeader: true, items: mine },
    { kind: "fav", label: "Favorites", showHeader: true, items: fav },
  ];
});

const activePresetLabel = computed(() => {
  const id = state.preset.activeId.value;
  if (!id) return "Standard";
  if (isSystemPresetId(id)) {
    return state.preset.systemPresetsById.value.get(id)?.label ?? "Standard";
  }
  const row = state.preset.presetsById.value.get(id);
  return row ? readPresetLabel(row) : "—";
});

function applyId(id: string) {
  state.preset.apply(id);
  open.value = false;
}

async function saveActive() {
  try {
    await state.preset.saveActive();
    open.value = false;
  } catch (_err) {
    // Same as save-as: error surfaces via state.lastError; keep the menu open.
  }
}

function resetActive() {
  state.preset.resetActive();
  open.value = false;
}

function openManageDialog() {
  state.preset.dialogOpen.value = true;
  open.value = false;
}

function toggleAspect(a: PresetAspect, ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked;
  saveAsAspectsMask.value = { ...saveAsAspectsMask.value, [a]: checked };
}

// Single-letter shortcuts only while the menu is open and the Save-as
// inline form is closed (so typing a label doesn't trigger them).
function onMenuKeydown(ev: KeyboardEvent) {
  if (saveAsOpen.value) return;
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const k = ev.key.toLowerCase();
  if (k === "s" && state.preset.isDirty.value && state.preset.canSaveActive.value) {
    ev.preventDefault();
    void saveActive();
  } else if (k === "a") {
    ev.preventDefault();
    openSaveAs();
  } else if (k === "r" && state.preset.isDirty.value) {
    ev.preventDefault();
    resetActive();
  }
}
watch(open, (isOpen) => {
  if (isOpen) window.addEventListener("keydown", onMenuKeydown);
  else window.removeEventListener("keydown", onMenuKeydown);
});
// Belt-and-braces: if the component unmounts while open, the watcher's
// cleanup never fires, so the listener would leak.
onScopeDispose(() => window.removeEventListener("keydown", onMenuKeydown));
</script>

<template>
  <DropdownMenuRoot v-if="state.preset.available.value" v-model:open="open" :modal="false">
    <DropdownMenuTrigger as-child>
      <button type="button" class="as-preset-picker-trigger">
        <span class="as-preset-picker-trigger-label">{{ activePresetLabel }}</span>
        <span v-if="state.preset.isDirty.value" class="as-preset-picker-trigger-dirty">*</span>
        <span class="as-preset-picker-trigger-chevron i-as-chevron-down" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        v-if="!saveAsOpen"
        class="as-preset-picker-menu"
        :side-offset="4"
        align="start"
      >
        <template v-for="(section, sIdx) in sections" :key="section.kind">
          <DropdownMenuSeparator
            v-if="sIdx > 0 && section.items.length > 0"
            class="as-preset-picker-separator"
          />
          <div v-if="section.items.length > 0" class="as-preset-picker-section">
            <div v-if="section.showHeader" class="as-preset-picker-section-header">
              {{ section.label }}
            </div>
            <DropdownMenuItem
              v-for="item in section.items"
              :key="`${section.kind}-${item.id}`"
              class="as-preset-picker-item"
              :data-active="item.id === state.preset.activeId.value ? '' : undefined"
              @select="applyId(item.id)"
            >
              <span class="as-preset-picker-item-active i-as-check" aria-hidden="true" />
              <span class="as-preset-picker-item-label">{{ item.label }}</span>
              <span v-if="item.meta" class="as-preset-picker-item-meta">{{ item.meta }}</span>
              <span class="as-preset-picker-item-aspects">
                <span
                  v-for="a in state.preset.availableAspects"
                  :key="a"
                  class="as-preset-picker-item-aspect-chip"
                  :data-on="item.aspects.includes(a) ? '' : undefined"
                  :title="ASPECT_LABELS[a]"
                >
                  <span :class="ASPECT_ICONS[a]" aria-hidden="true" />
                </span>
              </span>
            </DropdownMenuItem>
          </div>
        </template>

        <!-- Action row -->
        <DropdownMenuSeparator class="as-preset-picker-separator" />
        <DropdownMenuItem
          v-if="state.preset.isDirty.value && state.preset.canSaveActive.value"
          class="as-preset-picker-action as-preset-picker-action-primary"
          @select="saveActive"
        >
          <span class="as-preset-picker-action-icon i-as-check" aria-hidden="true" />
          <span class="as-preset-picker-action-label">Save</span>
          <kbd class="as-kbd">S</kbd>
        </DropdownMenuItem>
        <DropdownMenuItem
          class="as-preset-picker-action"
          @select="
            (ev: Event) => {
              ev.preventDefault();
              openSaveAs();
            }
          "
        >
          <span class="as-preset-picker-action-icon i-as-plus" aria-hidden="true" />
          <span class="as-preset-picker-action-label">Save as…</span>
          <kbd class="as-kbd">A</kbd>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="state.preset.isDirty.value"
          class="as-preset-picker-action"
          @select="resetActive"
        >
          <span class="as-preset-picker-action-icon i-as-refresh" aria-hidden="true" />
          <span class="as-preset-picker-action-label">Reset changes</span>
          <kbd class="as-kbd">R</kbd>
        </DropdownMenuItem>
        <DropdownMenuSeparator class="as-preset-picker-separator" />
        <DropdownMenuItem class="as-preset-picker-action" @select="openManageDialog">
          <span class="as-preset-picker-action-icon i-as-settings" aria-hidden="true" />
          <span class="as-preset-picker-action-label">Manage presets…</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <!-- Inline Save-as popover (replaces menu content while open) -->
      <DropdownMenuContent
        v-else
        class="as-preset-picker-popover"
        :side-offset="4"
        align="start"
        @escape-key-down="cancelSaveAs"
        @pointer-down-outside="cancelSaveAs"
      >
        <h3 class="as-preset-picker-popover-title">Save as new preset</h3>
        <div class="as-preset-picker-popover-field">
          <label class="as-preset-picker-popover-label" for="as-preset-picker-label">Name</label>
          <input
            id="as-preset-picker-label"
            ref="saveAsInputRef"
            v-model="saveAsLabel"
            class="as-preset-picker-popover-input"
            type="text"
            @keydown.enter.prevent="commitSaveAs"
          />
        </div>
        <div class="as-preset-picker-popover-aspects">
          <span class="as-preset-picker-popover-label">Save:</span>
          <label v-for="a in aspects" :key="a" class="as-preset-picker-popover-aspect">
            <input
              type="checkbox"
              :checked="saveAsAspectsMask[a] === true"
              @change="(ev: Event) => toggleAspect(a, ev)"
            />
            <span
              :class="[ASPECT_ICONS[a], 'as-preset-picker-popover-aspect-icon']"
              aria-hidden="true"
            />
            {{ ASPECT_LABELS[a] }}
          </label>
        </div>
        <template v-if="state.preset.capabilities.value === null || state.preset.capabilities.value.canPublish">
          <div class="as-preset-picker-popover-separator" />
          <label class="as-preset-picker-popover-public">
            <input v-model="saveAsPublic" type="checkbox" />
            <span class="i-as-eye-off as-preset-picker-popover-aspect-icon" aria-hidden="true" />
            Make public
          </label>
        </template>
        <div class="as-preset-picker-popover-footer">
          <button type="button" class="as-preset-picker-popover-cancel" @click="cancelSaveAs">
            Cancel
          </button>
          <button
            type="button"
            class="as-preset-picker-popover-save"
            :disabled="!saveAsLabel.trim()"
            @click="commitSaveAs"
          >
            Save
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
