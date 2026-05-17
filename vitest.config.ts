import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/renderer/src/engine/__tests__/**/*.test.ts',
      'src/renderer/src/components/__tests__/**/*.test.ts',
      'src/renderer/src/components/__tests__/**/*.test.tsx',
    ],
  },
})
