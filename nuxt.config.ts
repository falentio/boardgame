import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/app.css'],

  runtimeConfig: {
    public: {
      pusher: {
        key: process.env.PUSHER_APP_KEY ?? 'boardgame-byc3vc',
        host: process.env.PUSHER_HOST ?? 'wss.vask.dev',
      },
    },
  },

  nitro: {
    preset: 'cloudflare_module',
    // `server/modules/**` is Nitro's reserved local-module directory; this app
    // keeps its own modules there, so stop Nitro from importing them as modules.
    ignore: ['modules/**'],
  },

  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  modules: ['shadcn-nuxt'],
  shadcn: {
    /**
     * Prefix for all the imported component.
     * @default "Ui"
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * Will respect the Nuxt aliases.
     * @link https://nuxt.com/docs/api/nuxt-config#alias
     * @default "@/components/ui"
     */
    componentDir: '@/components/ui'
  }
})
