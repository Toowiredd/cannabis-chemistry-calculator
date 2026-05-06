import { cn } from 'renderer/lib/utils'
import { TitleBar } from 'renderer/src/components/TitleBar'
import { GlassCard } from 'renderer/src/components/GlassCard'
import { DecarbTab } from 'renderer/src/tabs/DecarbTab'
import { InfusionTab } from 'renderer/src/tabs/InfusionTab'
import { DoseTab } from 'renderer/src/tabs/DoseTab'
import { MethodsTab } from 'renderer/src/tabs/MethodsTab'
import { FatsTab } from 'renderer/src/tabs/FatsTab'
import { KnowledgeTab } from 'renderer/src/tabs/KnowledgeTab'
import { useAppStore, type TabId } from 'renderer/src/stores/appStore'

const TAB_ITEMS: { id: TabId; label: string }[] = [
  { id: 'decarb', label: 'Decarb' },
  { id: 'infusion', label: 'Infusion' },
  { id: 'dose', label: 'Dose' },
  { id: 'methods', label: 'Methods' },
  { id: 'fats', label: 'Fats' },
  { id: 'knowledge', label: 'Knowledge' },
]

export function MainScreen() {
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0a0a0a] text-white overflow-hidden">
      <TitleBar />

      <nav className="glass flex shrink-0 items-center gap-1 overflow-x-auto px-4 py-2">
        {TAB_ITEMS.map(tab => (
          <button
            className={cn(
              'app-region-no-drag whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-white/15 text-white border border-white/20'
                : 'text-white/60 hover:bg-white/5 hover:text-white/80'
            )}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="relative mx-auto flex w-full max-w-[1400px] flex-1 overflow-auto p-4">
        <GlassCard className="mx-auto h-full w-full max-w-[1400px] overflow-auto">
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
        </GlassCard>
      </main>

      <footer className="relative shrink-0 px-4 py-2 text-center">
        <p className="text-xs text-white/50">
          All calculations are heuristic estimates, not laboratory results.
        </p>
      </footer>
    </div>
  )
}
