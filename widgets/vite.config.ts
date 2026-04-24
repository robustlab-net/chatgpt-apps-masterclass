import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
const FULL_URL = 'https://server.zaxrok.workers.dev/'
export default defineConfig(({mode})=>{
  return {
    plugins: [react(), tailwindcss()],
    base: mode === 'production' ? FULL_URL : undefined,
    build: {
      outDir: '../server/dist',
      emptyOutDir: true,
    }
  }
})
