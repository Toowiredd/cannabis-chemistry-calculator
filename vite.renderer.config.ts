import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import reactPlugin from '@vitejs/plugin-react'

export default {
  root: resolve('src/renderer'),
  server: {
    host: true,
    port: 4927,
  },
  resolve: {
    alias: {
      'lib/electron-router-dom': resolve('src/lib/electron-router-dom.ts'),
      'renderer/lib/utils': resolve('src/renderer/lib/utils.ts'),
      'renderer/src': resolve('src/renderer/src'),
      'renderer': resolve('src/renderer'),
      '~': resolve('.'),
    },
  },
  plugins: [tailwindcss(), reactPlugin()],
}
