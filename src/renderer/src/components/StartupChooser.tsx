import { BookOpen, History, Sparkles } from 'lucide-react'
import { cn } from 'renderer/lib/utils'
import type {
  StartupConfidence,
  StartupIntent,
} from 'renderer/src/stores/appStore'

interface StartupChooserProps {
  confidence: StartupConfidence
  onClose: () => void
  onSelect: (intent: StartupIntent) => void
  open: boolean
  reason: string
  recommendedIntent: StartupIntent
}

const INTENT_CARDS: {
  description: string
  icon: typeof Sparkles
  intent: StartupIntent
  label: string
}[] = [
  {
    intent: 'make_batch',
    label: 'Make a batch',
    description:
      'Open the guided batch flow and work from material through save.',
    icon: Sparkles,
  },
  {
    intent: 'resume_repeat',
    label: 'Resume or repeat',
    description:
      'Return to the last useful calculator or repeat a prior batch path.',
    icon: History,
  },
  {
    intent: 'history_learn',
    label: 'History / learn',
    description:
      'Jump into journal context and past outcomes before doing new work.',
    icon: BookOpen,
  },
]

function confidenceLabel(confidence: StartupConfidence): string {
  if (confidence === 'high') return 'Strong match'
  if (confidence === 'medium') return 'Suggested'
  return 'Choose a path'
}

export function StartupChooser({
  confidence,
  onClose,
  onSelect,
  open,
  reason,
  recommendedIntent,
}: StartupChooserProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="glass-strong flex w-full max-w-[760px] flex-col gap-5 rounded-2xl border border-foreground/10 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center rounded-full border border-info/30 bg-info/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-info">
              {confidenceLabel(confidence)}
            </span>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Choose where to start
              </h2>
              <p className="mt-1 max-w-[56ch] text-sm leading-relaxed text-foreground/70">
                {reason}
              </p>
            </div>
          </div>
          <button
            className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            Keep current view
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {INTENT_CARDS.map(({ description, icon: Icon, intent, label }) => {
            const isRecommended = intent === recommendedIntent
            return (
              <button
                className={cn(
                  'flex min-h-[180px] flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
                  isRecommended
                    ? 'border-success/40 bg-success/10'
                    : 'border-foreground/10 bg-foreground/5 hover:bg-foreground/10'
                )}
                key={intent}
                onClick={() => onSelect(intent)}
                type="button"
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/5">
                    <Icon className="size-4 text-foreground/80" />
                  </div>
                  {isRecommended && (
                    <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-success">
                      Recommended
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {label}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                    {description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
