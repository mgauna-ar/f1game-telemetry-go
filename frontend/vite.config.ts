import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { expandMediaParams } from './src/styles/breakpoints.ts'

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

interface MediaRule {
  params: string
}
interface CssRoot {
  source?: { input: { file?: string } }
  walkAtRules: (name: string, visit: (rule: MediaRule) => void) => void
}

// Named breakpoints in stylesheets, `@media (--tablet)`, become widths (src/styles/breakpoints.ts).
// It runs on exit, after CSS Modules has merged in the sheets a module `composes` from.
function breakpointMedia() {
  return {
    postcssPlugin: 'breakpoint-media',
    OnceExit(root: CssRoot) {
      const file = root.source?.input.file
      root.walkAtRules('media', (rule) => {
        rule.params = expandMediaParams(rule.params, file)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preserveGitkeep()],
  css: {
    postcss: { plugins: [breakpointMedia()] },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws/engineer': {
        target: 'ws://localhost:8080',
        ws: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'vendor-lucide'
            }
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react'
            }
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) {
              return 'vendor-recharts'
            }
            return 'vendor'
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    // CSS Modules go through Vite so a misspelled class is undefined, and keep their written
    // names so tests and the DOM read the same class names. Global stylesheets are skipped.
    css: {
      include: [/\.module\.css$/],
      modules: { classNameStrategy: 'non-scoped' },
    },
  },
})
