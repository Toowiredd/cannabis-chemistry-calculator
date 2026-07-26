/**
 * StockRecipeCard — the Dashboard entry for a curated starter
 * recipe (per `docs/wizard-architecture-2026-07-26.md` §8.3).
 *
 * A focused, self-contained card that previews a stock recipe
 * (name, 1-line summary, key numbers like weight + temp) and
 * fires `onSelect(recipe)` when tapped. The caller (Dashboard
 * tab) is responsible for:
 *  - pre-filling the wizard's Stage 1 `selections` with
 *    `recipe.selections` and `wizard.branch` with
 *    `recipe.branch`
 *  - setting `wizard.currentStep` to 0 (the product-type
 *    picker is the first step; the wizard pre-fill is
 *    "guided shortcut, not skip" per §8.3)
 *  - opening the wizard (via the `wizardEnabled` flag or
 *    whatever routing the Dashboard uses to surface the
 *    wizard)
 *
 * The card is a `<GlassCard>` (per §5.4) with the recipe
 * name, 1-line description, and 2-3 small "key numbers" chips
 * (e.g. "28g · 113°C · 60 min" for an oven decarb). The whole
 * card is a button — clicking anywhere fires `onSelect`.
 */
import { GlassCard } from './GlassCard'

export interface StockRecipe {
  id: string
  name: string
  description: string
  branch: 'flower' | 'concentrate' | 'avb' | 'edible' | 'topical'
  /** Key numbers shown as chips on the card. Each string is
   *  rendered as a separate chip; pick 2-4 of the most
   *  representative numbers (weight, temp, time, servings). */
  chips: string[]
  /** The selections to pre-fill the wizard with. */
  selections: Record<string, unknown>
}

export interface StockRecipeCardProps {
  recipe: StockRecipe
  onSelect: (recipe: StockRecipe) => void
}

export function StockRecipeCard({ recipe, onSelect }: StockRecipeCardProps) {
  return (
    <div data-testid="stock-recipe-card">
      <GlassCard className="p-0">
        <button
          aria-label={`Pre-fill wizard with ${recipe.name}`}
          className="flex w-full flex-col gap-2 rounded-2xl p-4 text-left transition-colors hover:bg-foreground/5 sm:p-6"
          data-testid={`stock-recipe-card-${recipe.id}`}
          onClick={() => onSelect(recipe)}
          type="button"
        >
          <h3
            className="text-base font-bold text-foreground"
            data-testid={`stock-recipe-card-${recipe.id}-name`}
          >
            {recipe.name}
          </h3>
          <p className="text-xs text-foreground/70">{recipe.description}</p>
          {recipe.chips.length > 0 ? (
            <ul
              aria-label={`Key numbers for ${recipe.name}`}
              className="flex flex-wrap gap-1.5"
              data-testid={`stock-recipe-card-${recipe.id}-chips`}
            >
              {recipe.chips.map((chip, i) => (
                <li
                  className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium text-foreground/80"
                  data-testid={`stock-recipe-card-${recipe.id}-chip-${i}`}
                  key={`${recipe.id}-chip-${i}`}
                >
                  {chip}
                </li>
              ))}
            </ul>
          ) : null}
        </button>
      </GlassCard>
    </div>
  )
}
