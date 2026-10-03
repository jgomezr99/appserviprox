/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'

function djangoAutoServerPlugin(): Plugin {
  let djangoProcess: any = null

  return {
    name: 'django-auto-server',
    configureServer() {
      // Verificar si Django ya está respondiendo en el puerto 8000
      const checkReq = http.get('http://127.0.0.1:8000/api/v1/health/', (res) => {
        if (res.statusCode === 200) {
          console.log('\x1b[32m%s\x1b[0m', '✔ [Serviprox] Backend Django ya está activo en http://127.0.0.1:8000/ (Base de datos conectada)')
        }
      })

      checkReq.on('error', () => {
        console.log('\x1b[36m%s\x1b[0m', '⚙ [Serviprox] Iniciando automáticamente Backend Django y Base de Datos (SQLite)...')
        const isWindows = process.platform === 'win32'
        const venvPython = isWindows
          ? path.resolve(__dirname, 'backend', '.venv', 'Scripts', 'python.exe')
          : path.resolve(__dirname, 'backend', '.venv', 'bin', 'python')
        const pythonExe = fs.existsSync(venvPython) ? venvPython : (isWindows ? 'python' : 'python3')
        const managePy = path.resolve(__dirname, 'backend', 'manage.py')

        djangoProcess = spawn(pythonExe, [managePy, 'runserver', '0.0.0.0:8000'], {
          cwd: path.resolve(__dirname, 'backend'),
          shell: true,
          stdio: 'inherit',
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            SERVIPROX_DATABASE: 'sqlite',
          },
        })

        djangoProcess.on('error', (err: any) => {
          console.error('\x1b[31m%s\x1b[0m', '❌ [Serviprox] Error iniciando backend Django:', err)
        })
      })

      const stopDjango = () => {
        if (djangoProcess && djangoProcess.pid) {
          try {
            if (process.platform === 'win32') {
              spawn('taskkill', ['/pid', String(djangoProcess.pid), '/f', '/t'])
            } else {
              djangoProcess.kill()
            }
          } catch {}
          djangoProcess = null
        }
      }

      process.on('exit', stopDjango)
      process.on('SIGINT', () => {
        stopDjango()
        process.exit()
      })
      process.on('SIGTERM', () => {
        stopDjango()
        process.exit()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy(),
    djangoAutoServerPlugin(),
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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
