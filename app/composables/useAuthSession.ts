import { computed } from "vue"
import { authClient } from "../lib/auth-client"

export interface AuthUser {
  id: string
  name: string
  email: string
  image: string | null
}

export async function useAuthSession() {
  const { data: hydrated } = await authClient.useSession(useFetch)
  const client = authClient.useSession()

  const session = computed(() =>
    client.value.isPending ? hydrated.value : client.value.data,
  )

  const user = computed<AuthUser | null>(() => {
    const current = session.value?.user
    if (!current) return null
    return {
      id: current.id,
      name: current.name,
      email: current.email,
      image: current.image ?? null,
    }
  })

  const signedIn = computed(() => user.value !== null)

  const pending = computed(() => client.value.isPending && user.value === null)

  const signOut = async () => {
    await authClient.signOut()
    await navigateTo("/login")
  }

  return { user, signedIn, pending, signOut }
}
