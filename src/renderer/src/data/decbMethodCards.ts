/**
 * Decarb method cards — extracted from FirstTimerGuide.tsx's
 * per-method content (per docs/wizard-architecture-2026-07-26.md
 * §8.6, Week 6 deliverable).
 *
 * The First-Timer Guide tab is being deprecated. The useful
 * method card content (display name, plain-language note, badge)
 * survives as a shared library that the Wizard's per-step
 * explanations consume.
 *
 * The data here is the same shape the engine surfaces via
 * `engine/wizardPresets.ts > DECARB_METHOD_CARDS` (alias
 * `METHOD_OPTIONS`) — every entry references one of the 6 real
 * decarb methods from `engine/models.ts > DECARB_METHODS`
 * (`sv_dry`, `sv_combined`, `sv_fast`, `sv_lowtemp`, `oven_sealed`,
 * `oven_open`). The `id` matches the engine's `PresetMethod.id`
 * verbatim so the wizard's "what does this method mean?" tooltip
 * can look up a card by the selection value the user already
 * picked.
 *
 * The badges below are the brief-mandated `badge` field on
 * `WizardOption` (Week 1 spec) — the wizard renders them as
 * "Beginner-friendly" / "Best match" pills on the option tile.
 *
 * Pure TypeScript — zero UI / React / Electron imports.
 */
import type { DecarbMethodCard } from '../engine/wizardPresets'
import { DECARB_METHOD_CARDS } from '../engine/wizardPresets'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * Extended per-method card. Inherits everything from the engine's
 * `DecarbMethodCard` (id, label, tempC, timeMin/Max, efficiency,
 * terpeneLabel, cbnLabel, humanNote) and adds the wizard-side
 * decoration fields the brief asked for (badge + tooltip).
 */
export interface DecbMethodCard extends DecarbMethodCard {
  /** Optional pill shown on the wizard's option tile. */
  badge?: string
  /**
   * Optional plain-language "what does this method mean?" text,
   * expanded by the wizard's per-step tooltip. Distinct from
   * `humanNote` (which is decision-support framing for
   * "when would I pick this") — `tooltip` is the term
   * definition.
   */
  tooltip?: string
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

/**
 * Curated per-method card content. Pulled from the engine's
 * `DECARB_METHOD_CARDS` (the source of truth for the
 * temperature / time / efficiency values) and decorated with the
 * wizard-side badge + tooltip prose. Every entry id matches a
 * `PresetMethod.id` from `engine/models.ts` — no fabricated ids.
 *
 * The 6 entries cover both oven methods and all 4 sous vide
 * variants per the First-Timer Guide.
 */
export const DECB_METHOD_CARDS: readonly DecbMethodCard[] = [
  {
    ...(DECARB_METHOD_CARDS.find(
      c => c.id === 'oven_sealed'
    ) as DecarbMethodCard),
    badge: 'Beginner-friendly',
    tooltip:
      'Decarbing in a sealed foil pouch in the oven — the workhorse method for most home cooks.',
  },
  {
    ...(DECARB_METHOD_CARDS.find(
      c => c.id === 'oven_open'
    ) as DecarbMethodCard),
    badge: 'Fastest',
    tooltip:
      'Decarbing on an open tray — fastest conversion, but you lose the most terpenes and risk CBN formation.',
  },
  {
    ...(DECARB_METHOD_CARDS.find(c => c.id === 'sv_dry') as DecarbMethodCard),
    badge: 'Terpene-rich',
    tooltip:
      'Decarbing in a sealed sous vide bag, then infusing separately. Highest terpene retention, longest run.',
  },
  {
    ...(DECARB_METHOD_CARDS.find(
      c => c.id === 'sv_combined'
    ) as DecarbMethodCard),
    badge: 'Beginner-friendly',
    tooltip:
      'Decarbing and infusing in the same bag — fewer steps, preserves the cannabinoids already in the fat.',
  },
  {
    ...(DECARB_METHOD_CARDS.find(c => c.id === 'sv_fast') as DecarbMethodCard),
    badge: 'Quick',
    tooltip:
      'Hotter, shorter sous vide run — near-maximum conversion in a fraction of the time.',
  },
  {
    ...(DECARB_METHOD_CARDS.find(
      c => c.id === 'sv_lowtemp'
    ) as DecarbMethodCard),
    badge: 'Best match',
    tooltip:
      'Lowest-temperature sous vide run — the best terpene preservation of any method, with a small efficiency cost.',
  },
]

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Id-based lookup. Returns `null` if no card exists for the given
 * id (so the wizard can render an explicit "not found" state rather
 * than crashing on a corrupted persisted selection).
 */
export function findDecbMethodCard(id: string): DecbMethodCard | null {
  return DECB_METHOD_CARDS.find(c => c.id === id) ?? null
}
