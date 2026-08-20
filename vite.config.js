import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'SportPulse AI | Next-Gen Sports Predictor',
        short_name: 'SportPulse',
        description: 'State-of-the-art Sports Prediction & Analytics Dashboard with Dixon-Coles Poisson models, Elo rating engine, and 10,000 Monte Carlo match simulations.',
        theme_color: '#0b0f19',
        background_color: '#0b0f19',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 35 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']
      }
    })
  ],
  base: './',
  server: {
    host: true,
    proxy: {
      '/football-data-proxy': {
        target: 'https://www.football-data.co.uk',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/football-data-proxy/, '')
      }
    }
  }
})
