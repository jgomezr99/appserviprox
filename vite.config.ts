/// <reference types="vitest" />

import react from '@vitejs/plugin-react'
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = new URL(
    env.VITE_API_URL || 'http://127.0.0.1:8000'
  ).origin
  const apiTargetSecure = apiTarget.startsWith('https://')

  return {
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          content: [
            './src/components/pqr/**/*.{js,ts,jsx,tsx}',
            './src/pages/PqrPage.tsx',
            './src/pages/ContractorMapPage.tsx',
          ],
          corePlugins: {
            preflight: false,
          },
        }),
        autoprefixer(),
      ],
    },
  },
  plugins: [
    {
      name: "production-api-url",
      configResolved(config) {
        if (config.command !== "build" || config.mode !== "production") return;
        // Solo exigir validación HTTPS estricta si se activa explícitamente ENFORCE_PROD_API=true
        if (process.env.ENFORCE_PROD_API !== "true") return;
        if (!config.env.VITE_API_URL) {
          throw new Error("VITE_API_URL es obligatoria para compilar clientes de produccion (https://DOMINIO_API/api/v1).");
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
    react()as any,
  ],
  server: {
    host: true,
    port: 8100,
    cors: true,
    warmup: {
      clientFiles: ['./src/main.tsx', './src/App.tsx', './src/pages/Login.tsx', './src/pages/ClientHome.tsx'],
    },
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: apiTargetSecure,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && !('headersSent' in res && res.headersSent) && 'writeHead' in res) {
              try {
                (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                (res as any).end(
                  JSON.stringify({
                    status: 'offline',
                    database: 'autonomous-sqlite',
                    detail: 'Servidor Django local no disponible. La aplicación opera con Base de Datos Autónoma (SQLite).',
                  })
                );
              } catch {
                // ignore
              }
            }
          });
        },
      },
      '/media': {
        target: apiTarget,
        changeOrigin: true,
        secure: apiTargetSecure,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && !('headersSent' in res && res.headersSent) && 'writeHead' in res) {
              try {
                (res as any).writeHead(404, { 'Content-Type': 'application/json' });
                (res as any).end(JSON.stringify({ detail: 'Media not found on local proxy' }));
              } catch {}
            }
          });
        },
      },
      '/static': {
        target: apiTarget,
        changeOrigin: true,
        secure: apiTargetSecure,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && !('headersSent' in res && res.headersSent) && 'writeHead' in res) {
              try {
                (res as any).writeHead(404, { 'Content-Type': 'application/json' });
                (res as any).end(JSON.stringify({ detail: 'Static not found on local proxy' }));
              } catch {}
            }
          });
        },
      },
    },
  },
  preview: {
    host: true,
    port: 8100,
    cors: true,
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('@ionic') ||
              id.includes('ionicons') ||
              id.includes('react') ||
              id.includes('react-dom') ||
              id.includes('react-router')
            ) {
              return 'vendor-core';
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
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
  }
  }
})
