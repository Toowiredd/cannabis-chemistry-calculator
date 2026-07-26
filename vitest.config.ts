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
      // PWA web shim + IndexedDB platform layer (2026-07-25 follow-up).
      // Single-file path because the platform layer only has these
      // two test files today; widen to a glob if more land.
      'src/renderer/src/platform/__tests__/idb-store.test.ts',
      'src/renderer/src/platform/__tests__/web-shim.test.ts',
      // New shared primitives (design-system rein) — explicit single-file
      // paths so the existing orphan OptionCard.test.tsx (whose source is
      // not on disk) does not get picked up and break the run.
      'src/renderer/components/__tests__/OptionRow.test.tsx',
      'src/renderer/components/__tests__/MultiSelectGroup.test.tsx',
      // Wizard components (ui-tabs rein, 2026-07-26 Week 1). The
      // wizard/ dir holds the Stage 1 configuration wizard
      // (product-type step + Flower Method step); the components
      // dir holds the four shared primitives (Wizard, StepCard,
      // OptionTile, ProductTypeTooltip).
      'src/renderer/src/wizard/__tests__/**/*.test.ts',
      'src/renderer/src/wizard/__tests__/**/*.test.tsx',
      // Week 6 (2026-07-26 wizard build, §8.6): the three
      // extracted data libraries (`stockRecipes`,
      // `equipmentOptions`, `decbMethodCards`) and their
      // canonical-shape tests. Single-file paths to avoid orphan
      // pickup in case the source files move in a follow-up.
      'src/renderer/src/data/__tests__/stockRecipes.test.ts',
      'src/renderer/src/data/__tests__/equipmentOptions.test.ts',
      'src/renderer/src/data/__tests__/decbMethodCards.test.ts',
      'src/renderer/src/components/__tests__/Wizard.test.tsx',
      'src/renderer/src/components/__tests__/StepCard.test.tsx',
      'src/renderer/src/components/__tests__/OptionTile.test.tsx',
      'src/renderer/src/components/__tests__/ProductTypeTooltip.test.tsx',
      // Stage 2 stepper + execution shells (design-system rein,
      // 2026-07-26 Week 2). The container lives alongside the
      // Stage 1 primitives in `components/`; the five step
      // shells live in `components/execution/`.
      'src/renderer/src/components/__tests__/ExecutionStepper.test.tsx',
      'src/renderer/src/components/execution/__tests__/**/*.test.tsx',
      // Main screen feature-flag wire-up (ui-tabs rein, 2026-07-26
      // Week 1). Asserts the WizardScreen renders when
      // `wizardEnabled: true` and the existing GroupedTabNav
      // renders when `false`. Single-file path because the
      // screens/ dir only has this one test today.
      'src/renderer/screens/__tests__/main.test.tsx',
      // Main-process security tests (electron-shell rein). The renderer
      // include glob is scoped to src/renderer/**; main/** has its own
      // security test directory that exercises the F1.1 / F1.2 / F1.3
      // fixes (URL allowlist, journal-id regex, explicit webPreferences)
      // shipped in commit 7e7c2f0. Without this glob those tests would
      // be silently skipped — a false PASS.
      'src/main/**/__tests__/**/*.test.ts',
    ],
  },
})
