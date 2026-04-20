<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { sharedFetch } from "../api/fetch";
import { useMe } from "../api/use-me";

const username = ref("admin");
const err = ref<string | null>(null);
const router = useRouter();
const { refresh } = useMe();

async function onSubmit() {
  err.value = null;
  const res = await sharedFetch("/api/auth/dev-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: username.value }),
  });
  if (!res.ok) {
    err.value = `Login failed: ${res.status}`;
    return;
  }
  await refresh();
  void router.push("/");
}
</script>

<template>
  <div class="min-h-screen grid place-items-center">
    <form
      class="flex flex-col gap-3 p-6 min-w-[320px] border-1 rounded"
      @submit.prevent="onSubmit"
    >
      <h1 class="text-lg font-semibold">AtShop — dev login</h1>
      <label class="flex flex-col gap-1 text-sm">
        Username
        <select v-model="username" class="border-1 rounded px-2 py-1">
          <option value="admin">admin</option>
          <option value="manager">manager</option>
          <option value="viewer">viewer</option>
        </select>
      </label>
      <button type="submit" class="bg-black text-white rounded px-3 py-2">Sign in</button>
      <p v-if="err" class="text-red-600 text-sm">{{ err }}</p>
    </form>
  </div>
</template>
