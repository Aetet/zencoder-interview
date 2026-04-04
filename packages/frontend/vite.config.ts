import { defineConfig, type Plugin, transformWithEsbuild } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'

// Custom plugin: transform .reatom.tsx files with classic JSX (h/hf)
function reatomJsx(): Plugin {
  return {
    name: 'reatom-jsx',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.endsWith('.reatom.tsx')) return null
      const result = await transformWithEsbuild(code, id, {
        loader: 'tsx',
        jsx: 'transform',
        jsxFactory: 'h',
        jsxFragment: 'hf',
      })
      return { code: result.code, map: result.map }
    },
  }
}

export default defineConfig({
  plugins: [
    reatomJsx(),
    react({ exclude: /\.reatom\.tsx$/ }),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
