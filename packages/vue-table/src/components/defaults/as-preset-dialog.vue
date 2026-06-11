<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { computed, nextTick, ref, watch } from "vue";
import { type PresetAspect, isSystemPresetId, setsEqual } from "@atscript/ui-table";
import { useTableContext } from "../../composables/use-table-state";
import {
  ASPECT_ICONS,
  ASPECT_LABELS,
  aspectsOf,
  ownerNameOf,
  readPresetLabel,
} from "../../composables/preset-aspect-display";
import { useSeedOnOpen } from "../../composables/use-seed-on-open";

/**
 * Tier-2 default — preset management dialog. Pending-changes model: pin /
 * star / public toggles batch in memory and apply in one round-trip on
 * Save. Rename / delete commit immediately (rename is intentional text
 * editing; delete is already gated by `state.prompt()`).
 */
const { state } = useTableContext();

const isOpen = computed({
  get: () => state.preset.dialogOpen.value,
  set: (val: boolean) => {
    state.preset.dialogOpen.value = val;
  },
});

const ownedCount = computed(() => {
  const me = state.preset.currentUser.value;
  if (me === null) return 0;
  let n = 0;
  for (const row of state.preset.presets.value) {
    if (row.user === me) n++;
  }
  return n;
});

const presetLimit = computed(() => state.preset.capabilities.value?.presetLimit ?? null);

const counterText = computed(() =>
  presetLimit.value !== null ? `${ownedCount.value} / ${presetLimit.value}` : `${ownedCount.value}`,
);

const serverFavIds = computed<Set<string>>(() => {
  const arr = (state.preset.userConf.value?.data as { favPresetIds?: string[] } | undefined)
    ?.favPresetIds;
  return new Set(arr ?? []);
});

const serverDefaultId = computed<string | null>(
  () =>
    (state.preset.userConf.value?.data as { defaultPresetId?: string } | undefined)
      ?.defaultPresetId ?? null,
);

const serverPublicIds = computed<Set<string>>(() => {
  const out = new Set<string>();
  for (const row of state.preset.presets.value) {
    if (row.public === true) out.add(row.id);
  }
  return out;
});

// Edits batch here; Cancel = undo, Save = commit.
const pendingFavIds = ref<Set<string>>(new Set());
const pendingDefaultId = ref<string | null>(null);
const pendingPublicIds = ref<Set<string>>(new Set());
const pendingLabels = ref<Map<string, string>>(new Map());
const pendingActiveId = ref<string | null>(null);
const pendingDeleteIds = ref<Set<string>>(new Set());

function syncPendingFromServer() {
  pendingFavIds.value = new Set(serverFavIds.value);
  pendingDefaultId.value = serverDefaultId.value;
  pendingPublicIds.value = new Set(serverPublicIds.value);
  pendingLabels.value = new Map();
  pendingActiveId.value = state.preset.activeId.value;
  pendingDeleteIds.value = new Set();
}

// On open: snapshot server state into the pending model.
useSeedOnOpen(isOpen, () => {
  syncPendingFromServer();
  searchQuery.value = "";
  cancelRename();
  // Wait one tick so Reka's DialogContent focus-trap settles before
  // we steal focus to the search input.
  void nextTick(() => searchInputRef.value?.focus());
});

// Re-sync if server data refreshes while the dialog is open and the user
// hasn't started editing — covers the post-save reload.
watch([serverFavIds, serverDefaultId, serverPublicIds, state.preset.activeId], () => {
  if (!isOpen.value) return;
  if (!isDirty.value) syncPendingFromServer();
});

const isDirty = computed(() => {
  if (!setsEqual(pendingFavIds.value, serverFavIds.value)) return true;
  if (pendingDefaultId.value !== serverDefaultId.value) return true;
  if (!setsEqual(pendingPublicIds.value, serverPublicIds.value)) return true;
  if (pendingLabels.value.size > 0) return true;
  if (pendingActiveId.value !== state.preset.activeId.value) return true;
  if (pendingDeleteIds.value.size > 0) return true;
  return false;
});

type RowKind = "system" | "owned" | "public";

interface DialogRow {
  id: string;
  label: string;
  kind: RowKind;
  isPublic: boolean;
  ownerLabel: string; // "—" for system, "you" for owned, username for others
  aspects: PresetAspect[];
  // True when `pendingLabels[id]` differs from the DB label — drives the
  // `[data-pending]` "modified" visual on the row label.
  pendingLabel: boolean;
}

interface DialogSection {
  kind: RowKind;
  label: string;
  rows: DialogRow[];
}

const allRows = computed<DialogRow[]>(() => {
  const out: DialogRow[] = [];
  // System rows go first — synthetic, never sorted with user rows.
  for (const sp of state.preset.systemPresets.value) {
    out.push({
      id: sp.id,
      label: sp.label,
      kind: "system",
      isPublic: false,
      ownerLabel: "—",
      aspects: [...state.preset.availableAspects],
      pendingLabel: false,
    });
  }
  const stored: DialogRow[] = [];
  for (const row of state.preset.presets.value) {
    const isOwned = state.preset.isOwned(row.id);
    // Pending label takes precedence so edits show through until Save (or
    // Cancel) commits.
    const original = readPresetLabel(row);
    const pending = pendingLabels.value.get(row.id);
    const liveLabel = pending ?? original;
    stored.push({
      id: row.id,
      label: liveLabel,
      kind: isOwned ? "owned" : "public",
      isPublic: pendingPublicIds.value.has(row.id),
      ownerLabel: isOwned ? "you" : ownerNameOf(row, "—"),
      aspects: aspectsOf(row, state.preset.availableAspects),
      pendingLabel: pending !== undefined && pending !== original,
    });
  }
  // Owned rows aren't pinned above public — single sort order maintains
  // the "all presets are equal" framing.
  stored.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  return [...out, ...stored];
});

const searchQuery = ref("");
const searchInputRef = ref<HTMLInputElement | null>(null);

// Sections drop entirely when empty so the dialog only renders headers
// for sections that have rows. Order: System → My presets → Shared.
const sections = computed<DialogSection[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const matches = (r: DialogRow) =>
    !q || r.label.toLowerCase().includes(q) || r.ownerLabel.toLowerCase().includes(q);
  const sys: DialogRow[] = [];
  const own: DialogRow[] = [];
  const shared: DialogRow[] = [];
  for (const r of allRows.value) {
    if (!matches(r)) continue;
    if (r.kind === "system") sys.push(r);
    else if (r.kind === "owned") own.push(r);
    else shared.push(r);
  }
  const out: DialogSection[] = [];
  if (sys.length > 0) out.push({ kind: "system", label: "System", rows: sys });
  if (own.length > 0) out.push({ kind: "owned", label: "My presets", rows: own });
  if (shared.length > 0) out.push({ kind: "public", label: "Shared by others", rows: shared });
  return out;
});

const totalFiltered = computed(() => sections.value.reduce((sum, s) => sum + s.rows.length, 0));

function toggleFavPending(id: string) {
  const next = new Set(pendingFavIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  pendingFavIds.value = next;
}

function setDefaultPending(id: string | null) {
  pendingDefaultId.value = pendingDefaultId.value === id ? null : id;
}

function togglePublicPending(id: string) {
  const next = new Set(pendingPublicIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  pendingPublicIds.value = next;
}

function setActivePending(id: string) {
  pendingActiveId.value = id;
}

function toggleDeletePending(id: string) {
  const next = new Set(pendingDeleteIds.value);
  const willDelete = !next.has(id);
  if (willDelete) {
    next.add(id);
    // Marking-for-delete clears any active rename — the row is about to
    // be struck-through, so a live input on it confuses the eye.
    if (editingId.value === id) cancelRename();
  } else {
    next.delete(id);
  }
  pendingDeleteIds.value = next;
}

// Inline rename — pending state updates per keystroke so Save activates
// without blur. Plain handle on the active input avoids the v-for
// template-ref-coerces-to-array issue.
const editingId = ref<string | null>(null);
const editingValue = ref("");
let renameInputRef: HTMLInputElement | null = null;

function startRename(row: DialogRow) {
  if (row.kind !== "owned") return;
  editingId.value = row.id;
  editingValue.value = row.label;
}

// Reka's DialogContent races our nextTick by focusing the dialog itself
// on mousedown via its focus-scope. Two RAF ticks (Vue mount + Reka
// settle) lets our focus+select stick on the first click.
watch(
  editingId,
  (id) => {
    if (!id) {
      renameInputRef = null;
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        renameInputRef?.focus();
        renameInputRef?.select();
      });
    });
  },
  { flush: "post" },
);

function cancelRename() {
  editingId.value = null;
  editingValue.value = "";
}

/**
 * Live writeback to `pendingLabels`. Called on every keystroke via
 * `@input` so Save lights up the moment the value diverges from the
 * server label. Empty string is treated as "revert" (drop the pending
 * entry) so accidentally clearing the input doesn't queue a blank-name
 * rename.
 */
function onRenameInput() {
  if (!editingId.value) return;
  const id = editingId.value;
  const next = editingValue.value.trim();
  const row = state.preset.presetsById.value.get(id);
  const original = row ? readPresetLabel(row) : "";
  const map = new Map(pendingLabels.value);
  if (!next || next === original) map.delete(id);
  else map.set(id, next);
  pendingLabels.value = map;
}

function commitRename() {
  // onRenameInput keeps pendingLabels in sync per keystroke; closing the
  // editor is enough — Save is what hits the server.
  cancelRename();
}

const saving = ref(false);

async function save() {
  if (!isDirty.value || saving.value) return;
  saving.value = true;
  try {
    // batch() defers the per-mutator reload so N renames + M public flips +
    // K deletes + fav/default writes collapse into ONE round-trip.
    await state.preset.batch(async () => {
      const deleted = pendingDeleteIds.value;
      if (!setsEqual(pendingFavIds.value, serverFavIds.value)) {
        // Own + system favs aren't user-toggleable in the dialog; strip
        // them on submit to avoid stale cruft on the userConf row.
        const cleaned: string[] = [];
        for (const id of pendingFavIds.value) {
          if (isSystemPresetId(id)) continue;
          if (deleted.has(id)) continue;
          if (!state.preset.presetsById.value.has(id)) continue;
          if (state.preset.isOwned(id)) continue;
          cleaned.push(id);
        }
        await state.preset.setFavorites(cleaned);
      }
      if (pendingDefaultId.value !== serverDefaultId.value) {
        const next =
          pendingDefaultId.value && deleted.has(pendingDefaultId.value)
            ? null
            : pendingDefaultId.value;
        if (next !== serverDefaultId.value) {
          await state.preset.setDefault(next);
        }
      }
      if (pendingLabels.value.size > 0) {
        for (const [id, label] of pendingLabels.value) {
          if (deleted.has(id)) continue;
          try {
            await state.preset.rename(id, label);
          } catch (_err) {
            // 409 / forbidden — keep the batch going.
          }
        }
      }
      if (!setsEqual(pendingPublicIds.value, serverPublicIds.value)) {
        const flips: string[] = [];
        for (const id of pendingPublicIds.value) {
          if (deleted.has(id)) continue;
          if (!serverPublicIds.value.has(id)) flips.push(id);
        }
        for (const id of serverPublicIds.value) {
          if (deleted.has(id)) continue;
          if (!pendingPublicIds.value.has(id)) flips.push(id);
        }
        for (const id of flips) {
          try {
            await state.preset.togglePublic(id);
          } catch (_err) {
            // 409 / forbidden — keep the batch going.
          }
        }
      }
      if (deleted.size > 0) {
        for (const id of deleted) {
          try {
            await state.preset.remove(id);
          } catch (_err) {
            // 403 / 404 — keep the batch going.
          }
        }
      }
    });
    // Apply the picked preset last so its post-rename label / post-flip
    // public state takes effect. Skip when it's queued for delete.
    if (
      pendingActiveId.value !== null &&
      pendingActiveId.value !== state.preset.activeId.value &&
      !pendingDeleteIds.value.has(pendingActiveId.value)
    ) {
      state.preset.apply(pendingActiveId.value);
    }
    state.preset.dialogOpen.value = false;
  } finally {
    saving.value = false;
  }
}

// Cancel / X / Esc / outside-click all funnel through here. No
// confirmation prompt — Cancel IS the discard.
function discardOrClose() {
  syncPendingFromServer();
  state.preset.dialogOpen.value = false;
}

function rowFavTitle(row: DialogRow): string {
  if (row.kind !== "public") return "";
  return pendingFavIds.value.has(row.id)
    ? "Favorited — click to remove"
    : "Click to add to favorites";
}

function rowDefaultTitle(row: DialogRow): string {
  return row.id === pendingDefaultId.value ? "Default — click to unpin" : "Click to pin as default";
}

function rowPublicTitle(row: DialogRow): string {
  if (row.kind === "system") return "";
  if (row.kind === "owned") {
    return row.isPublic ? "Public — click to make private" : "Private — click to make public";
  }
  return "Public preset shared with everyone";
}

function canToggleRowPublic(row: DialogRow): boolean {
  if (row.kind !== "owned") return false;
  const caps = state.preset.capabilities.value;
  if (caps === null) return true;
  return caps.canPublish || row.isPublic;
}
</script>

<template>
  <DialogRoot v-model:open="isOpen">
    <DialogPortal>
      <DialogOverlay class="as-preset-dialog-overlay" />
      <DialogContent
        class="as-preset-dialog-content"
        @escape-key-down="
          (ev: Event) => {
            ev.preventDefault();
            discardOrClose();
          }
        "
        @pointer-down-outside="
          (ev: Event) => {
            ev.preventDefault();
            discardOrClose();
          }
        "
      >
        <header class="as-preset-dialog-header">
          <DialogTitle class="as-preset-dialog-title">Presets</DialogTitle>
          <span class="as-preset-dialog-counter">{{ counterText }}</span>
          <DialogClose
            class="as-preset-dialog-close"
            aria-label="Close"
            @click.prevent="discardOrClose"
          >
            <span class="i-as-close" aria-hidden="true" />
          </DialogClose>
        </header>

        <div class="as-preset-dialog-toolbar">
          <div class="as-preset-dialog-search">
            <span class="i-as-search as-preset-dialog-search-icon" aria-hidden="true" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="search"
              class="as-preset-dialog-search-input"
              placeholder="Search by name or owner…"
            />
          </div>
          <div class="as-preset-dialog-legend">
            <span class="as-preset-dialog-legend-item">
              <span class="i-as-pin as-preset-dialog-legend-icon" aria-hidden="true" />
              <span>default</span>
            </span>
            <span class="as-preset-dialog-legend-item">
              <span class="i-as-star as-preset-dialog-legend-icon" aria-hidden="true" />
              <span>favorite</span>
            </span>
            <span class="as-preset-dialog-legend-item">
              <span class="i-as-eye-off as-preset-dialog-legend-icon" aria-hidden="true" />
              <span>public</span>
            </span>
            <span class="as-preset-dialog-legend-item">
              <span class="i-as-trash as-preset-dialog-legend-icon" aria-hidden="true" />
              <span>delete</span>
            </span>
          </div>
        </div>

        <div class="as-preset-dialog-body">
          <p v-if="totalFiltered === 0" class="as-preset-dialog-empty">
            No presets match "{{ searchQuery }}".
          </p>
          <template v-for="section in sections" v-else :key="section.kind">
            <div class="as-preset-dialog-section-header">{{ section.label }}</div>
            <div
              v-for="row in section.rows"
              :key="row.id"
              class="as-preset-dialog-row"
              :data-deleted="pendingDeleteIds.has(row.id) ? '' : undefined"
            >
              <!-- First column: pick which preset becomes active on Save.
                 Radio (single-select — exactly one preset is applied at
                 a time). Clicking it sets `pendingActiveId`; the actual
                 `applyPreset` runs in the Save batch. -->
              <input
                type="radio"
                name="as-preset-dialog-active"
                class="as-preset-dialog-row-active"
                :value="row.id"
                :checked="row.id === pendingActiveId"
                @change="setActivePending(row.id)"
                :title="
                  row.id === pendingActiveId
                    ? 'This preset will be applied'
                    : 'Click to apply this preset on Save'
                "
              />
              <button
                type="button"
                class="as-preset-dialog-row-default"
                :data-on="row.id === pendingDefaultId ? '' : undefined"
                :aria-pressed="row.id === pendingDefaultId"
                :title="rowDefaultTitle(row)"
                @click="setDefaultPending(row.id)"
              >
                <span
                  :class="row.id === pendingDefaultId ? 'i-as-pin-filled' : 'i-as-pin'"
                  aria-hidden="true"
                />
              </button>
              <!-- Star: only meaningful for non-owned, non-system rows. Own
                 + system rows already render in the picker so the star
                 would be a no-op. Keep a sized spacer so the column-grid
                 stays aligned. -->
              <button
                v-if="row.kind === 'public'"
                type="button"
                class="as-preset-dialog-row-fav"
                :data-on="pendingFavIds.has(row.id) ? '' : undefined"
                :aria-pressed="pendingFavIds.has(row.id)"
                :title="rowFavTitle(row)"
                @click="toggleFavPending(row.id)"
              >
                <span
                  :class="pendingFavIds.has(row.id) ? 'i-as-star-filled' : 'i-as-star'"
                  aria-hidden="true"
                />
              </button>
              <span v-else class="as-preset-dialog-row-fav-spacer" aria-hidden="true" />
              <div class="as-preset-dialog-row-label">
                <input
                  v-if="editingId === row.id"
                  :ref="
                    (el: any) => {
                      if (el) renameInputRef = el as HTMLInputElement;
                    }
                  "
                  v-model="editingValue"
                  class="as-preset-dialog-row-rename"
                  type="text"
                  @input="onRenameInput"
                  @keydown.enter.prevent="commitRename"
                  @keydown.escape.prevent="cancelRename"
                  @blur="commitRename"
                />
                <span
                  v-else-if="row.kind === 'owned' && !pendingDeleteIds.has(row.id)"
                  class="as-preset-dialog-row-label-text cursor-pointer"
                  :data-pending="row.pendingLabel ? '' : undefined"
                  :title="row.pendingLabel ? 'Modified — click to keep editing' : 'Click to rename'"
                  @mousedown.prevent.stop="startRename(row)"
                >
                  {{ row.label }}
                </span>
                <span
                  v-else
                  class="as-preset-dialog-row-label-text"
                  :data-pending="row.pendingLabel ? '' : undefined"
                  >{{ row.label }}</span
                >
              </div>
              <span class="as-preset-dialog-row-owner">
                <span v-if="row.kind === 'owned'" class="as-preset-dialog-row-owner-self">you</span>
                <template v-else>{{ row.ownerLabel }}</template>
              </span>
              <div class="as-preset-dialog-aspect-strip">
                <span
                  v-for="a in state.preset.availableAspects"
                  :key="a"
                  class="as-preset-dialog-aspect-chip"
                  :data-on="row.aspects.includes(a) ? '' : undefined"
                  :title="ASPECT_LABELS[a]"
                >
                  <span :class="ASPECT_ICONS[a]" aria-hidden="true" />
                </span>
              </div>
              <button
                v-if="canToggleRowPublic(row)"
                type="button"
                class="as-preset-dialog-row-public-toggle"
                :data-on="row.isPublic ? '' : undefined"
                :aria-pressed="row.isPublic"
                :title="rowPublicTitle(row)"
                @click="togglePublicPending(row.id)"
              >
                <span :class="row.isPublic ? 'i-as-eye' : 'i-as-eye-off'" aria-hidden="true" />
              </button>
              <span
                v-else-if="row.kind === 'public'"
                class="as-preset-dialog-row-public-indicator"
                :title="rowPublicTitle(row)"
              >
                <span class="i-as-eye" aria-hidden="true" />
              </span>
              <span v-else class="as-preset-dialog-row-public-spacer" aria-hidden="true" />
              <button
                v-if="row.kind === 'owned'"
                type="button"
                class="as-preset-dialog-row-delete"
                :data-on="pendingDeleteIds.has(row.id) ? '' : undefined"
                :aria-pressed="pendingDeleteIds.has(row.id)"
                :title="
                  pendingDeleteIds.has(row.id)
                    ? 'Marked for deletion — click to undo'
                    : 'Mark for deletion (applied on Save)'
                "
                @click="toggleDeletePending(row.id)"
              >
                <span class="i-as-trash" aria-hidden="true" />
              </button>
              <span v-else class="as-preset-dialog-row-delete-spacer" aria-hidden="true" />
            </div>
          </template>
        </div>

        <footer class="as-preset-dialog-footer">
          <div class="as-preset-dialog-footer-status">
            <span v-if="isDirty" class="as-preset-dialog-footer-unsaved">
              <span class="as-preset-dialog-footer-unsaved-dot" aria-hidden="true" />
              unsaved changes
            </span>
          </div>
          <div class="as-preset-dialog-footer-actions">
            <button type="button" class="as-preset-dialog-footer-close" @click="discardOrClose">
              Cancel
            </button>
            <button
              type="button"
              class="as-preset-dialog-footer-save"
              :disabled="!isDirty || saving"
              @click="save"
            >
              {{ saving ? "Saving…" : "Save" }}
            </button>
          </div>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
