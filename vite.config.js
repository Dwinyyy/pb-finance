import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const loadLocalEnv = () => {
  const envPath = path.join(dirname, '.env.local')

  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)

    if (!match || process.env[match[1]]) continue

    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

const localApi = () => ({
  name: 'pb-local-api',
  configureServer(server) {
    loadLocalEnv()

    server.middlewares.use('/api', async (req, res) => {
      res.status = (statusCode) => {
        res.statusCode = statusCode
        return res
      }
      res.json = (body) => {
        if (!res.getHeader('Content-Type')) {
          res.setHeader('Content-Type', 'application/json')
        }
        res.end(JSON.stringify(body))
      }

      try {
        const { default: handler } = await import('./api/index.js')
        await handler(req, res)
      } catch (error) {
        if (!res.writableEnded) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error.message || 'API request failed.' }))
        }
      }
    })
  },
})

export default defineConfig({
  plugins: [localApi(), react(), tailwindcss()],
})
