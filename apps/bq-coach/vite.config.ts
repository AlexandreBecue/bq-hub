import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['beep.mp3'],
      manifest: {
        name: 'BQ Coach',
        short_name: 'BQ Coach',
        description: 'Application pour suivre mes séances et running',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon.png',
            sizes: '192x192',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
