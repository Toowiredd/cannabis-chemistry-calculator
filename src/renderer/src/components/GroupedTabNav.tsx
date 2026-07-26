/**
 * GroupedTabNav — the 2-level navigation surface that replaced the
 * 9-face 3D coverflow as the primary tab navigation.
 *
 * The 2026-07-25 ccc design refresh recognized that the ccc's 9 tabs
 * are not peers — they are 2 levels of hierarchy encoded in
 * docs/ui-ux-touchpoint-topology-2026-07-25.json:
 *   - Workflow (5 tabs): the chemistry pipeline the user is on
 *     a journey through (Dashboard, Quick Batch, Decarb, Infusion,
 *     Dose). This is the user's actual mental model per
 *     TabCarousel.tsx:11-13.
 *   - Reference (4 tabs): the "library" the user consults
 *     (Methods, Advanced, Knowledge, Journal). A 4-face 3D cylinder
 *     collapses visually (90° per face — depth illusion disappears)
 *     so a flat row of cards is the right vocabulary.
 *
 * This component composes:
 *   1. A `TabCarousel` (3D coverflow) for the workflow group
 *   2. A "Next" indicator between the two groups
 *   3. A `ReferenceStrip` (flat row of cards) for the reference group
 *
 * Both groups share the same activeTab state. The active tab is
 * highlighted in whichever group it lives in. The "Next" button
 * jumps to the natural next step in the user's journey:
 *   - On Dose (the last workflow tab) → Journal (the natural
 *     "I just made a batch, where do I log it?" destination)
 *   - On Journal → Methods (compare what I just made against
 *     other methods)
 *   - On Quick Batch → Journal (same save destination)
 *   - Anywhere else → first reference tab (Methods)
 *
 * The Next button is a soft visual affordance — small chevron + text
 * — but it is fully interactive (per the user's design vision: every
 * element that looks interactive IS interactive).
 */
import { useCallback, useMemo, type ReactNode } from 'react'
import {
  ArrowDown,
  BarChart3,
  Beaker,
  BookOpen,
  Droplets,
  type LucideIcon,
  NotebookPen,
  Pill,
  Route,
  Salad,
  Settings,
} from 'lucide-react'
import { cn } from 'renderer/lib/utils'
import { TabCarousel, type CarouselItem } from './TabCarousel'
import { ReferenceStrip, type ReferenceStripItem } from './ReferenceStrip'
import { useAppStore, type TabId } from 'renderer/src/stores/appStore'
import { GlassCard } from './GlassCard'

/* ------------------------------------------------------------------ */
/* Public types                                                       */
/* ------------------------------------------------------------------ */

export interface GroupConfig {
  /** Visual kind of the group — drives the layout. */
  kind: 'workflow' | 'reference'
  /** Display label (uppercase, tracked). */
  label: string
  /** Optional sub-label below the main label. */
  subtitle?: string
  /** Tab items in this group. */
  items: GroupItem[]
}

export type GroupItem =
  | (CarouselItem & { group: 'workflow' })
  | (ReferenceStripItem & { group: 'reference'; content: ReactNode })

interface GroupedTabNavProps {
  /** All workflow tabs with their content (rendered in the 3D carousel). */
  workflow: CarouselItem[]
  /** All reference tabs with their preview bullets AND their content
   * (rendered in the flat strip and the content area, respectively). */
  reference: Array<ReferenceStripItem & { content: ReactNode }>
  className?: string
  /** Override the next-step map (e.g. for tests). */
  nextStepMap?: Partial<Record<TabId, TabId>>
}

/* ------------------------------------------------------------------ */
/* Next-step mapping                                                  */
/* ------------------------------------------------------------------ */

/**
 * Default mapping: each tab has a sensible "what's next" destination.
 * Used by the Next button between the workflow carousel and the
 * reference strip.
 */
const DEFAULT_NEXT_STEP: Record<TabId, TabId> = {
  dashboard: 'quickbatch',
  quickbatch: 'journal',
  decarb: 'infusion',
  infusion: 'dose',
  dose: 'journal',
  methods: 'journal',
  advanced: 'methods',
  knowledge: 'methods',
  journal: 'methods',
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function GroupedTabNav({
  workflow,
  reference,
  className,
  nextStepMap,
}: GroupedTabNavProps) {
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)

  const map = useMemo(
    () => ({ ...DEFAULT_NEXT_STEP, ...nextStepMap }),
    [nextStepMap]
  )

  const onNext = useCallback(() => {
    setActiveTab(map[activeTab] ?? 'methods')
  }, [activeTab, map, setActiveTab])

  /* Carousel needs items with `content` — wrap reference items as
   * lightweight stubs so the type matches. The reference strip is
   * the primary surface for the reference group; the carousel is
   * for the workflow group only. */
  const workflowItems: CarouselItem[] = useMemo(
    () =>
      workflow.map(it => ({
        id: it.id,
        label: it.label,
        subtitle: it.subtitle,
        content: it.content,
      })),
    [workflow]
  )

  const activeGroup: 'workflow' | 'reference' = useMemo(() => {
    if (workflow.some(it => it.id === activeTab)) return 'workflow'
    return 'reference'
  }, [workflow, activeTab])

  /* Find the active tab's content. The workflow group renders via
   * the 3D carousel. The reference group renders its content in a
   * flat panel above the reference strip — the workflow carousel
   * is hidden in this mode so the user gets the full content area. */
  const activeReferenceItem = useMemo(
    () => reference.find(it => it.id === activeTab),
    [reference, activeTab]
  )
  const activeWorkflowItem = useMemo(
    () => workflow.find(it => it.id === activeTab),
    [workflow, activeTab]
  )

  return (
    <div
      className={cn('flex h-full w-full flex-col gap-3 sm:gap-4', className)}
      data-testid="grouped-tab-nav"
    >
      {/* ---- Workflow group: 3D coverflow carousel ---- */}
      <section
        aria-label="Workflow tabs"
        className="flex min-h-0 flex-1 flex-col"
        data-testid="grouped-tab-nav-workflow"
      >
        <GroupHeader
          active={activeGroup === 'workflow'}
          label="Workflow"
          subtitle="Your chemistry pipeline"
        />
        <div className="relative min-h-0 flex-1">
          {/* Backdrop arc — a faint cyan arc behind the carousel that
              gives the 3D cylinder a visible silhouette. Drawn with
              an SVG so it scales with the container. */}
          <CarouselBackdropArc />
          {/* The carousel always renders the workflow group. When
              the active tab is a reference tab, the carousel still
              shows but the active face is dimmed (the user is in
              reference mode). The active reference tab's content
              is rendered in a separate panel below. */}
          <TabCarousel items={workflowItems} />
        </div>
      </section>

      {/* ---- Next indicator between groups ---- */}
      <NextIndicator
        currentTab={activeTab}
        nextTab={map[activeTab] ?? 'methods'}
        onNext={onNext}
      />

      {/* ---- Reference content area (only when active is reference) ---- */}
      {activeGroup === 'reference' && activeReferenceItem && (
        <section
          aria-label={`${activeReferenceItem.label} content`}
          className="shrink-0"
          data-testid="grouped-tab-nav-reference-content"
        >
          <GroupHeader
            active
            label={activeReferenceItem.label}
            subtitle="Reference tab"
          />
          <div data-testid="reference-content-panel">
            <GlassCard className="relative max-h-[40vh] overflow-auto rounded-2xl border border-foreground/10 p-4 shadow-2xl sm:p-6">
              {activeReferenceItem.content}
            </GlassCard>
          </div>
        </section>
      )}

      {/* ---- Reference group: flat row of cards ---- */}
      <section
        aria-label="Reference tabs"
        className="shrink-0"
        data-testid="grouped-tab-nav-reference"
      >
        <GroupHeader
          active={activeGroup === 'reference'}
          label="Reference"
          subtitle="Methods, knowledge, history"
        />
        <div className="mt-2">
          <ReferenceStrip items={reference} />
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Group header                                                       */
/* ------------------------------------------------------------------ */

function GroupHeader({
  label,
  subtitle,
  active,
}: {
  label: string
  subtitle?: string
  active: boolean
}) {
  return (
    <div className="mb-2 flex items-center gap-3 sm:mb-3">
      <h2
        className={cn(
          'text-base font-bold uppercase tracking-[0.22em] transition-colors duration-300 sm:text-lg',
          active ? 'text-accent' : 'text-foreground/40'
        )}
        data-testid={`group-header-${label.toLowerCase()}`}
      >
        {label}
      </h2>
      {subtitle && (
        <span
          className={cn(
            'truncate text-[10px] uppercase tracking-[0.18em] transition-colors duration-300 sm:text-xs',
            active ? 'text-foreground/60' : 'text-foreground/30'
          )}
        >
          {subtitle}
        </span>
      )}
      <div
        aria-hidden="true"
        className={cn(
          'h-px flex-1 transition-colors duration-300',
          active
            ? 'bg-gradient-to-r from-accent/40 via-accent/15 to-transparent'
            : 'bg-gradient-to-r from-foreground/15 to-transparent'
        )}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Carousel backdrop arc                                              */
/* ------------------------------------------------------------------ */

/**
 * A faint cyan arc behind the workflow carousel. Drawn with an SVG
 * so it scales with the container. Gives the 3D cylinder a visible
 * silhouette (matches the design vision in the carousel reference
 * image) without committing to a specific shape.
 *
 * The arc is `aria-hidden` (pure decoration) and `pointer-events-none`
 * (doesn't intercept carousel gestures). It sits behind the carousel
 * via z-index and fades in over 300ms.
 */
function CarouselBackdropArc() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 1000 400"
    >
      <defs>
        <linearGradient id="backdrop-arc" x1="0" x2="1" y1="0.5" y2="0.5">
          <stop offset="0" stopColor="rgb(34, 211, 238)" stopOpacity="0" />
          <stop offset="0.2" stopColor="rgb(34, 211, 238)" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="rgb(34, 211, 238)" stopOpacity="0.5" />
          <stop offset="0.8" stopColor="rgb(34, 211, 238)" stopOpacity="0.35" />
          <stop offset="1" stopColor="rgb(34, 211, 238)" stopOpacity="0" />
        </linearGradient>
        <radialGradient cx="0.5" cy="0.5" id="backdrop-arc-glow" r="0.5">
          <stop offset="0" stopColor="rgb(34, 211, 238)" stopOpacity="0.08" />
          <stop offset="0.6" stopColor="rgb(34, 211, 238)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Glow halo behind the cylinder */}
      <ellipse
        cx="500"
        cy="200"
        fill="url(#backdrop-arc-glow)"
        rx="450"
        ry="120"
      />
      {/* The arc itself — a wide ellipse that suggests the cylinder
          silhouette without rendering the panels themselves. */}
      <ellipse
        cx="500"
        cy="200"
        fill="none"
        rx="420"
        ry="140"
        stroke="url(#backdrop-arc)"
        strokeWidth="1.2"
      />
      {/* Bottom reflection — gives the cylinder a "resting on a
          surface" feel. */}
      <ellipse
        cx="500"
        cy="280"
        fill="none"
        opacity="0.25"
        rx="380"
        ry="40"
        stroke="rgb(34, 211, 238)"
        strokeWidth="0.6"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Next indicator                                                     */
/* ------------------------------------------------------------------ */

function NextIndicator({
  currentTab,
  nextTab,
  onNext,
}: {
  currentTab: TabId
  nextTab: TabId
  onNext: () => void
}) {
  const nextLabel = useMemo(() => prettyLabel(nextTab), [nextTab])
  return (
    <div
      className="flex flex-col items-center"
      data-testid="grouped-tab-nav-next"
    >
      {/* Soft divider line above the chevron */}
      <div
        aria-hidden="true"
        className="h-3 w-px bg-gradient-to-b from-transparent via-foreground/20 to-foreground/40"
      />
      <button
        aria-label={`Go to next: ${nextLabel} (after ${prettyLabel(currentTab)})`}
        className={cn(
          'group relative flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 backdrop-blur-md transition-all duration-300',
          'hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/10 hover:shadow-[0_0_18px_-4px_rgba(34,211,238,0.5)]'
        )}
        data-testid="next-indicator"
        onClick={onNext}
        type="button"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/50 transition-colors group-hover:text-accent">
          Next
        </span>
        <ArrowDown
          aria-hidden="true"
          className="size-3.5 text-foreground/50 transition-colors group-hover:text-accent"
          strokeWidth={2.5}
        />
        <span className="text-[10px] font-medium text-foreground/40 transition-colors group-hover:text-foreground/80">
          {nextLabel}
        </span>
      </button>
      <div
        aria-hidden="true"
        className="h-3 w-px bg-gradient-to-b from-foreground/40 via-foreground/20 to-transparent"
      />
    </div>
  )
}

function prettyLabel(id: TabId): string {
  switch (id) {
    case 'quickbatch':
      return 'Quick Batch'
    case 'dashboard':
      return 'Dashboard'
    case 'decarb':
      return 'Decarb'
    case 'infusion':
      return 'Infusion'
    case 'dose':
      return 'Dose'
    case 'methods':
      return 'Methods'
    case 'advanced':
      return 'Advanced'
    case 'knowledge':
      return 'Knowledge'
    case 'journal':
      return 'Journal'
    default:
      return id
  }
}

/* ------------------------------------------------------------------ */
/* Re-exports                                                         */
/* ------------------------------------------------------------------ */

export type { CarouselItem, ReferenceStripItem }

/* Per-tab icon helper — used by MainScreen to pre-build the
 * reference strip with consistent icons. */
export function defaultIconFor(id: TabId): LucideIcon {
  switch (id) {
    case 'methods':
      return BarChart3
    case 'advanced':
      return Settings
    case 'knowledge':
      return BookOpen
    case 'journal':
      return NotebookPen
    case 'decarb':
      return Beaker
    case 'infusion':
      return Droplets
    case 'dose':
      return Pill
    case 'quickbatch':
      return Route
    case 'dashboard':
      return Salad
    default:
      return Beaker
  }
}
