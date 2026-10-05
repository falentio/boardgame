<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { sameOriginPath } from "@/composables/safe-redirect"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()

const route = useRoute()
const session = authClient.useSession()
const email = ref("")
const password = ref("")
const error = ref("")
const submitting = ref(false)

const origin = useRequestURL().origin

const safeRedirect = (value: unknown) => sameOriginPath(value, origin)

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
  <div :class="cn('flex flex-col gap-6', props.class)">
    <Card>
      <CardHeader class="text-center">
        <CardTitle class="text-xl">
          Welcome back
        </CardTitle>
        <CardDescription>
          Enter your email and password to sign in
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="onSubmit">
          <FieldGroup>
            <Field>
              <FieldLabel for="email">
                Email
              </FieldLabel>
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="m@example.com"
                autocomplete="email"
                required
              />
            </Field>
            <Field>
              <FieldLabel for="password">
                Password
              </FieldLabel>
              <Input
                id="password"
                v-model="password"
                type="password"
                autocomplete="current-password"
                required
              />
            </Field>
            <FieldError :errors="error ? [error] : []" />
            <Field>
              <Button type="submit" :disabled="submitting">
                {{ submitting ? "Signing in..." : "Sign in" }}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
    <FieldDescription class="px-6 text-center">
      By clicking continue, you agree to our <a href="#">Terms of Service</a>
      and <a href="#">Privacy Policy</a>.
    </FieldDescription>
    <FieldDescription class="px-6 text-center">
      New here? <NuxtLink to="/signup">Create an account</NuxtLink>
    </FieldDescription>
  </div>
</template>
