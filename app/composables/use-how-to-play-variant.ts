import { computed, type ComputedRef } from "vue"
import {
  parseHowToPlayVariant,
  type HowToPlayVariantId,
} from "./how-to-play"

export interface UseHowToPlayVariant {
  variant: ComputedRef<HowToPlayVariantId>
  setVariant: (next: HowToPlayVariantId) => void
}

export const useHowToPlayVariant = (): UseHowToPlayVariant => {
  const route = useRoute()
  const router = useRouter()

  const variant = computed(() => parseHowToPlayVariant(route.query.variant))

  const setVariant = (next: HowToPlayVariantId) => {
    void router.replace({ query: { ...route.query, variant: next } })
  }

  return { variant, setVariant }
}
