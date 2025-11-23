import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.DOCKER ? 'http://backend:3001' : 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

