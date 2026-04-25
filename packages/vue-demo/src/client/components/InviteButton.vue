<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useMe } from "../api/use-me";

const { me } = useMe();
const router = useRouter();
const canInvite = computed(() => !!me.value?.permissions?.users?.write);
</script>

<template>
  <button
    v-if="canInvite"
    type="button"
    class="c8-filled scope-primary inline-flex items-center gap-$s h-fingertip-m px-$m rounded-base font-600 cursor-pointer"
    @click="() => router.push('/users/invite')"
  >
    <span class="i-ph:user-plus" aria-hidden="true" />
    <span>Invite user</span>
  </button>
</template>
