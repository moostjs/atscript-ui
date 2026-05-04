<script setup lang="ts">
import { useAppPrefs, type AppConfData } from "@atscript/vue-table";
import { computed, ref } from "vue";
import { clientFactory } from "../api/client-factory";

/**
 * Demo route exercising `useAppPrefs` end-to-end. Each control writes a
 * field of `AppConfData` through `save({ [field]: value })`. The
 * composable hydrates synchronously from `localStorage` (no flash on
 * mount), pushes to the server, then mirrors the server's reply back
 * into `prefs` and the cache.
 */
const { prefs, loading, error, available, save, reload, reset } = useAppPrefs({
  url: "/api/db/_presets",
  clientFactory,
});

const pendingField = ref<keyof AppConfData | null>(null);
const lastSaveError = ref<string | null>(null);

async function update<K extends keyof AppConfData>(field: K, value: AppConfData[K]) {
  pendingField.value = field;
  lastSaveError.value = null;
  try {
    await save({ [field]: value });
  } catch (err) {
    lastSaveError.value = err instanceof Error ? err.message : String(err);
  } finally {
    pendingField.value = null;
  }
}

const customJsonText = computed({
  get: () => prefs.value.customJson ?? "",
  set: (v: string) => void update("customJson", v || undefined),
});

const APPEARANCE = ["system", "light", "dark"] as const;
const DENSITY = ["compact", "cozy", "comfortable"] as const;
const DATE_FORMAT = ["iso", "us", "eu"] as const;
const FIRST_DAY = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 6, label: "Saturday" },
] as const;

function isPending(field: keyof AppConfData) {
  return pendingField.value === field;
}
</script>

<template>
  <div class="p-6 max-w-[640px]">
    <h1 class="text-lg font-semibold mb-1">Preferences</h1>
    <p class="text-sm opacity-60 mb-6">
      Per-user app-wide settings persisted via the <code>useAppPrefs</code> API. Writes go to
      <code>/db/_presets</code> (<code>type=appConf</code>) and are mirrored to
      <code>localStorage</code> for instant paint on next visit.
    </p>

    <div v-if="!available" class="mb-4 p-3 rounded-base layer-2 text-sm">
      Sign in to read or write your preferences. (The API returned 401/403.)
    </div>
    <div v-if="loading" class="mb-4 text-xs opacity-60">Loading…</div>
    <div v-if="error" class="mb-4 p-3 rounded-base scope-error layer-2 text-sm text-current-hl">
      {{ (error as Error).message ?? String(error) }}
    </div>
    <div
      v-if="lastSaveError"
      class="mb-4 p-3 rounded-base scope-error layer-2 text-sm text-current-hl"
    >
      Save failed: {{ lastSaveError }}
    </div>

    <div class="flex flex-col gap-5">
      <label class="flex flex-col gap-1">
        <span class="font-500 text-sm">Appearance</span>
        <select
          class="i8-input h-fingertip-m px-$s rounded-base"
          :disabled="!available || isPending('appearance')"
          :value="prefs.appearance ?? 'system'"
          @change="
            update(
              'appearance',
              ($event.target as HTMLSelectElement).value as AppConfData['appearance'],
            )
          "
        >
          <option v-for="v in APPEARANCE" :key="v" :value="v">{{ v }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="font-500 text-sm">Language (BCP-47, max 5 chars)</span>
        <input
          type="text"
          maxlength="5"
          class="i8-input h-fingertip-m px-$s rounded-base"
          :disabled="!available || isPending('language')"
          :value="prefs.language ?? ''"
          placeholder="en, en-US, fr-FR"
          @change="update('language', ($event.target as HTMLInputElement).value || undefined)"
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="font-500 text-sm">Timezone (IANA, max 64 chars)</span>
        <input
          type="text"
          maxlength="64"
          class="i8-input h-fingertip-m px-$s rounded-base"
          :disabled="!available || isPending('timezone')"
          :value="prefs.timezone ?? ''"
          placeholder="America/New_York, Europe/Berlin"
          @change="update('timezone', ($event.target as HTMLInputElement).value || undefined)"
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="font-500 text-sm">Density</span>
        <select
          class="i8-input h-fingertip-m px-$s rounded-base"
          :disabled="!available || isPending('density')"
          :value="prefs.density ?? 'cozy'"
          @change="
            update('density', ($event.target as HTMLSelectElement).value as AppConfData['density'])
          "
        >
          <option v-for="v in DENSITY" :key="v" :value="v">{{ v }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="font-500 text-sm">Date format</span>
        <select
          class="i8-input h-fingertip-m px-$s rounded-base"
          :disabled="!available || isPending('dateFormat')"
          :value="prefs.dateFormat ?? 'iso'"
          @change="
            update(
              'dateFormat',
              ($event.target as HTMLSelectElement).value as AppConfData['dateFormat'],
            )
          "
        >
          <option v-for="v in DATE_FORMAT" :key="v" :value="v">{{ v }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="font-500 text-sm">First day of week</span>
        <select
          class="i8-input h-fingertip-m px-$s rounded-base"
          :disabled="!available || isPending('firstDayOfWeek')"
          :value="prefs.firstDayOfWeek ?? 1"
          @change="
            update(
              'firstDayOfWeek',
              Number(($event.target as HTMLSelectElement).value) as AppConfData['firstDayOfWeek'],
            )
          "
        >
          <option v-for="d in FIRST_DAY" :key="d.value" :value="d.value">{{ d.label }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="font-500 text-sm">Custom JSON (escape hatch, max 1024 chars)</span>
        <textarea
          v-model="customJsonText"
          rows="4"
          maxlength="1024"
          class="i8-input p-$s rounded-base font-mono text-xs"
          :disabled="!available || isPending('customJson')"
          placeholder='{"foo": "bar"}'
          @change="update('customJson', customJsonText || undefined)"
        ></textarea>
      </label>
    </div>

    <div class="mt-6 flex items-center gap-2">
      <button
        type="button"
        class="c8-flat scope-grey h-fingertip-m px-$m rounded-base font-500 cursor-pointer"
        :disabled="!available || loading"
        @click="reload()"
      >
        Reload from server
      </button>
      <button
        type="button"
        class="c8-flat scope-error h-fingertip-m px-$m rounded-base font-500 cursor-pointer"
        @click="reset()"
      >
        Clear cache + state
      </button>
    </div>

    <details class="mt-8">
      <summary class="text-xs opacity-60 cursor-pointer">Raw state</summary>
      <pre class="text-xs mt-2 p-3 rounded-base layer-2 overflow-auto">{{
        JSON.stringify(prefs, null, 2)
      }}</pre>
    </details>
  </div>
</template>
