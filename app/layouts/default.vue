<script setup lang="ts">
import 'vue-sonner/style.css'
import { Toaster } from "@/components/ui/sonner"
</script>


<template>
  <div class="min-h-svh">
    <slot />
    <Toaster position="top-right" :duration="4000" />
  </div>
</template>
