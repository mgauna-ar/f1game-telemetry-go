import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

function preserveGitkeep() {
  return {
    name: 'preserve-gitkeep',
    closeBundle() {
      const gitkeepPath = path.resolve(__dirname, 'dist/.gitkeep')
      if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, '')
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preserveGitkeep()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
  },
})
