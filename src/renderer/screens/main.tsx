import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { cn } from 'renderer/lib/utils'
import { TitleBar } from 'renderer/src/components/TitleBar'
import { GlassCard } from 'renderer/src/components/GlassCard'
import { TransformationCanvas } from 'renderer/src/components/TransformationCanvas'
import { DecarbTab } from 'renderer/src/tabs/DecarbTab'
import { InfusionTab } from 'renderer/src/tabs/InfusionTab'
import { DoseTab } from 'renderer/src/tabs/DoseTab'
import { MethodsTab } from 'renderer/src/tabs/MethodsTab'
import { FatsTab } from 'renderer/src/tabs/FatsTab'
import { KnowledgeTab } from 'renderer/src/tabs/KnowledgeTab'
import { JournalTab } from 'renderer/src/tabs/JournalTab'
import { DashboardTab } from 'renderer/src/tabs/DashboardTab'
import { QuickBatchTab } from 'renderer/src/tabs/QuickBatchTab'
import { FirstTimerGuide } from 'renderer/src/tabs/FirstTimerGuide'
import { SwipeDeck, WORKFLOW_TABS } from 'renderer/src/components/SwipeDeck'
import { useAppStore, type TabId } from 'renderer/src/stores/appStore'
import { BookOpen, Loader2 } from 'lucide-react'

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
  { id: 'advanced', label: 'Fats', group: 'reference' },
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
  const firstRunDismissed = useAppStore(s => s.firstRunDismissed)
  const _dismissFirstRun = useAppStore(s => s.dismissFirstRun)
  const _firstTimerOpen = useAppStore(s => s.firstTimerOpen)
  const setFirstTimerOpen = useAppStore(s => s.setFirstTimerOpen)

  const [isLoading, setIsLoading] = useState(true)
  const [isExitingLoad, setIsExitingLoad] = useState(false)

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
    const map: Partial<Record<TabId, string>> = {
      decarb: 'decarb',
      infusion: 'infusion',
      dose: 'dose',
    }
    const stage = map[activeTab] ?? 'landing'
    document.body.dataset.workflowStage = stage
  }, [activeTab])

  useEffect(() => {
    if (!firstRunDismissed) {
      setFirstTimerOpen(true)
    }
  }, [firstRunDismissed, setFirstTimerOpen])

  const isWorkflow: boolean = WORKFLOW_TABS.includes(
    activeTab as (typeof WORKFLOW_TABS)[number]
  )

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground overflow-hidden">
      <TransformationCanvas />
      <TitleBar />

      <FirstTimerGuide />

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

      {/* Tab navigation — all tabs via mini-strip */}
      <nav className="glass glass-shine flex shrink-0 items-center gap-1 overflow-x-auto px-4 py-2 relative">
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
                'app-region-no-drag whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
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
          <button
            className="app-region-no-drag ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs font-medium text-info transition-all duration-200 hover:bg-info/20 hover:-translate-y-px"
            onClick={() => setFirstTimerOpen(true)}
            type="button"
          >
            <BookOpen className="size-3.5" />
            First-Timer Guide
          </button>
        )}
      </nav>

      {/* Main content */}
      <main className="relative mx-auto flex w-full max-w-[1400px] flex-1 overflow-hidden p-4">
        <GlassCard className="mx-auto h-full w-full max-w-[1400px] overflow-hidden relative">
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
              {activeTab === 'advanced' && <FatsTab />}
              {activeTab === 'knowledge' && <KnowledgeTab />}
              {activeTab === 'journal' && <JournalTab />}
            </TabPanel>
          )}
        </GlassCard>
      </main>

      <footer className="relative shrink-0 px-4 py-3 text-center">
        <p className="text-xs text-foreground/50">
          All calculations are heuristic estimates, not laboratory results.
        </p>
      </footer>
    </div>
  )
}
