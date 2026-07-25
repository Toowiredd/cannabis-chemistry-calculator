/**
 * ReferenceStrip — flat row of 4 cards for the "Reference" group of tabs
 * (Methods, Advanced, Knowledge, Journal).
 *
 * The 2026-07-25 ccc design refresh moved these tabs out of the 3D
 * coverflow into a flat horizontal strip below the workflow carousel.
 * The reasoning: a 4-face 3D cylinder collapses visually (90° per
 * face — depth illusion disappears) AND the 9-face 3D carousel
 * violated the NN/g recommended max of 5 frames per carousel
 * (https://www.nngroup.com/articles/designing-effective-carousels/).
 *
 * The strip is a flat row of glass cards, each showing:
 *   - A line-art icon (lucide-react) on the left
 *   - The tab name + 2 preview bullets on the right
 *
 * The active tab is highlighted with a cyan border + glow. The other
 * cards sit at lower opacity until hovered. The 2-bullet preview
 * gives the user a "what does this tab do?" signal at-a-glance
 * (per the efficacy research's "active face needs a 1-second glance"
 * journey 4 finding).
 *
 * Design note: the strip is meant to read as a "next step" anchor
 * below the workflow carousel. The GroupedTabNav component renders
 * a soft "Next" chevron between the two surfaces.
 */
import { useCallback, useMemo, type ReactNode } from 'react'
import { cn } from 'renderer/lib/utils'
import {
  BarChart3,
  BookOpen,
  type LucideIcon,
  NotebookPen,
  Settings,
} from 'lucide-react'
import { useAppStore, type TabId } from 'renderer/src/stores/appStore'

/* ------------------------------------------------------------------ */
/* Public types                                                       */
/* ------------------------------------------------------------------ */

export interface ReferenceStripItem {
  id: TabId
  label: string
  /** Two preview bullets shown under the label. */
  bullets: [string, string]
  /** Lucide icon (defaults to a sensible icon per id if omitted). */
  icon?: LucideIcon
}

interface ReferenceStripProps {
  items: ReferenceStripItem[]
  className?: string
}

/* ------------------------------------------------------------------ */
/* Default icons (per-tab)                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_ICONS: Record<TabId, LucideIcon> = {
  dashboard: BarChart3,
  quickbatch: NotebookPen,
  decarb: BarChart3,
  infusion: BarChart3,
  dose: BarChart3,
  methods: BarChart3,
  advanced: Settings,
  knowledge: BookOpen,
  journal: NotebookPen,
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function ReferenceStrip({ items, className }: ReferenceStripProps) {
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)

  const onSelect = useCallback(
    (id: TabId) => () => setActiveTab(id),
    [setActiveTab]
  )

  const activeIdx = useMemo(
    () => items.findIndex(it => it.id === activeTab),
    [items, activeTab]
  )

  return (
    <nav
      aria-label="Reference tabs"
      aria-orientation="horizontal"
      className={cn(
        'flex w-full items-stretch gap-2 sm:gap-3',
        className
      )}
      data-testid="reference-strip"
      role="navigation"
    >
      {items.map((item, i) => {
        const Icon = item.icon ?? DEFAULT_ICONS[item.id] ?? BookOpen
        const isActive = i === activeIdx
        return (
          <ReferenceCard
            bullets={item.bullets}
            icon={<Icon aria-hidden="true" className="size-6" />}
            isActive={isActive}
            key={item.id}
            label={item.label}
            onClick={onSelect(item.id)}
            testId={`reference-card-${item.id}`}
          />
        )
      })}
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* Single card                                                        */
/* ------------------------------------------------------------------ */

interface ReferenceCardProps {
  label: string
  bullets: [string, string]
  icon: ReactNode
  isActive: boolean
  onClick: () => void
  testId: string
}

function ReferenceCard({
  label,
  bullets,
  icon,
  isActive,
  onClick,
  testId,
}: ReferenceCardProps) {
  return (
    <button
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
      className={cn(
        'group relative flex min-h-[80px] flex-1 items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all duration-300 sm:min-h-[88px] sm:px-4 sm:py-3',
        // Glass base — same as .glass utility but with explicit
        // border + hover transform so the strip is self-contained
        // (the parent .glass-strong layer in MainScreen would
        // double-stack otherwise).
        'border-foreground/10 bg-foreground/5 backdrop-blur-md',
        isActive
          ? 'border-accent/60 bg-accent/10 shadow-[0_0_24px_-4px_rgba(34,211,238,0.45)]'
          : 'hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-foreground/10 hover:shadow-md',
        // The active card has higher opacity; non-active cards
        // dim to make the active one read clearly.
        isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'
      )}
      data-testid={testId}
      onClick={onClick}
      type="button"
    >
      {/* Icon column — left side, larger glyph */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors sm:h-12 sm:w-12',
          isActive
            ? 'bg-accent/15 text-accent'
            : 'bg-foreground/5 text-foreground/70 group-hover:text-foreground/90'
        )}
      >
        {icon}
      </div>

      {/* Label + bullets column */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'truncate text-xs font-bold uppercase tracking-[0.14em] sm:text-sm',
            isActive ? 'text-accent' : 'text-foreground/80'
          )}
        >
          {label}
        </span>
        <ul className="flex flex-col gap-0.5 text-[10px] leading-tight text-foreground/60 sm:text-[11px]">
          {bullets.map((b, j) => (
            <li
              className="flex items-center gap-1.5 truncate"
              key={`${testId}-bullet-${j}`}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'inline-block h-1 w-1 shrink-0 rounded-full',
                  isActive ? 'bg-accent/60' : 'bg-foreground/30'
                )}
              />
              <span className="truncate">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Active indicator — small glow on the right edge */}
      {isActive && (
        <div
          aria-hidden="true"
          className="absolute right-2 top-2 size-1.5 rounded-full bg-accent shadow-[0_0_6px_2px_rgba(34,211,238,0.6)]"
        />
      )}
    </button>
  )
}
