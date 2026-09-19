<script setup lang="ts">
// Class extractor safelist — scope variants are applied dynamically as
// `as-confirm-dialog-confirm-${scope}`. List the literals here so the
// build-time extractor includes their rules:
//   as-confirm-dialog-confirm-good
//   as-confirm-dialog-confirm-warn
//   as-confirm-dialog-confirm-error
//   as-confirm-dialog-confirm-primary
//   as-confirm-dialog-confirm-secondary
//   as-confirm-dialog-confirm-neutral
import { computed } from "vue";
import {
  AlertDialogRoot,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from "reka-ui";
import { useTableContext } from "../../composables/use-table-state";

const { state } = useTableContext();

// Controlled open: `confirmRequest !== null` ↔ dialog open. Setter handles
// only the dismiss path (Esc / overlay click). Confirm/Cancel buttons call
// accept/dismiss directly so the user's @click resolves the promise BEFORE
// Reka-ui's own auto-close kicks the dialog shut. Using `AlertDialogAction`
// / `AlertDialogCancel` here was racy: their built-in `onOpenChange(false)`
// could fire ahead of our handler, causing the computed setter to run
// `dismissPrompt` first → promise resolved `false`, action never fired.
const isOpen = computed({
  get: () => state.confirmRequest.value !== null,
  set: (val: boolean) => {
    if (!val) state.dismissPrompt();
  },
});

// `req` is the RETAINED request (`state.confirmDisplay`), not the live one:
// `state.confirmRequest` is nulled the instant the user answers, but Reka
// keeps the content mounted until its exit animation ends. The slot clears
// the retained copy on `releaseConfirm`, bound to the content's `after-leave`.
const req = state.confirmDisplay;
</script>

<template>
  <AlertDialogRoot v-model:open="isOpen">
    <AlertDialogPortal>
      <AlertDialogOverlay class="as-confirm-dialog-overlay" />
      <AlertDialogContent class="as-confirm-dialog-content" @after-leave="state.releaseConfirm()">
        <div class="as-confirm-dialog-body-wrap">
          <AlertDialogTitle class="as-confirm-dialog-title">Confirmation</AlertDialogTitle>
          <AlertDialogDescription class="as-confirm-dialog-body">{{
            req?.message
          }}</AlertDialogDescription>
        </div>
        <div class="as-confirm-dialog-footer">
          <button type="button" class="as-confirm-dialog-cancel" @click="state.dismissPrompt()">
            {{ req?.cancelButton ?? "Cancel" }}
          </button>
          <button
            type="button"
            class="as-confirm-dialog-confirm"
            :class="req?.scope ? `as-confirm-dialog-confirm-${req.scope}` : undefined"
            @click="state.acceptPrompt()"
          >
            {{ req?.confirmButton ?? "Confirm" }}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
