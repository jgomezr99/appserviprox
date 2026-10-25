/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    {
      name: "production-api-url",
      configResolved(config) {
        if (config.command !== "build" || config.mode !== "production") return;
        if (!config.env.VITE_API_URL) {
          // Sin URL el cliente no envia peticiones a ningun host (ver resolveApiBaseUrl).
          console.warn("[serviprox] VITE_API_URL no esta definida: el sitio se publica sin backend.");
          return;
        }
        let url: URL;
        try { url = new URL(config.env.VITE_API_URL); } catch { throw new Error("VITE_API_URL no es una URL valida (https://DOMINIO_API/api/v1)."); }
        if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
            url.pathname.replace(/\/+$/, "") !== "/api/v1" ||
            /^(localhost|backend|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(url.hostname)) {
          throw new Error("VITE_API_URL debe ser una API publica HTTPS terminada en /api/v1.");
        }
      },
    },
    react(),
    legacy(),
  ],
  server: {
    host: true,
    port: 8100,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@ionic') || id.includes('ionicons')) {
              return 'vendor-ionic';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('leaflet')) {
              return 'vendor-leaflet';
            }
            if (id.includes('jspdf')) {
              return 'vendor-jspdf';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
