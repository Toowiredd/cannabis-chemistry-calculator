/**
 * NameRecipeStep — the "Name this recipe" inline card (per
 * `docs/wizard-architecture-2026-07-26.md` §5.4 + §8.5).
 *
 * Renders a single text input with a default placeholder
 * derived from the Stage 1 selections (e.g. "Oven, sealed
 * bag — 7g — Coconut oil" for a typical Flower branch).
 * The user can edit the name; tapping "Save recipe" fires
 * `onSave(name)` with the entered text. Tapping the Enter
 * key in the input also fires `onSave(name)` (the keyboard
 * shortcut for "I'm done naming").
 *
 * The input has a visible label, an aria-described hint
 * ("You can change this later from the Dashboard"), and a
 * `data-testid` hook for integration tests:
 *  - `data-testid="name-recipe-step"` (root)
 *  - `data-testid="name-recipe-step-input"` (text input)
 *  - `data-testid="name-recipe-step-save"` (save button)
 *  - `data-testid="name-recipe-step-placeholder"` (the
 *    derived default, rendered as a placeholder attr on the
 *    input)
 *  - `data-testid="name-recipe-step-hint"` (the aria hint)
 *
 * Visual tokens (background, border, text) come from the
 * existing Tailwind tokens (no globals.css change). The
 * focus ring is the design-system rein's standard
 * `focus-visible:ring-2 focus-visible:ring-accent/60`.
 */
import { BookmarkPlus } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { GlassCard } from './GlassCard'
import type { WizardSelections } from 'renderer/src/wizard/wizardTypes'

/**
 * Friendly display name for the 6 decarb method IDs (same map as
 * `src/renderer/src/wizard/steps.ts:132-139`, mirrored here so the
 * derivation is self-contained — the wizard steps file is the
 * canonical source for the option-tile display, this is the
 * canonical source for the recipe-name derivation).
 */
const METHOD_DISPLAY_NAME: Record<string, string> = {
  oven_sealed: 'Oven, sealed bag',
  oven_open: 'Oven, open tray',
  sv_combined: 'Sous vide, combined',
  sv_fast: 'Sous vide, fast',
  sv_lowtemp: 'Sous vide, low-temp',
  sv_dry: 'Sous vide, dry',
}

/**
 * Short friendly name for the 4 engine fat IDs. Drops the "oil"
 * / "Oil" suffix so the recipe name reads tight:
 * "Coconut Oil" → "Coconut", "MCT Oil" → "MCT", "Ghee" → "Ghee".
 * Mirrors the `INFUSION_FATS` table in `engine/models.ts:311`.
 */
const FAT_FRIENDLY_NAME: Record<string, string> = {
  ghee: 'Ghee',
  coconut: 'Coconut',
  mct: 'MCT',
  custom: 'Custom',
}

/**
 * Short friendly name for the carrier IDs in the Topical /
 * Concentrate / AVB branches. Drops the "oil" / "(high-proof)" /
 * "(VG)" parenthetical so the recipe name reads tight.
 * Mirrors `CARRIER_PRESETS` in `wizard/steps.ts:526`.
 */
const CARRIER_FRIENDLY_NAME: Record<string, string> = {
  alcohol: 'Alcohol',
  glycerin: 'Glycerin',
  mct: 'MCT',
  olive: 'Olive',
  coconut: 'Coconut',
}

/**
 * Short friendly name for the 3 AVB color IDs. Drops the
 * parenthetical descriptor so the recipe name reads tight.
 * Mirrors `colorStep` in `wizard/steps.ts:622`.
 */
const COLOR_FRIENDLY_NAME: Record<string, string> = {
  light: 'Light',
  medium: 'Medium',
  dark: 'Dark',
}

/**
 * Short friendly name for the 4 application-area IDs. Keeps the
 * full descriptive suffix so the recipe name reads as
 * "Olive — Joints / arthritis" (per the §8.5 example).
 * Mirrors `APPLICATION_AREA_PRESETS` in `wizard/steps.ts:657`.
 */
const APPLICATION_AREA_FRIENDLY_NAME: Record<string, string> = {
  face: 'Face',
  body: 'Body (general)',
  joint: 'Joints / arthritis',
  muscle: 'Muscle / sore areas',
}

/**
 * Derive a default recipe name from Stage 1 selections.
 * Pure, exhaustive over the common branch shapes.
 * Examples:
 *  - flower with method=oven_sealed, weight=g-7, fat=coconut →
 *    "Oven, sealed bag — 7g — Coconut"
 *  - concentrate with potency=p-75, carrier=mct → "75% — MCT"
 *  - avb with color=light, carrier=alcohol → "Light — Alcohol"
 *  - topical with carrier=olive, applicationArea=joint →
 *    "Olive — Joints / arthritis"
 *  - empty selections → "Untitled batch"
 */
export function deriveDefaultRecipeName(selections: WizardSelections): string {
  // Build a list of "parts" based on which selections are set. The
  // order matches the per-branch shape: flower/edible (method,
  // weight, fat), concentrate (potency, carrier), avb (color,
  // carrier), topical (carrier, applicationArea). Empty selections
  // fall through to the "Untitled batch" sentinel.
  const parts: string[] = []

  // Method — flower / edible branch (and the brief's primary
  // example). Falls back to the raw id when the engine method id
  // isn't on the display map (defensive — engine IDs are a closed
  // union but the wizard's `selections.method` is `string`).
  if (selections.method) {
    parts.push(METHOD_DISPLAY_NAME[selections.method] ?? selections.method)
  }

  // Weight — flower / edible branch. Stored as `{value, unit}`;
  // we render `${value}${unit}` ("7g", "1oz") with no space —
  // matches the §8.5 example "Oven, sealed bag — 7g — Coconut".
  if (selections.weight) {
    parts.push(`${selections.weight.value}${selections.weight.unit}`)
  }

  // Fat — flower / edible branch. The Fat step encodes
  // `selections.fat = null` for the "No infusion" tile (§3.1); we
  // skip the segment in that case rather than render a trailing
  // " — null" (or similar). `undefined` means the step hasn't
  // been answered yet — also skip.
  if (selections.fat) {
    parts.push(FAT_FRIENDLY_NAME[selections.fat] ?? selections.fat)
  }

  // Potency — concentrate branch. Rendered as "75%" / "85%".
  // The `p-75` option id in `potencyStep` is just the encoding;
  // the state stores the raw number.
  if (selections.potency !== undefined) {
    parts.push(`${selections.potency}%`)
  }

  // Color — avb branch. Rendered as the short form
  // ("Light" / "Medium" / "Dark").
  if (selections.color) {
    parts.push(COLOR_FRIENDLY_NAME[selections.color] ?? selections.color)
  }

  // Carrier — concentrate / avb / topical branches. For the
  // topical branch the carrier goes first (per the §8.5
  // example "Olive — Joints / arthritis"); for concentrate /
  // avb it follows potency / color. The order here is:
  // method, weight, fat, potency, color, carrier, appArea —
  // which produces the right shape for every single-branch
  // case (and degrades gracefully for multi-branch mid-wizard
  // transitions).
  if (selections.carrier) {
    parts.push(CARRIER_FRIENDLY_NAME[selections.carrier] ?? selections.carrier)
  }

  // Application area — topical branch. The title is kept in
  // full so the recipe name reads as a self-describing phrase
  // ("Olive — Joints / arthritis", "Olive — Face", etc.).
  if (selections.applicationArea) {
    parts.push(
      APPLICATION_AREA_FRIENDLY_NAME[selections.applicationArea] ??
        selections.applicationArea
    )
  }

  if (parts.length === 0) {
    return 'Untitled batch'
  }

  return parts.join(' — ')
}

export interface NameRecipeStepProps {
  /** Stage 1 selections — used to derive the default name. */
  selections: WizardSelections
  /** Pre-filled value (when re-running a saved Recipe, the
   * wizard pre-loads the existing name). Falls back to the
   * derived default when empty. */
  initialName?: string
  /** Fired when the user taps "Save recipe" or presses Enter
   * in the input. The argument is the entered (or default)
   * name string. */
  onSave: (name: string) => void
  /** Optional. Fired when the user taps "Skip — use default
   * name". Saves with the derived default. The button is
   * only rendered when this callback is provided (so the
   * caller controls whether skip is allowed). */
  onSkip?: () => void
}

export function NameRecipeStep({
  selections,
  initialName,
  onSave,
  onSkip,
}: NameRecipeStepProps) {
  // Memoize the derived default so the component re-derives
  // only when the selections object changes (not on every
  // keystroke). The user's typed value is held in local state
  // and is NOT re-derived from selections — the user can edit
  // freely and the input doesn't snap back if the parent
  // re-renders with a different selections reference.
  const defaultName = useMemo(
    () => deriveDefaultRecipeName(selections),
    [selections]
  )

  // Initial value: the explicit `initialName` wins (used when
  // re-running a saved Recipe); otherwise the derived default.
  // `useState` initial value is computed once on mount, so the
  // input doesn't re-pre-fill on re-render.
  const [name, setName] = useState<string>(() => {
    const trimmed = initialName?.trim()
    return trimmed ? trimmed : defaultName
  })

  const submit = () => {
    // Trim the user's input; fall back to the derived default
    // if they cleared the field (per the prop contract — the
    // caller always gets a non-empty name back).
    onSave(name.trim() || defaultName)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter in a single-line text input is the canonical
    // "I'm done typing" affordance — fire the same `onSave`
    // as tapping "Save recipe".
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    // The wrapper <section> carries the root testid because
    // <GlassCard> does not forward arbitrary props (it accepts
    // only `children`, `className`, `variant`, `hover`). The
    // GlassCard sits inside as the visual shell.
    <section data-testid="name-recipe-step">
      <GlassCard className="flex flex-col gap-3">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
            Final step
          </p>
          <h3 className="text-base font-semibold text-foreground">
            Name this recipe
          </h3>
          <p className="text-xs leading-relaxed text-foreground/70">
            Give this batch a name so you can find it again from the
            Dashboard. The default below is built from your selections
            — accept it or type your own.
          </p>
        </header>

        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="name-recipe-step-input"
          >
            Recipe name
          </label>
          <input
            aria-describedby="name-recipe-step-hint"
            className="w-full rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            data-testid="name-recipe-step-input"
            id="name-recipe-step-input"
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={defaultName}
            type="text"
            value={name}
          />
        </div>

        <p
          className="text-xs text-foreground/60"
          data-testid="name-recipe-step-hint"
          id="name-recipe-step-hint"
        >
          You can change this later from the Dashboard.
        </p>

        {/* The default indicator. The same derived string is also
            rendered as the input's HTML `placeholder` attribute (so
            the user sees it as ghost text inside the field), and
            this element surfaces it as an explicit "Default:" label
            below the input for users who prefer the explicit
            affordance. Two distinct testids because they are two
            distinct elements. */}
        <p
          className="text-xs text-foreground/60"
          data-testid="name-recipe-step-placeholder"
        >
          Default:{' '}
          <span className="font-medium text-foreground/80">{defaultName}</span>
        </p>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {onSkip ? (
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-foreground/15 bg-transparent px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5"
              onClick={onSkip}
              type="button"
            >
              Skip — use default name
            </button>
          ) : null}
          <button
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent/25 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            data-testid="name-recipe-step-save"
            onClick={submit}
            type="button"
          >
            <BookmarkPlus aria-hidden="true" className="size-4" />
            Save recipe
          </button>
        </div>
      </GlassCard>
    </section>
  )
}
