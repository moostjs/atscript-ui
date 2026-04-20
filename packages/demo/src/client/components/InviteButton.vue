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
    class="as-invite-btn"
    @click="() => router.push('/users/invite')"
  >
    Invite user
  </button>
</template>
