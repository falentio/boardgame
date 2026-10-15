/**
 * `typecheck:client` compiles `app/composables/**` without Nuxt's generated
 * component shim, so the game registry (which holds `.vue` component values)
 * needs the wildcard module here. Runtime resolution stays with Vite/Nuxt.
 */
declare module "*.vue" {
  import type { Component } from "vue"
  const component: Component
  export default component
}
