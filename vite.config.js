import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
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
