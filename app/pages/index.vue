<script setup lang="ts">
const { user, signOut } = await useAuthSession()
</script>

<template>
  <main class="flex min-h-svh flex-col items-start justify-center gap-4 p-8">
    <h1 class="text-2xl font-medium">Hello, {{ user?.name }}</h1>
    <Button variant="outline" @click="signOut">Sign out</Button>
  </main>
</template>
