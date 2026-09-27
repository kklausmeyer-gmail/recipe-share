import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The site is served from https://<user>.github.io/recipe-share/
export default defineConfig({
  base: '/recipe-share/',
  plugins: [react()],
})
