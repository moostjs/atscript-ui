<script setup lang="ts">
import { AsPresetPicker, AsTable, AsTableRoot } from "@atscript/vue-table";
import { useMe } from "../api/use-me";
import { createDemoTableComponents, createDemoTableTypes } from "../types/demo-table-types";

// Two tables on one preset scope (same presets URL, app and `tableKey`): a
// preset saved, renamed or deleted in one shows up in the other's picker
// without a reload — both read one shared session cache entry.
const types = createDemoTableTypes();
const components = createDemoTableComponents();
const preset = { url: "/api/db/_presets", tableKey: "preset-twins" };
const sides = ["left", "right"] as const;
// Like `TablePage`: tables mount once the signed-in user is known (client only).
const { loaded } = useMe();
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="p-$l flex flex-col gap-$l">
      <div>
        <div class="as-page-eyebrow">atscript-ui demo</div>
        <h1 class="as-page-title">Preset twins</h1>
      </div>
      <section
        v-for="side in loaded ? sides : []"
        :key="side"
        :data-testid="`twin-${side}`"
        class="flex flex-col gap-$s h-[24em] min-h-0"
      >
        <AsTableRoot
          url="/api/db/tables/orders"
          :types="types"
          :components="components"
          :limit="5"
          :preset="preset"
          class="flex-1 flex flex-col min-h-0"
        >
          <AsPresetPicker />
          <AsTable class="flex-1 min-h-0" />
        </AsTableRoot>
      </section>
    </div>
  </div>
</template>
