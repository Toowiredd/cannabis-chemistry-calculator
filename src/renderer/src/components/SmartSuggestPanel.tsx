import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { cn } from 'renderer/lib/utils'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  scoreAllRecipes,
  type ScoredRecipe,
} from 'renderer/src/engine/recipeScoring'
import {
  Cookie,
  Pill,
  Droplet,
  FlaskConical,
  Sparkles,
  X,
  ChefHat,
  ChevronRight,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Icons per recipe                                                   */
/* ------------------------------------------------------------------ */

const RECIPE_ICONS: Record<string, React.ReactNode> = {
  brownies: <Cookie className="size-5" />,
  gummies: <Droplet className="size-5" />,
  capsules: <Pill className="size-5" />,
  tincture: <FlaskConical className="size-5" />,
}

/* ------------------------------------------------------------------ */
/* Helper: reduced-motion                                             */
/* ------------------------------------------------------------------ */

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

/* ------------------------------------------------------------------ */
/* FLIP transition                                                   */
/* ------------------------------------------------------------------ */

function runFlipTransition(
  sourceRef: HTMLElement,
  targetRef: HTMLElement,
  reducedMotion: boolean,
  onComplete: () => void
): () => void {
  const sRect = sourceRef.getBoundingClientRect()
  const tRect = targetRef.getBoundingClientRect()

  const dScaleX = tRect.width / sRect.width
  const dScaleY = tRect.height / sRect.height
  const dX = tRect.left + tRect.width / 2 - (sRect.left + sRect.width / 2)
  const dY = tRect.top + tRect.height / 2 - (sRect.top + sRect.height / 2)

  const clone = sourceRef.cloneNode(true) as HTMLElement
  clone.style.position = 'fixed'
  clone.style.left = `${sRect.left}px`
  clone.style.top = `${sRect.top}px`
  clone.style.width = `${sRect.width}px`
  clone.style.height = `${sRect.height}px`
  clone.style.zIndex = '9999'
  clone.style.margin = '0'
  clone.style.transition = reducedMotion
    ? 'none'
    : 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease'
  clone.style.willChange = 'transform, opacity'
  clone.style.pointerEvents = 'none'
  document.body.appendChild(clone)

  requestAnimationFrame(() => {
    if (reducedMotion) {
      clone.style.opacity = '0'
      onComplete()
      setTimeout(() => clone.remove(), 50)
      return
    }
    clone.style.transform = `translate(${dX}px, ${dY}px) scale(${dScaleX}, ${dScaleY})`
    clone.style.opacity = '0.0'
  })

  const onEnd = () => {
    clone.removeEventListener('transitionend', onEnd)
    clone.remove()
    onComplete()
  }
  clone.addEventListener('transitionend', onEnd)

  // Safety cleanup
  const timer = setTimeout(() => {
    if (clone.parentNode) {
      clone.removeEventListener('transitionend', onEnd)
      clone.remove()
      onComplete()
    }
  }, 600)

  return () => {
    clearTimeout(timer)
    clone.removeEventListener('transitionend', onEnd)
    clone.remove()
  }
}

/* ------------------------------------------------------------------ */
/* Detail Drawer                                                      */
/* ------------------------------------------------------------------ */

interface DetailDrawerProps {
  recipe: ScoredRecipe
  onClose: () => void
  onUse: () => void
  reducedMotion: boolean
  isProcessing: boolean
}

function DetailDrawer({
  recipe,
  onClose,
  onUse,
  reducedMotion,
  isProcessing,
}: DetailDrawerProps) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!reducedMotion) {
      const t = requestAnimationFrame(() => setShow(true))
      return () => cancelAnimationFrame(t)
    }
    setShow(true)
  }, [reducedMotion])

  return (
    <div
      aria-modal="true"
      className={cn(
        'absolute inset-x-0 bottom-0 z-30 flex flex-col gap-4 rounded-t-2xl border-t border-foreground/10 bg-card/80 p-5 backdrop-blur-xl',
        reducedMotion
          ? 'opacity-100'
          : 'transition-transform duration-300 ease-out',
        !reducedMotion &&
          (show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0')
      )}
      role="dialog"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {RECIPE_ICONS[recipe.id]}
          <span className="text-lg font-semibold text-foreground">
            {recipe.name}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              recipe.fatMatch
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-foreground/20 bg-foreground/5 text-foreground/70'
            )}
          >
            {recipe.difficulty}
          </span>
        </div>
        <button
          aria-label="Close recipe details"
          className="inline-flex items-center justify-center rounded-lg p-1 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>

      <p className="text-sm leading-relaxed text-foreground/80">
        {recipe.description}
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
          Tips
        </span>
        <ul className="flex flex-col gap-2">
          {recipe.tips.map(tip => (
            <li
              className="flex items-start gap-2 text-xs leading-relaxed text-foreground/70"
              key={`${recipe.id}-${tip.slice(0, 20)}`}
            >
              <ChefHat className="mt-0.5 size-3.5 shrink-0 text-foreground/50" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2 text-xs text-foreground/60">
        <span>Suggested servings: {recipe.defaultServings}</span>
        <span>&middot;</span>
        <span>{recipe.duration}</span>
      </div>

      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-foreground/20 bg-foreground/10 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50"
        disabled={isProcessing}
        onClick={onUse}
        type="button"
      >
        <Sparkles className="size-4" />
        Use This Recipe
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* SmartSuggestPanel                                                  */
/* ------------------------------------------------------------------ */

interface SmartSuggestPanelProps {
  mgPerServing: number
  fatId: string
  servingsInputRef?: React.RefObject<HTMLElement | null>
  formatInputRef?: React.RefObject<HTMLElement | null>
}

export function SmartSuggestPanel({
  mgPerServing,
  fatId,
  servingsInputRef,
  formatInputRef,
}: SmartSuggestPanelProps) {
  const setDose = useAppStore(s => s.setDose)
  const setActiveTab = useAppStore(s => s.setActiveTab)

  const reducedMotion = useReducedMotion()

  const [selectedRecipe, setSelectedRecipe] = useState<ScoredRecipe | null>(
    null
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const activeRecipe = selectedRecipe

  const viable = useMemo(
    () => scoreAllRecipes(mgPerServing, fatId),
    [mgPerServing, fatId]
  )

  const handleUseRecipe = useCallback(
    (recipe: ScoredRecipe) => {
      if (isProcessing) return
      setIsProcessing(true)

      const sourceEl = cardRefs.current[recipe.id]
      const targetEl = servingsInputRef?.current ?? formatInputRef?.current

      const apply = () => {
        setDose({
          servings: String(recipe.defaultServings),
          formatId: recipe.formatId,
        })
        setActiveTab('dose')
        setSelectedRecipe(null)
        setIsProcessing(false)
      }

      if (sourceEl && targetEl) {
        runFlipTransition(sourceEl, targetEl, reducedMotion, apply)
      } else {
        apply()
      }
    },
    [
      isProcessing,
      setDose,
      setActiveTab,
      reducedMotion,
      servingsInputRef,
      formatInputRef,
    ]
  )

  // Hide panel if dose is invalid or no viable recipes
  const hasInvalidDose = !Number.isFinite(mgPerServing) || mgPerServing <= 0

  if (hasInvalidDose || viable.length === 0) return null

  return (
    <div className="relative flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/5 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-foreground/70" />
        <span className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
          Recipe Suggestions
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {viable.map((recipe, index) => (
          <button
            aria-label={`${recipe.name} recipe. Ideal range ${recipe.idealMin} to ${recipe.idealMax} mg.`}
            className={cn(
              'group relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all',
              index === 0
                ? 'border-accent/40 bg-accent/[0.05]'
                : 'border-foreground/10 bg-foreground/5',
              'hover:border-foreground/30 hover:bg-foreground/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
            )}
            key={recipe.id}
            onClick={() =>
              setSelectedRecipe(prev =>
                prev?.id === recipe.id ? null : recipe
              )
            }
            type="button"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground/80 group-hover:text-foreground">
                {RECIPE_ICONS[recipe.id]}
                <span className="text-sm font-semibold">{recipe.name}</span>
              </div>
              {index === 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Best Match
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-xs text-foreground/60">
              <span>
                Ideal: {recipe.idealMin}–{recipe.idealMax} mg
              </span>
              <ChevronRight className="size-3" />
            </div>

            {/* Score bar */}
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{
                  width: `${Math.min(100, (recipe.score / 120) * 100)}%`,
                }}
              />
            </div>
          </button>
        ))}
      </div>

      {/* Detail drawer overlay */}
      {activeRecipe && (
        <DetailDrawer
          isProcessing={isProcessing}
          onClose={() => setSelectedRecipe(null)}
          onUse={() => handleUseRecipe(activeRecipe)}
          recipe={activeRecipe}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Backdrop for drawer */}
      {activeRecipe && (
        <button
          aria-label="Close recipe details"
          className="absolute inset-0 z-20 rounded-2xl bg-black/20"
          onClick={() => setSelectedRecipe(null)}
          type="button"
        />
      )}
    </div>
  )
}
