import { Fragment, useEffect, useState } from 'react'
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

export function MainScreen() {
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const theme = useAppStore(s => s.theme)
  const firstRunDismissed = useAppStore(s => s.firstRunDismissed)
  const _dismissFirstRun = useAppStore(s => s.dismissFirstRun)
  const _firstTimerOpen = useAppStore(s => s.firstTimerOpen)
  const setFirstTimerOpen = useAppStore(s => s.setFirstTimerOpen)

  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600)
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

  /* Open guide automatically on first launch */
  useEffect(() => {
    if (!firstRunDismissed) {
      setFirstTimerOpen(true)
    }
  }, [firstRunDismissed, setFirstTimerOpen])

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground overflow-hidden">
      <TransformationCanvas />
      <TitleBar />

      <FirstTimerGuide />

      {isLoading && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/90">
          <Loader2 className="size-8 animate-spin text-foreground/70" />
          <span className="text-sm font-medium text-foreground/70">
            Loading calculations&hellip;
          </span>
        </div>
      )}

      <nav className="glass flex shrink-0 items-center gap-1 overflow-x-auto px-4 py-2 relative">
        {TAB_ITEMS.map((tab, i) => (
          <Fragment key={tab.id}>
            {/* Group divider */}
            {i > 0 && tab.group !== TAB_ITEMS[i - 1].group && (
              <div className="mx-1 h-6 w-px bg-foreground/20" />
            )}
            <button
              className={cn(
                'app-region-no-drag whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-foreground/15 text-foreground border border-foreground/20'
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

        {/* Re-access First-Timer Guide link (visible after dismiss) */}
        {firstRunDismissed && (
          <button
            className="app-region-no-drag ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs font-medium text-info transition-colors hover:bg-info/20"
            onClick={() => setFirstTimerOpen(true)}
            type="button"
          >
            <BookOpen className="size-3.5" />
            First-Timer Guide
          </button>
        )}
      </nav>

      <main className="relative mx-auto flex w-full max-w-[1400px] flex-1 overflow-auto p-4">
        <GlassCard className="mx-auto h-full w-full max-w-[1400px] overflow-auto">
          <div className={cn(activeTab === 'dashboard' ? 'block' : 'hidden')}>
            <DashboardTab />
          </div>
          <div className={cn(activeTab === 'quickbatch' ? 'block' : 'hidden')}>
            <QuickBatchTab />
          </div>
          <div className={cn(activeTab === 'decarb' ? 'block' : 'hidden')}>
            <DecarbTab />
          </div>
          <div className={cn(activeTab === 'infusion' ? 'block' : 'hidden')}>
            <InfusionTab />
          </div>
          <div className={cn(activeTab === 'dose' ? 'block' : 'hidden')}>
            <DoseTab />
          </div>
          <div className={cn(activeTab === 'methods' ? 'block' : 'hidden')}>
            <MethodsTab />
          </div>
          <div className={cn(activeTab === 'advanced' ? 'block' : 'hidden')}>
            <FatsTab />
          </div>
          <div className={cn(activeTab === 'knowledge' ? 'block' : 'hidden')}>
            <KnowledgeTab />
          </div>
          <div className={cn(activeTab === 'journal' ? 'block' : 'hidden')}>
            <JournalTab />
          </div>
        </GlassCard>
      </main>

      <footer className="relative shrink-0 px-4 py-2 text-center">
        <p className="text-xs text-foreground/70">
          All calculations are heuristic estimates, not laboratory results.
        </p>
      </footer>
    </div>
  )
}
