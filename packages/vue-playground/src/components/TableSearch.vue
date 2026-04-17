<script setup lang="ts">
import { useTableSearch } from "@atscript/vue-table";

const { searchTerm, onSearchInput } = useTableSearch();
</script>

<template>
  <input type="search" placeholder="Search..." :value="searchTerm" @input="onSearchInput" />
</template>
