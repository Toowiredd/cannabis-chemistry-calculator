import { useEffect } from 'react'
import { cn } from 'renderer/lib/utils'
import { TitleBar } from 'renderer/src/components/TitleBar'
import { GlassCard } from 'renderer/src/components/GlassCard'
import { DecarbTab } from 'renderer/src/tabs/DecarbTab'
import { InfusionTab } from 'renderer/src/tabs/InfusionTab'
import { DoseTab } from 'renderer/src/tabs/DoseTab'
import { MethodsTab } from 'renderer/src/tabs/MethodsTab'
import { FatsTab } from 'renderer/src/tabs/FatsTab'
import { KnowledgeTab } from 'renderer/src/tabs/KnowledgeTab'
import { JournalTab } from 'renderer/src/tabs/JournalTab'
import { DashboardTab } from 'renderer/src/tabs/DashboardTab'
import { QuickBatchTab } from 'renderer/src/tabs/QuickBatchTab'
import { useAppStore, type TabId } from 'renderer/src/stores/appStore'
import { ArrowRightCircle } from 'lucide-react'

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
  { id: 'fats', label: 'Fats', group: 'reference' },
  { id: 'knowledge', label: 'Knowledge', group: 'reference' },
  { id: 'journal', label: 'Journal', group: 'reference' },
]

export function MainScreen() {
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const theme = useAppStore(s => s.theme)
  const firstRunDismissed = useAppStore(s => s.firstRunDismissed)
  const dismissFirstRun = useAppStore(s => s.dismissFirstRun)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground overflow-hidden">
      <TitleBar />

      <nav className="glass flex shrink-0 items-center gap-1 overflow-x-auto px-4 py-2 relative">
        {TAB_ITEMS.map((tab, i) => (
          <>
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
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          </>
        ))}

        {/* First-run guidance tooltip */}
        {!firstRunDismissed && (
          <div className="absolute bottom-full right-0 mb-2 mr-4">
            <div className="relative rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-xs text-sky-300 shadow-xl backdrop-blur-md">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-sky-200">
                <ArrowRightCircle className="size-3.5" />
                New here?
              </div>
              <p className="text-[11px] leading-relaxed text-sky-200/90">
                Start here: enter your material, choose a method, and calculate
                your dose.
              </p>
              <button
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-sky-300/30 bg-sky-300/10 px-2 py-0.5 text-[11px] font-medium text-sky-200 transition-colors hover:bg-sky-300/20"
                onClick={dismissFirstRun}
                type="button"
              >
                Got it
              </button>
              {/* Arrow pointing down */}
              <div className="absolute left-1/2 top-full -translate-x-1/2">
                <div className="h-0 w-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-sky-400/30" />
              </div>
            </div>
          </div>
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
          <div className={cn(activeTab === 'fats' ? 'block' : 'hidden')}>
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
