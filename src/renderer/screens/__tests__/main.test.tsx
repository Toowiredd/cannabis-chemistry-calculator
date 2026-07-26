/**
 * Wire-up test for the WizardScreen feature flag in `screens/main.tsx`.
 *
 * The architecture doc §7 Week 1 mandates that the WizardScreen
 * replaces the GroupedTabNav (workflow group) when the
 * `wizardEnabled` flag is on. The ReferenceStrip is unchanged.
 * This test asserts the wire-up: with the flag on, the
 * WizardScreen's `data-testid="wizard-screen"` is in the tree;
 * with the flag off, the GroupedTabNav's `data-testid="grouped-
 * tab-nav"` is in the tree.
 *
 * The WizardScreen + Wizard components both read the flag
 * defensively (via the wizardFeatureFlag module's `unknown` cast),
 * so flipping the flag via `useAppStore.setState` toggles both
 * the main-screen wire-up and the WizardScreen's own gate.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { MainScreen } from '../main'
import { useAppStore } from 'renderer/src/stores/appStore'

function setWizardEnabled(enabled: boolean) {
  useAppStore.setState({
    ...(useAppStore.getState() as unknown as Record<string, unknown>),
    wizardEnabled: enabled,
  } as Partial<ReturnType<typeof useAppStore.getState>>)
}

beforeAll(() => {
  // The MainScreen tree pulls in `useReducedMotion`, which calls
  // `window.matchMedia` on mount. JSDOM doesn't ship matchMedia.
  // The mock returns `false` for the prefers-reduced-motion query
  // and an empty listener API — sufficient for the hook's effect
  // to set up + tear down cleanly. (Shared vitest.setup.ts is
  // intentionally not touched; the existing 60+ test files rely
  // on its minimal IS_REACT_ACT_ENVIRONMENT flag.)
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  })
})

beforeEach(() => {
  // The wizard feature flag is persisted to localStorage via
  // the Zustand persist middleware. A prior test file (e.g.
  // Stage2Transition / Stage2Recalculating) may have set
  // `wizardEnabled: true` and the persist middleware may have
  // written that to localStorage. Without clearing here, the
  // rehydrate on this test file's first render can pull
  // `true` and the `wizardEnabled: false` test below fails
  // with "Unable to find grouped-tab-nav-workflow". The
  // `setWizardEnabled(false)` after the clear is the explicit
  // "this test wants the flag off" signal; the clear is the
  // "no leftover from a prior test file" guard.
  localStorage.clear()
  setWizardEnabled(false)
})

describe('MainScreen — wizard feature flag', () => {
  it('renders the GroupedTabNav (workflow carousel) when wizardEnabled is false', async () => {
    setWizardEnabled(false)
    render(<MainScreen />)
    // The GroupedTabNav mounts the carousel face for each
    // workflow tab. We can assert against the grouped tab nav
    // testid, but it's inside a <Suspense> + lazy chunk, so
    // wait for it via findByTestId. Bumped to 5s (was 2s) —
    // the lazy chunk for the carousel's workflow face can
    // take >2s when the full suite is running in parallel
    // and module caching is cold for the first time this
    // file is exercised. The isolation case (this file
    // alone) still finishes well under 1s.
    expect(
      await screen.findByTestId('grouped-tab-nav-workflow', undefined, {
        timeout: 5000,
      })
    ).toBeTruthy()
    expect(
      document.querySelector('[data-testid="main-wizard-enabled"]')
    ).toBeNull()
  })

  it('renders the WizardScreen instead of the GroupedTabNav when wizardEnabled is true', async () => {
    setWizardEnabled(true)
    render(<MainScreen />)
    // The wizard-enabled wrapper is the top-level div that
    // hosts WizardScreen + ReferenceStrip. It renders as soon
    // as the parent Suspense resolves (no lazy chunk for the
    // wizard — it's a direct import).
    expect(
      await screen.findByTestId('main-wizard-enabled', undefined, {
        timeout: 2000,
      })
    ).toBeTruthy()
    // The product-type step is active at step 0.
    expect(
      await screen.findByTestId('step-card-product-type-active', undefined, {
        timeout: 2000,
      })
    ).toBeTruthy()
    // The grouped tab nav's workflow section is NOT in the tree
    // when the wizard is enabled.
    expect(
      document.querySelector('[data-testid="grouped-tab-nav-workflow"]')
    ).toBeNull()
  })
})
