/**
 * Tests for the wizard presets module.
 *
 * Coverage:
 *  - WIZARD_RECIPES derived from EDIBLE_FORMATS (count + ids + field shape)
 *  - DECARB_METHOD_CARDS derived from DECARB_METHODS (count + ids + temps/
 *    times/efficiency match source)
 *  - FAT_CARDS derived from INFUSION_FATS (count + ids + extractionEff match)
 *  - Each preset has a curated entry (no missing curated prose)
 *  - suggestionsForRecipe: known id → curated defaults, unknown id → null,
 *    defensive on edge inputs (empty string, whitespace)
 *  - Lifted constants match their DECARB_METHODS / INFUSION_FATS source
 *  - No emoji / non-ASCII symbols in any prose field (matches engine
 *    constraint used in models.test.ts)
 */
import { describe, expect, it } from 'vitest'
import { DECARB_METHODS, EDIBLE_FORMATS, INFUSION_FATS } from '../models'
import {
  DECARB_METHOD_CARDS,
  FAT_CARDS,
  FIRST_TIMER_DECARB_EFF,
  FIRST_TIMER_DEFAULT_GRAMS,
  FIRST_TIMER_DEFAULT_SERVINGS,
  FIRST_TIMER_DEFAULT_THCA_PCT,
  FIRST_TIMER_FAT_EFF,
  type WizardRecipeSuggestion,
  WIZARD_RECIPES,
  getDecarbMethodCard,
  getFatCard,
  getWizardRecipe,
  suggestionsForRecipe,
} from '../wizardPresets'

// Same emoji regex used by models.test.ts. Engine constraint: no emojis
// or Unicode symbols in any preset / prose field.
const EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu

/**
 * Helper: assert-non-null narrows the type without using the `!` operator
 * (which biome flags at warn level).
 */
function expectDefined<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${label} to be defined`)
  }
  return value
}

describe('WIZARD_RECIPES', () => {
  it('has exactly one entry per EDIBLE_FORMATS entry', () => {
    expect(WIZARD_RECIPES).toHaveLength(EDIBLE_FORMATS.length)
  })

  it('recipe ids exactly match EDIBLE_FORMATS ids in order', () => {
    expect(WIZARD_RECIPES.map(r => r.id)).toEqual(EDIBLE_FORMATS.map(f => f.id))
  })

  it('suggestedServings exactly matches EDIBLE_FORMATS.suggestedServings', () => {
    for (let i = 0; i < WIZARD_RECIPES.length; i++) {
      expect(WIZARD_RECIPES[i].suggestedServings).toBe(
        EDIBLE_FORMATS[i].suggestedServings
      )
    }
  })

  it('every entry has a non-empty label and humanRecipe', () => {
    for (const r of WIZARD_RECIPES) {
      expect(typeof r.label).toBe('string')
      expect(r.label.length).toBeGreaterThan(0)
      expect(typeof r.humanRecipe).toBe('string')
      expect(r.humanRecipe.length).toBeGreaterThan(0)
    }
  })

  it('humanRecipe contains no emoji or Unicode symbols', () => {
    for (const r of WIZARD_RECIPES) {
      expect(r.humanRecipe).not.toMatch(EMOJI_REGEX)
      expect(r.label).not.toMatch(EMOJI_REGEX)
    }
  })

  it('every EDIBLE_FORMATS id has curated humanRecipe (no fallback used)', () => {
    // Fallback starts with "Recipe sketch not yet provided" — verify no
    // WIZARD_RECIPES entry uses it.
    for (const r of WIZARD_RECIPES) {
      expect(r.humanRecipe).not.toMatch(/^Recipe sketch not yet provided/)
    }
  })

  it('shortLabel strips the parenthetical from the EdibleFormat name', () => {
    // EDIBLE_FORMATS includes "Brownie (9×13 pan, 12-24 servings)" — its
    // label should be the prefix before " (".
    const brownie9x13 = WIZARD_RECIPES.find(r => r.id === 'brownie_9x13')
    expect(brownie9x13?.label).toBe('Brownie')
    expect(brownie9x13?.label).not.toMatch(/\(/)
  })

  it('custom recipe label survives the strip (no parenthetical in source)', () => {
    const custom = WIZARD_RECIPES.find(r => r.id === 'custom')
    expect(custom?.label).toBe('Custom')
  })
})

describe('DECARB_METHOD_CARDS', () => {
  it('has exactly one entry per DECARB_METHODS entry', () => {
    expect(DECARB_METHOD_CARDS).toHaveLength(DECARB_METHODS.length)
  })

  it('card ids exactly match DECARB_METHODS ids in order', () => {
    expect(DECARB_METHOD_CARDS.map(c => c.id)).toEqual(
      DECARB_METHODS.map(m => m.id)
    )
  })

  it('temperature / time / efficiency / labels are copied from source exactly', () => {
    for (let i = 0; i < DECARB_METHOD_CARDS.length; i++) {
      const card = DECARB_METHOD_CARDS[i]
      const src = DECARB_METHODS[i]
      expect(card.tempC).toBe(src.tempC)
      expect(card.timeMin).toBe(src.timeMin)
      expect(card.timeMax).toBe(src.timeMax)
      expect(card.terpeneLabel).toBe(src.terpeneLabel)
      expect(card.cbnLabel).toBe(src.cbnLabel)
      expect(card.efficiency).toEqual(src.efficiency)
    }
  })

  it('humanNote is non-empty and contains no emoji', () => {
    for (const c of DECARB_METHOD_CARDS) {
      expect(typeof c.humanNote).toBe('string')
      expect(c.humanNote.length).toBeGreaterThan(0)
      expect(c.humanNote).not.toMatch(EMOJI_REGEX)
      expect(c.label).not.toMatch(EMOJI_REGEX)
    }
  })

  it('every DECARB_METHODS id has curated humanNote (no fallback used)', () => {
    for (const c of DECARB_METHOD_CARDS) {
      expect(c.humanNote).not.toMatch(/^Decision guidance not yet provided/)
    }
  })

  it('temperatures stay within the engine floor/ceiling (73C to 116C)', () => {
    for (const c of DECARB_METHOD_CARDS) {
      expect(c.tempC).toBeGreaterThanOrEqual(73)
      expect(c.tempC).toBeLessThanOrEqual(116)
    }
  })

  it('time ranges are valid (timeMin <= timeMax, both positive)', () => {
    for (const c of DECARB_METHOD_CARDS) {
      expect(c.timeMin).toBeGreaterThan(0)
      expect(c.timeMax).toBeGreaterThan(0)
      expect(c.timeMax).toBeGreaterThanOrEqual(c.timeMin)
    }
  })
})

describe('FAT_CARDS', () => {
  it('has exactly one entry per INFUSION_FATS entry', () => {
    expect(FAT_CARDS).toHaveLength(INFUSION_FATS.length)
  })

  it('card ids exactly match INFUSION_FATS ids in order', () => {
    expect(FAT_CARDS.map(c => c.id)).toEqual(INFUSION_FATS.map(f => f.id))
  })

  it('extractionEff exactly matches INFUSION_FATS.extractionEff', () => {
    for (let i = 0; i < FAT_CARDS.length; i++) {
      expect(FAT_CARDS[i].extractionEff).toBe(INFUSION_FATS[i].extractionEff)
    }
  })

  it('humanNote is non-empty and contains no emoji', () => {
    for (const c of FAT_CARDS) {
      expect(typeof c.humanNote).toBe('string')
      expect(c.humanNote.length).toBeGreaterThan(0)
      expect(c.humanNote).not.toMatch(EMOJI_REGEX)
      expect(c.label).not.toMatch(EMOJI_REGEX)
    }
  })

  it('every INFUSION_FATS id has curated humanNote (no fallback used)', () => {
    for (const c of FAT_CARDS) {
      expect(c.humanNote).not.toMatch(/^Decision guidance not yet provided/)
    }
  })

  it('non-custom extraction efficiencies are within [0, 1]', () => {
    for (const c of FAT_CARDS) {
      if (c.id === 'custom') continue
      expect(c.extractionEff).toBeGreaterThanOrEqual(0)
      expect(c.extractionEff).toBeLessThanOrEqual(1)
    }
  })
})

describe('suggestionsForRecipe', () => {
  it('returns curated defaults for brownie_9x13', () => {
    const s = suggestionsForRecipe('brownie_9x13')
    expect(s).not.toBeNull()
    const def = expectDefined(s, 'brownie_9x13 suggestion')
    expect(def.defaults).toEqual({ grams: 3.5, thcaPct: 20, servings: 18 })
    expect(def.notes.length).toBeGreaterThan(0)
  })

  it('returns curated defaults for gummy_80', () => {
    const s = suggestionsForRecipe('gummy_80')
    const def = expectDefined(s, 'gummy_80 suggestion')
    expect(def.defaults).toEqual({ grams: 1.5, thcaPct: 18, servings: 80 })
  })

  it('returns curated defaults for capsule_00', () => {
    const s = suggestionsForRecipe('capsule_00')
    const def = expectDefined(s, 'capsule_00 suggestion')
    expect(def.defaults).toEqual({ grams: 3.5, thcaPct: 22, servings: 24 })
  })

  it('returns curated defaults for custom', () => {
    const s = suggestionsForRecipe('custom')
    const def = expectDefined(s, 'custom suggestion')
    expect(def.defaults).toEqual({
      grams: FIRST_TIMER_DEFAULT_GRAMS,
      thcaPct: FIRST_TIMER_DEFAULT_THCA_PCT,
      servings: FIRST_TIMER_DEFAULT_SERVINGS,
    })
  })

  it('returns null for an unknown recipe id', () => {
    expect(suggestionsForRecipe('does_not_exist')).toBeNull()
    expect(suggestionsForRecipe('')).toBeNull()
    expect(suggestionsForRecipe('   ')).toBeNull()
  })

  it('all defaults satisfy the engine validity rules (grams>0, 0<thca<=100, servings>0)', () => {
    for (const fmt of EDIBLE_FORMATS) {
      const s = suggestionsForRecipe(fmt.id)
      const def = expectDefined(s, `${fmt.id} suggestion`)
      expect(def.defaults.grams).toBeGreaterThan(0)
      expect(def.defaults.grams).toBeLessThan(1e6) // overflow guard
      expect(def.defaults.thcaPct).toBeGreaterThan(0)
      expect(def.defaults.thcaPct).toBeLessThanOrEqual(100)
      expect(def.defaults.servings).toBeGreaterThan(0)
      expect(Number.isFinite(def.defaults.grams)).toBe(true)
      expect(Number.isFinite(def.defaults.thcaPct)).toBe(true)
      expect(Number.isFinite(def.defaults.servings)).toBe(true)
    }
  })

  it('every suggestion has at least one note (no empty arrays)', () => {
    for (const fmt of EDIBLE_FORMATS) {
      const s = suggestionsForRecipe(fmt.id)
      const def = expectDefined(s, `${fmt.id} suggestion`)
      expect(Array.isArray(def.notes)).toBe(true)
      expect(def.notes.length).toBeGreaterThan(0)
      for (const note of def.notes) {
        expect(typeof note).toBe('string')
        expect(note.length).toBeGreaterThan(0)
        expect(note).not.toMatch(EMOJI_REGEX)
      }
    }
  })

  it('returned defaults object is a fresh copy (mutating it does not leak)', () => {
    const a = suggestionsForRecipe('brownie_9x13')
    expect(a).not.toBeNull()
    const aDef = expectDefined(a, 'first a') as WizardRecipeSuggestion
    aDef.defaults.grams = 999
    const b = suggestionsForRecipe('brownie_9x13')
    const bDef = expectDefined(b, 'first b')
    expect(bDef.defaults.grams).toBe(3.5)
  })
})

describe('lookup helpers', () => {
  it('getWizardRecipe returns the matching card or null', () => {
    expect(getWizardRecipe('brownie_9x13')?.id).toBe('brownie_9x13')
    expect(getWizardRecipe('nope')).toBeNull()
  })

  it('getDecarbMethodCard returns the matching card or null', () => {
    expect(getDecarbMethodCard('oven_sealed')?.id).toBe('oven_sealed')
    expect(getDecarbMethodCard('nope')).toBeNull()
  })

  it('getFatCard returns the matching card or null', () => {
    expect(getFatCard('coconut')?.id).toBe('coconut')
    expect(getFatCard('nope')).toBeNull()
  })
})

describe('FIRST_TIMER lifted constants', () => {
  it('FIRST_TIMER_DECARB_EFF matches oven_sealed.efficiency.expected', () => {
    const ovenSealed = DECARB_METHODS.find(m => m.id === 'oven_sealed')
    const src = expectDefined(ovenSealed, 'oven_sealed preset')
    expect(FIRST_TIMER_DECARB_EFF).toBe(src.efficiency.expected)
  })

  it('FIRST_TIMER_FAT_EFF matches coconut.extractionEff', () => {
    const coconut = INFUSION_FATS.find(f => f.id === 'coconut')
    const src = expectDefined(coconut, 'coconut preset')
    expect(FIRST_TIMER_FAT_EFF).toBe(src.extractionEff)
  })

  it('FIRST_TIMER_DEFAULT_SERVINGS sits between brownie_8x8 and brownie_9x13', () => {
    const eight = EDIBLE_FORMATS.find(f => f.id === 'brownie_8x8')
    const thirteen = EDIBLE_FORMATS.find(f => f.id === 'brownie_9x13')
    const eightSrc = expectDefined(eight, 'brownie_8x8')
    const thirteenSrc = expectDefined(thirteen, 'brownie_9x13')
    expect(FIRST_TIMER_DEFAULT_SERVINGS).toBeGreaterThan(
      eightSrc.suggestedServings
    )
    expect(FIRST_TIMER_DEFAULT_SERVINGS).toBeLessThan(
      thirteenSrc.suggestedServings
    )
  })

  it('FIRST_TIMER_DEFAULT_GRAMS is a sensible eighth-of-an-ounce starter', () => {
    expect(FIRST_TIMER_DEFAULT_GRAMS).toBeGreaterThan(0)
    expect(FIRST_TIMER_DEFAULT_GRAMS).toBeLessThan(100) // overflow guard
  })

  it('FIRST_TIMER_DEFAULT_THCA_PCT is a sensible mid-shelf default', () => {
    expect(FIRST_TIMER_DEFAULT_THCA_PCT).toBeGreaterThan(0)
    expect(FIRST_TIMER_DEFAULT_THCA_PCT).toBeLessThanOrEqual(100)
  })
})
