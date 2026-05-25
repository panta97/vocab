import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Web build target. The same renderer that the Electron app uses,
// served as a standalone web app — usable from any browser.
//
// dev:     npm run dev:web      (Vite dev server on :5174, LAN-accessible)
// build:   npm run build:web    -> dist-web/
// preview: npm run preview:web  (serve the built site locally)
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  envDir: resolve(__dirname),
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true
  },
  server: {
    port: 5174,
    host: true
  },
  preview: {
    port: 5174,
    host: true
  },
  plugins: [react()]
})
