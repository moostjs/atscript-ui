<script setup lang="ts">
// Row and workflow events: what each handler receives as typed in the
// published declarations.
import { AsTableRoot, type TVueTableActionInfo } from "@atscript/vue-table";
import { AsWfForm, type WfFormError } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";

const types = createDefaultTypes();

function openRow(row: Record<string, unknown>, absIndex: number): void {
  void [row.id, absIndex];
}
function onTableAction(action: TVueTableActionInfo, ids: unknown[]): void {
  void [action, ids.length];
}
function onWfSubmit(data: unknown): void {
  void data;
}
function onWfError(error: WfFormError): void {
  void [error.message, error.status, error.code, error.body];
}
</script>

<template>
  <AsTableRoot
    url="/api/db/tables/products"
    @main-action="(row, absIndex) => openRow(row, absIndex)"
    @action="onTableAction"
  />
  <AsWfForm path="/api/wf" name="checkout" :types="types" @submit="onWfSubmit" @error="onWfError">
    <template #default="{ form, actions }">
      <button type="button" @click="actions.submit(form.formData?.value)">Send</button>
    </template>
  </AsWfForm>
</template>
