import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  // React 19's test-utils shim picks the build based on NODE_ENV. Vite's
  // default is 'production' (the bundler is production-oriented), which
  // selects the production build of react-dom-test-utils — that build's
  // `act` is a no-op that throws "React.act is not a function". Forcing
  // NODE_ENV=development in the test env makes the shim pick the dev
  // build, which exports a working `act`. This is the same workaround
  // @testing-library/react docs recommend for React 19.
  test: {
    globals: true,
    environment: 'jsdom',
    env: {
      NODE_ENV: 'development',
    },
    // setupFiles must run BEFORE any test imports so IS_REACT_ACT_ENVIRONMENT
    // is true when React 19's test-utils captures its `act` reference.
    setupFiles: ['./vitest.setup.ts'],
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
