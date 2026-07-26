/**
 * Equipment options — extracted from FirstTimerGuide.tsx (per
 * docs/wizard-architecture-2026-07-26.md §8.6, Week 6 deliverable).
 *
 * The First-Timer Guide tab is being deprecated; the equipment list
 * (oven, foil, glass dish, stove, slow cooker, plus the four
 * sous-vide items added in the 2026-07-25 FirstTimerGuide equipment
 * gap fix — circulator, vacuum sealer, mason jar, probe thermometer)
 * survives as a shared library that the Wizard's per-step
 * explanations consume.
 *
 * Pure TypeScript — zero UI / React / Electron imports. The 13
 * entries match the original `EQUIPMENT_OPTIONS` array in
 * FirstTimerGuide.tsx 1-for-1, with `strainer`, `bake_vehicle`, and
 * `kitchen_scale` kept (the brief listed 10 but the source has 13 —
 * see the data test for the exhaustive count assertion).
 *
 * Importers can read `EQUIPMENT_OPTIONS` directly, or call
 * `findEquipmentOption(id)` for an id-keyed lookup.
 */
import {
  Beaker,
  Carrot,
  Cookie,
  Flame,
  FlaskConical,
  Layers,
  Package,
  Salad,
  Scale,
  Thermometer,
  type LucideIcon,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface EquipmentOption {
  /** Stable id (matches the value written to wizard selections). */
  id: string
  /** 1-3 word label shown on the wizard's option tile. */
  label: string
  /**
   * 1-sentence friendly substitution for when the user does not own
   * the item. The First-Timer Guide renders this under the label as
   * "no judgement — pick what you have".
   */
  subtitle: string
  /** Lucide icon shown on the wizard's option tile. */
  Icon: LucideIcon
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

/**
 * Curated equipment list (extracted verbatim from
 * FirstTimerGuide.tsx, 2026-07-25 equipment gap fix inlines).
 *
 * The 13 entries cover the union of an oven-centric workflow (oven,
 * foil, glass dish, stove, slow cooker) and a sous-vide workflow
 * (circulator, vacuum sealer, mason jar, probe thermometer), plus
 * the three shared items (strainer, bake vehicle, kitchen scale).
 * The 10 entries the brief enumerated are the most-load-bearing —
 * the 3 extra entries (strainer / bake_vehicle / kitchen_scale)
 * are kept because FirstTimerGuide rendered them and a deprecation
 * pass that drops them silently would regress the wizard's
 * equipment-tile count.
 */
export const EQUIPMENT_OPTIONS: readonly EquipmentOption[] = [
  {
    id: 'flower',
    label: 'Cannabis flower',
    subtitle: 'Any amount works. Quality matters more than quantity.',
    Icon: Salad,
  },
  {
    id: 'glass_dish',
    label: 'Glass baking dish',
    subtitle: 'A ceramic casserole dish or a pie plate works fine.',
    Icon: Layers,
  },
  {
    id: 'foil',
    label: 'Aluminum foil',
    subtitle:
      'An oven-safe lid or a tight layer of parchment plus foil will do.',
    Icon: Layers,
  },
  {
    id: 'fat',
    label: 'Butter or coconut oil',
    subtitle: 'Ghee or any oil with some fat content works. Avoid watery oils.',
    Icon: Carrot,
  },
  {
    id: 'oven',
    label: 'An oven',
    subtitle: 'A toaster oven with a temperature dial works too.',
    Icon: Flame,
  },
  {
    id: 'heat_source',
    label: 'A stove or slow cooker',
    subtitle:
      'A double boiler or even a very low oven holds the right temperature.',
    Icon: Flame,
  },
  {
    id: 'sv_circulator',
    label: 'A sous vide circulator',
    subtitle:
      'An immersion circulator that clips to a pot — required for any sous vide decarb method.',
    Icon: FlaskConical,
  },
  {
    id: 'vacuum_sealer',
    label: 'A vacuum sealer',
    subtitle:
      'For the sealed sous vide methods. A zip-top bag works in a pinch if you displace the air well.',
    Icon: Package,
  },
  {
    id: 'mason_jar',
    label: 'Mason jars (for sous vide)',
    subtitle:
      'Wide-mouth pint or quart jars hold the vacuum-sealed bag upright in the water bath.',
    Icon: Beaker,
  },
  {
    id: 'probe_thermometer',
    label: 'A probe thermometer',
    subtitle:
      'Verifies bath and oven temperature. Sous vide holds within 1°C; ovens drift 10–25°C.',
    Icon: Thermometer,
  },
  {
    id: 'strainer',
    label: 'A strainer or cheesecloth',
    subtitle:
      'A clean kitchen towel, fine-mesh sieve, or nut-milk bag will do.',
    Icon: Beaker,
  },
  {
    id: 'bake_vehicle',
    label: 'Something to bake with',
    subtitle:
      'Brownie mix, cookie dough, cake mix, gummies, whatever you like.',
    Icon: Cookie,
  },
  {
    id: 'kitchen_scale',
    label: 'A digital kitchen scale',
    subtitle:
      'A postal scale or even ½-gram resolution jewellery scales work in a pinch.',
    Icon: Scale,
  },
]

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Id-based lookup. Returns `null` if no equipment option exists for
 * the given id (so the wizard can render an explicit "not found"
 * state rather than crashing on a corrupted persisted selection).
 */
export function findEquipmentOption(id: string): EquipmentOption | null {
  return EQUIPMENT_OPTIONS.find(o => o.id === id) ?? null
}
