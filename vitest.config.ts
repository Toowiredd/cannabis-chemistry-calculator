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
      'src/renderer/src/stores/__tests__/**/*.test.ts',
      'src/renderer/src/stores/__tests__/**/*.test.tsx',
      'src/renderer/src/tabs/__tests__/**/*.test.tsx',
      // New shared primitives (design-system rein) — explicit single-file
      // paths so the existing orphan OptionCard.test.tsx (whose source is
      // not on disk) does not get picked up and break the run.
      'src/renderer/components/__tests__/OptionRow.test.tsx',
      'src/renderer/components/__tests__/MultiSelectGroup.test.tsx',
    ],
  },
})
