<script setup lang="ts">
import { authClient } from "@/lib/auth-client"

const route = useRoute()
const session = authClient.useSession()
const email = ref("")
const password = ref("")
const error = ref("")
const submitting = ref(false)

const ORIGIN = "http://localhost"

const safeRedirect = (value: unknown) => {
  if (typeof value !== "string" || value === "") return "/"
  let url: URL
  try {
    url = new URL(value, ORIGIN)
  } catch {
    return "/"
  }
  if (url.origin !== ORIGIN) return "/"
  const out = `${url.pathname}${url.search}${url.hash}`
  if (!/^\/(?![/\\])/.test(out)) return "/"
  return out
}

const onSubmit = async () => {
  error.value = ""
  submitting.value = true
  try {
    const { error: failure } = await authClient.signIn.email({
      email: email.value,
      password: password.value,
    })
    if (failure) {
      error.value = failure.message ?? "Sign in failed"
      return
    }
    await session.value.refetch()
    await navigateTo(safeRedirect(route.query.redirect))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="bg-muted flex min-h-svh items-center justify-center p-6">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your email and password to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <div class="flex flex-col gap-2">
            <Label for="email">Email</Label>
            <Input id="email" v-model="email" type="email" autocomplete="email" required />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="password">Password</Label>
            <Input id="password" v-model="password" type="password" autocomplete="current-password" required />
          </div>
          <p v-if="error" role="alert" class="text-destructive text-sm">
            {{ error }}
          </p>
          <Button type="submit" :disabled="submitting">
            {{ submitting ? "Signing in..." : "Sign in" }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
