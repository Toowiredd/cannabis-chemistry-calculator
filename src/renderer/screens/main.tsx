import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { cn } from 'renderer/lib/utils'
import { StartupChooser } from 'renderer/src/components/StartupChooser'
import { GroupedTabNav } from 'renderer/src/components/GroupedTabNav'
import { TitleBar } from 'renderer/src/components/TitleBar'
import { TransformationCanvas } from 'renderer/src/components/TransformationCanvas'
import { FirstTimerGuide } from 'renderer/src/tabs/FirstTimerGuide'

/**
 * Lazy-loaded tab components.
 *
 * Each tab is split into its own dynamic-import chunk by Vite. The first-paint
 * bundle no longer pays for all 9 tabs up-front — the workflow group's 5
 * chunks fetch as the carousel mounts its first in-window face, and the
 * reference group's 4 chunks fetch when the user first clicks a reference
 * card. The PWA target benefits most (the service worker caches the
 * shared chunks; only the per-tab chunks come down on first visit).
 *
 * Note: `React.lazy` requires the import promise at module-init time, so
 * these refs are defined here (not inside `MainScreen`) and the `<Suspense>`
 * boundary that gates their fallback lives just below the carousel mount.
 */
const DecarbTab = lazy(() =>
  import('renderer/src/tabs/DecarbTab').then(m => ({ default: m.DecarbTab }))
)
const InfusionTab = lazy(() =>
  import('renderer/src/tabs/InfusionTab').then(m => ({
    default: m.InfusionTab,
  }))
)
const DoseTab = lazy(() =>
  import('renderer/src/tabs/DoseTab').then(m => ({ default: m.DoseTab }))
)
const MethodsTab = lazy(() =>
  import('renderer/src/tabs/MethodsTab').then(m => ({ default: m.MethodsTab }))
)
const AdvancedToolsTab = lazy(() =>
  import('renderer/src/tabs/AdvancedToolsTab').then(m => ({
    default: m.AdvancedToolsTab,
  }))
)
const KnowledgeTab = lazy(() =>
  import('renderer/src/tabs/KnowledgeTab').then(m => ({
    default: m.KnowledgeTab,
  }))
)
const JournalTab = lazy(() =>
  import('renderer/src/tabs/JournalTab').then(m => ({ default: m.JournalTab }))
)
const DashboardTab = lazy(() =>
  import('renderer/src/tabs/DashboardTab').then(m => ({
    default: m.DashboardTab,
  }))
)
const QuickBatchTab = lazy(() =>
  import('renderer/src/tabs/QuickBatchTab').then(m => ({
    default: m.QuickBatchTab,
  }))
)
import {
  useAppStore,
  type StartupIntent,
  type TabId,
} from 'renderer/src/stores/appStore'
import {
  destinationForStartupIntent,
  evaluateStartupRouting,
} from 'renderer/src/utils/startupRouting'
import { BookOpen, Loader2, Route } from 'lucide-react'

function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn('brand-glyph', className)}
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="20"
    >
      {/* Hexagon with a leaf/molecule inside */}
      <path d="M12 2l9.5 5.5v11L12 24l-9.5-5.5v-11z" />
      <path d="M12 8c-2.5 0-4 2-4 4s1.5 4 4 4" />
      <path d="M12 16c2.5 0 4-2 4-4s-1.5-4-4-4" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="M12 8V6M12 16v2M8 12H6M16 12h2" />
    </svg>
  )
}

export function MainScreen() {
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const theme = useAppStore(s => s.theme)
  const decarb = useAppStore(s => s.decarb)
  const infusion = useAppStore(s => s.infusion)
  const dose = useAppStore(s => s.dose)
  const startupRouting = useAppStore(s => s.startupRouting)
  const recordStartupLaunch = useAppStore(s => s.recordStartupLaunch)
  const recordStartupChooserShown = useAppStore(
    s => s.recordStartupChooserShown
  )
  const recordStartupIntent = useAppStore(s => s.recordStartupIntent)
  const firstRunDismissed = useAppStore(s => s.firstRunDismissed)
  const wizardDismissed = useAppStore(s => s.wizard.dismissed)
  const setWizardActive = useAppStore(s => s.setWizardActive)

  const [isLoading, setIsLoading] = useState(true)
  const [isExitingLoad, setIsExitingLoad] = useState(false)
  const [startupChooserOpen, setStartupChooserOpen] = useState(false)
  const [startupDecision, setStartupDecision] = useState<ReturnType<
    typeof evaluateStartupRouting
  > | null>(null)
  const launchRecordedRef = useRef(false)
  const startupHandledRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExitingLoad(true)
      setTimeout(() => setIsLoading(false), 350)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    if (launchRecordedRef.current) return
    launchRecordedRef.current = true
    recordStartupLaunch()
  }, [recordStartupLaunch])

  useEffect(() => {
    const map: Partial<Record<TabId, string>> = {
      decarb: 'decarb',
      infusion: 'infusion',
      dose: 'dose',
    }
    const stage = map[activeTab] ?? 'landing'
    document.body.dataset.workflowStage = stage
  }, [activeTab])

  useEffect(() => {
    // Startup routing note:
    // First-time education is now driven by the multi-select wizard slice
    // (see `stores/appStore.ts` — `wizard: { active, dismissed, stepIndex,
    // selections }`). The boot path underneath the wizard is still static
    // for now; the planned rollout per `docs/startup-routing-master.md` is:
    //   - Phase 1 (this effect): first launch opens the wizard and pins the
    //     underlying shell to `Quick Batch`. The wizard's `dismissed` flag
    //     is the user-level dismiss — once true, we never re-prompt.
    //   - Phase 2: ambiguous return states open a tiny chooser with 2-3
    //     intents (Make / Resume / History) above the same shell.
    //   - Phase 3: confident return auto-routes using the persisted
    //     `startupRouting` heuristic.
    // Keep this effect focused on first-run education + wizard boot; do
    // not overload it with tab persistence based only on `activeTab`.
    if (startupHandledRef.current) return

    // Wizard boot gate: open the wizard ONLY when the bootstrap flag
    // (`firstRunDismissed === false`) says this is a first launch AND the
    // user has not already dismissed the wizard explicitly
    // (`wizard.dismissed !== true`). This is the "never re-prompt a user who
    // already opted out" guarantee. If `wizard.dismissed` is undefined
    // (returning user on first ever launch), the hydration-time default
    // is `false`, so the wizard will open — preserving the first-launch UX.
    if (!firstRunDismissed && wizardDismissed !== true) {
      startupHandledRef.current = true
      setActiveTab('quickbatch')
      setStartupChooserOpen(false)
      setWizardActive(true)
      return
    }

    // Only intercept the bootstrap default. If some other tab is already
    // active, treat that as an explicit state rather than a startup mistake.
    if (activeTab !== 'decarb') {
      startupHandledRef.current = true
      return
    }

    const decision = evaluateStartupRouting({
      decarb,
      infusion,
      dose,
      startupRouting,
    })

    startupHandledRef.current = true
    setStartupDecision(decision)

    if (decision.mode === 'route') {
      setActiveTab(decision.destinationTab)
      return
    }

    setActiveTab(decision.destinationTab)
    recordStartupChooserShown()
    setStartupChooserOpen(true)
  }, [
    activeTab,
    decarb,
    dose,
    firstRunDismissed,
    infusion,
    recordStartupChooserShown,
    setActiveTab,
    setWizardActive,
    startupRouting,
    wizardDismissed,
  ])

  const openStartupChooser = () => {
    const decision = evaluateStartupRouting({
      decarb,
      infusion,
      dose,
      startupRouting,
    })
    setStartupDecision(decision)
    recordStartupChooserShown()
    setStartupChooserOpen(true)
  }

  const handleStartupIntent = (intent: StartupIntent) => {
    recordStartupIntent(intent)
    setActiveTab(
      destinationForStartupIntent(intent, {
        decarb,
        infusion,
        dose,
        startupRouting,
      })
    )
    setStartupChooserOpen(false)
  }

  return (
    <div className="flex h-screen w-screen min-w-0 flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />

      {/* Top bar: brand glyph + First-Timer Guide entry only.
          The 9 tabs are no longer a flat nav — they're faces of
          the carousel below, navigated via swipe, arrow keys,
          wheel, or the pagination dots. The top bar stays
          minimal so the carousel is the main attraction. */}
      <header className="relative z-[10] flex shrink-0 items-center gap-2 px-3 py-2 sm:px-4">
        <div className="app-region-no-drag flex items-center gap-2">
          <BrandGlyph className="size-5 text-accent" />
          <span className="hidden lg:inline text-sm font-semibold tracking-tight font-[family-name:var(--font-display)]">
            CCC
          </span>
        </div>

        {firstRunDismissed && (
          <div className="app-region-no-drag ml-auto flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-foreground/20 bg-foreground/5 px-2.5 py-1.5 text-xs font-medium text-foreground/80 transition-all duration-200 hover:bg-foreground/10 hover:text-foreground xl:px-3"
              onClick={openStartupChooser}
              type="button"
            >
              <Route className="size-3.5" />
              <span className="hidden xl:inline">Choose Start</span>
            </button>
            <button
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-info/30 bg-info/10 px-2.5 py-1.5 text-xs font-medium text-info transition-all duration-200 hover:bg-info/20 hover:-translate-y-px xl:px-3"
              onClick={() => setWizardActive(true)}
              type="button"
            >
              <BookOpen className="size-3.5" />
              <span className="hidden xl:inline">First-Timer Guide</span>
            </button>
          </div>
        )}
      </header>

      <FirstTimerGuide />
      {startupDecision && (
        <StartupChooser
          confidence={startupDecision.confidence}
          onClose={() => setStartupChooserOpen(false)}
          onSelect={handleStartupIntent}
          open={startupChooserOpen}
          reason={startupDecision.reason}
          recommendedIntent={startupDecision.recommendedIntent}
        />
      )}

      {/* Loading overlay with brand mark */}
      {isLoading && (
        <div
          className={cn(
            'absolute inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/95 backdrop-blur-sm transition-all duration-350',
            isExitingLoad && 'opacity-0'
          )}
        >
          <BrandGlyph className="size-10 text-accent loader-dim" />
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="size-6 animate-spin text-foreground/50" />
            <span className="text-sm font-medium text-foreground/50 tracking-wide">
              Loading calculations...
            </span>
          </div>
        </div>
      )}

      {/* Main content — the 2-level navigation surface (2026-07-25
          design refresh). The 9 tabs are split into 2 groups per
          the existing touchpoint topology:
          - Workflow (5): 3D coverflow carousel — the chemistry
            pipeline the user is on a journey through
          - Reference (4): flat row of cards — the "library" the
            user consults
          A "Next" indicator between the two groups suggests the
          natural next step. The carousel handles 5 faces, within
          Apple's 6-item sidebar cap. See GroupedTabNav.tsx for
          the 3D math + the next-step mapping. */}
      <main className="relative z-[10] min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
        <div className="relative mx-auto h-full w-full max-w-[1400px] overflow-hidden rounded-2xl">
          {/* Layer 0: Background animation filling the panel */}
          <TransformationCanvas />

          {/* Layer 1: Strong glass surface (GlassCard's glass-strong classes) */}
          <div className="absolute inset-0 z-[1] glass-strong" />

          {/* Layer 2: Content above glass */}
          <div className="relative z-[2] h-full min-w-0 p-3 sm:p-6">
            <Suspense
              fallback={
                <div
                  aria-busy="true"
                  aria-live="polite"
                  className="flex h-full w-full items-center justify-center p-8 text-sm text-muted-foreground"
                  role="status"
                >
                  Loading tab…
                </div>
              }
            >
              <GroupedTabNav
                reference={[
                  {
                    id: 'methods',
                    label: 'Methods',
                    bullets: ['Oven Decarb', 'Sous Vide · Slow Cooker'],
                    content: <MethodsTab />,
                  },
                  {
                    id: 'advanced',
                    label: 'Advanced',
                    bullets: ['Cost Analysis', 'Strain Blending'],
                    content: <AdvancedToolsTab />,
                  },
                  {
                    id: 'knowledge',
                    label: 'Knowledge',
                    bullets: ['Chemistry 101', 'AVB Guide'],
                    content: <KnowledgeTab />,
                  },
                  {
                    id: 'journal',
                    label: 'Journal',
                    bullets: ['Recent Batches', 'Saved Recipes'],
                    content: <JournalTab />,
                  },
                ]}
                workflow={[
                  {
                    id: 'dashboard',
                    label: 'Dashboard',
                    subtitle: 'overview',
                    content: <DashboardTab />,
                  },
                  {
                    id: 'quickbatch',
                    label: 'Quick Batch',
                    subtitle: 'wizard',
                    content: <QuickBatchTab />,
                  },
                  {
                    id: 'decarb',
                    label: 'Decarb',
                    subtitle: 'stage 1',
                    content: <DecarbTab />,
                  },
                  {
                    id: 'infusion',
                    label: 'Infusion',
                    subtitle: 'stage 2',
                    content: <InfusionTab />,
                  },
                  {
                    id: 'dose',
                    label: 'Dose',
                    subtitle: 'stage 3',
                    content: <DoseTab />,
                  },
                ]}
              />
            </Suspense>
          </div>
        </div>
      </main>

      <footer className="relative shrink-0 px-4 py-3 text-center">
        <p className="text-xs text-foreground/50">
          All calculations are heuristic estimates, not laboratory results.
        </p>
      </footer>
    </div>
  )
}
