import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from 'renderer/lib/utils'
import { StartupChooser } from 'renderer/src/components/StartupChooser'
import { TitleBar } from 'renderer/src/components/TitleBar'
import { TransformationCanvas } from 'renderer/src/components/TransformationCanvas'
import { DecarbTab } from 'renderer/src/tabs/DecarbTab'
import { InfusionTab } from 'renderer/src/tabs/InfusionTab'
import { DoseTab } from 'renderer/src/tabs/DoseTab'
import { MethodsTab } from 'renderer/src/tabs/MethodsTab'
import { AdvancedToolsTab } from 'renderer/src/tabs/AdvancedToolsTab'
import { KnowledgeTab } from 'renderer/src/tabs/KnowledgeTab'
import { JournalTab } from 'renderer/src/tabs/JournalTab'
import { DashboardTab } from 'renderer/src/tabs/DashboardTab'
import { QuickBatchTab } from 'renderer/src/tabs/QuickBatchTab'
import { FirstTimerGuide } from 'renderer/src/tabs/FirstTimerGuide'
import { SwipeDeck, WORKFLOW_TABS } from 'renderer/src/components/SwipeDeck'
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

const TAB_ITEMS: {
  id: TabId
  label: string
  group: 'workflow' | 'calculator' | 'reference'
}[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'workflow' },
  { id: 'quickbatch', label: 'Quick Batch', group: 'workflow' },
  { id: 'decarb', label: 'Decarb', group: 'calculator' },
  { id: 'infusion', label: 'Infusion', group: 'calculator' },
  { id: 'dose', label: 'Dose', group: 'calculator' },
  { id: 'methods', label: 'Methods', group: 'reference' },
  { id: 'advanced', label: 'Advanced Tools', group: 'reference' },
  { id: 'knowledge', label: 'Knowledge', group: 'reference' },
  { id: 'journal', label: 'Journal', group: 'reference' },
]

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

function TabPanel({
  active,
  children,
  _index,
}: {
  active: boolean
  children: ReactNode
  _index: number
}) {
  const [mounted, setMounted] = useState(active)

  useEffect(() => {
    if (active) {
      setMounted(true)
    } else {
      const timer = setTimeout(() => setMounted(false), 220)
      return () => clearTimeout(timer)
    }
  }, [active])

  if (!mounted) return null

  return (
    <div
      className={cn(
        'absolute inset-0 overflow-auto',
        active
          ? 'tab-enter pointer-events-auto'
          : 'tab-exit pointer-events-none'
      )}
    >
      {children}
    </div>
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
  const _dismissFirstRun = useAppStore(s => s.dismissFirstRun)
  const _firstTimerOpen = useAppStore(s => s.firstTimerOpen)
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

  const isWorkflow: boolean = WORKFLOW_TABS.includes(
    activeTab as (typeof WORKFLOW_TABS)[number]
  )

  return (
    <div className="flex h-screen w-screen min-w-0 flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />

      {/* Nav bar - opaque glass, no animation behind it */}
      <nav className="relative z-[10] flex shrink-0 items-center gap-1 overflow-x-auto px-2 py-2 glass glass-shine sm:px-4">
        {/* Brand glyph left */}
        <div className="app-region-no-drag mr-2 flex items-center gap-2 border-r border-foreground/10 pr-3">
          <BrandGlyph className="size-5 text-accent" />
          <span className="hidden lg:inline text-sm font-semibold tracking-tight font-[family-name:var(--font-display)]">
            CCC
          </span>
        </div>

        {TAB_ITEMS.map((tab, i) => (
          <Fragment key={tab.id}>
            {/* Group divider */}
            {i > 0 && tab.group !== TAB_ITEMS[i - 1].group && (
              <div className="mx-1 h-6 w-px bg-foreground/20" />
            )}
            <button
              className={cn(
                'app-region-no-drag whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 sm:px-4',
                activeTab === tab.id
                  ? 'bg-foreground/15 text-foreground border border-foreground/20 shadow-sm'
                  : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground/80'
              )}
              onClick={() => setActiveTab(tab.id)}
              style={
                activeTab === tab.id
                  ? { color: 'var(--stage-accent)' }
                  : undefined
              }
              type="button"
            >
              {tab.label}
            </button>
          </Fragment>
        ))}

        {/* First-Timer Guide link */}
        {firstRunDismissed && (
          <div className="app-region-no-drag ml-auto flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-foreground/20 bg-foreground/5 px-2.5 py-2 text-xs font-medium text-foreground/80 transition-all duration-200 hover:bg-foreground/10 hover:text-foreground xl:px-3"
              onClick={openStartupChooser}
              type="button"
            >
              <Route className="size-3.5" />
              <span className="hidden xl:inline">Choose Start</span>
            </button>
            <button
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-info/30 bg-info/10 px-2.5 py-2 text-xs font-medium text-info transition-all duration-200 hover:bg-info/20 hover:-translate-y-px xl:px-3"
              onClick={() => setWizardActive(true)}
              type="button"
            >
              <BookOpen className="size-3.5" />
              <span className="hidden xl:inline">First-Timer Guide</span>
            </button>
          </div>
        )}
      </nav>

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

      {/* Main content */}
      <main className="relative z-[10] min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
        <div className="relative mx-auto h-full w-full max-w-[1400px] overflow-hidden rounded-2xl">
          {/* Layer 0: Background animation filling the panel */}
          <TransformationCanvas />

          {/* Layer 1: Strong glass surface (GlassCard's glass-strong classes) */}
          <div className="absolute inset-0 z-[1] glass-strong" />

          {/* Layer 2: Content above glass */}
          <div className="relative z-[2] h-full min-w-0 p-3 sm:p-6">
            {/* IA note:
                The app currently mixes three entry models:
                1. raw workflow calculators (Decarb / Infusion / Dose)
                2. guided wizard (Quick Batch)
                3. reference/history surfaces (Journal / Knowledge / Dashboard)
                The startup chooser should route into one of those human intents
                before we render a hardcoded default tab. */}
            {isWorkflow ? (
              <SwipeDeck>
                <DecarbTab />
                <InfusionTab />
                <DoseTab />
              </SwipeDeck>
            ) : (
              <TabPanel _index={0} active={true}>
                {activeTab === 'dashboard' && <DashboardTab />}
                {activeTab === 'quickbatch' && <QuickBatchTab />}
                {activeTab === 'methods' && <MethodsTab />}
                {activeTab === 'advanced' && <AdvancedToolsTab />}
                {activeTab === 'knowledge' && <KnowledgeTab />}
                {activeTab === 'journal' && <JournalTab />}
              </TabPanel>
            )}
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
