import { describe, expect, it } from 'vitest'
import {
  needlePosition,
  zoneColor,
  tradeOffSentence,
  zoneTooltip,
  needleGlow,
  isOutOfRange,
  MIN_TEMP,
  MAX_TEMP,
  ZONE_RATIOS,
} from '../heatmapGeometry'
import { DECARB_METHODS } from 'renderer/src/engine/models'

describe('needlePosition', () => {
  it('73C → 0%', () => {
    expect(needlePosition(73)).toBe(0)
  })

  it('130C → 100%', () => {
    expect(needlePosition(130)).toBe(100)
  })

  it('101.5C → exactly 50%', () => {
    expect(needlePosition(101.5)).toBe(50)
  })

  it('clamps below 73C to 0%', () => {
    expect(needlePosition(50)).toBe(0)
  })

  it('clamps above 130C to 100%', () => {
    expect(needlePosition(150)).toBe(100)
  })

  it('sv_dry preset (95C) → ~37.7%', () => {
    const svDry = DECARB_METHODS.find(m => m.id === 'sv_dry')!
    expect(needlePosition(svDry.tempC)).toBeCloseTo(((95 - 73) / 57) * 100, 1)
  })

  it('oven_sealed preset (113C) → ~70.2%', () => {
    const ovenSealed = DECARB_METHODS.find(m => m.id === 'oven_sealed')!
    expect(needlePosition(ovenSealed.tempC)).toBeCloseTo(
      ((113 - 73) / 57) * 100,
      1
    )
  })
})

describe('zoneColor', () => {
  it('80C → green', () => {
    expect(zoneColor(80)).toBe('green')
  })

  it('exactly 90C → yellow (boundary inclusive on yellow side)', () => {
    expect(zoneColor(90)).toBe('yellow')
  })

  it('105C → yellow', () => {
    expect(zoneColor(105)).toBe('yellow')
  })

  it('exactly 116C → red (boundary inclusive on red side)', () => {
    expect(zoneColor(116)).toBe('red')
  })

  it('120C → red', () => {
    expect(zoneColor(120)).toBe('red')
  })
})

describe('tradeOffSentence', () => {
  it('includes preset name and temperature', () => {
    const svDry = DECARB_METHODS.find(m => m.id === 'sv_dry')!
    const sentence = tradeOffSentence(95, svDry, false)
    expect(sentence).toContain('Sous Vide -- Dry')
    expect(sentence).toContain('95°C')
  })

  it('shows override prefix when overridden', () => {
    const oven = DECARB_METHODS.find(m => m.id === 'oven_sealed')!
    const sentence = tradeOffSentence(120, oven, true)
    expect(sentence).toContain('Custom override')
  })

  it('includes efficiency range', () => {
    const svLow = DECARB_METHODS.find(m => m.id === 'sv_lowtemp')!
    const sentence = tradeOffSentence(73, svLow, false)
    expect(sentence).toContain('60–75%')
  })
})

describe('zoneTooltip', () => {
  it('green zone tooltip mentions terpenes', () => {
    expect(zoneTooltip('green')).toContain('Terpene')
  })

  it('red zone tooltip mentions CBN', () => {
    expect(zoneTooltip('red')).toContain('CBN')
  })
})

describe('needleGlow', () => {
  it('green zone has green glow', () => {
    expect(needleGlow('green')).toContain('16,185,129')
  })

  it('red zone has red glow', () => {
    expect(needleGlow('red')).toContain('239,68,68')
  })
})

describe('tradeOffSentence zone-specific text', () => {
  const svLow = DECARB_METHODS.find(m => m.id === 'sv_lowtemp')!
  const ovenSealed = DECARB_METHODS.find(m => m.id === 'oven_sealed')!
  const ovenOpen = DECARB_METHODS.find(m => m.id === 'oven_open')!

  it('green zone mentions maximum terpene retention', () => {
    const sentence = tradeOffSentence(73, svLow, false)
    expect(sentence).toContain('Maximum terpene retention')
  })

  it('yellow zone mentions standard decarb balance', () => {
    const sentence = tradeOffSentence(95, svLow, false)
    expect(sentence).toContain('Standard decarb balance')
  })

  it('red zone mentions CBN degradation risk', () => {
    const sentence = tradeOffSentence(120, ovenOpen, false)
    expect(sentence).toContain('CBN degradation risk')
  })

  it('produces distinct text for each zone', () => {
    const greenSentence = tradeOffSentence(80, svLow, false)
    const yellowSentence = tradeOffSentence(105, ovenSealed, false)
    const redSentence = tradeOffSentence(125, ovenOpen, false)
    expect(greenSentence).not.toBe(yellowSentence)
    expect(yellowSentence).not.toBe(redSentence)
    expect(greenSentence).not.toBe(redSentence)
  })
})

describe('isOutOfRange', () => {
  it('returns true below 73°C', () => {
    expect(isOutOfRange(50)).toBe(true)
  })

  it('returns true above 130°C', () => {
    expect(isOutOfRange(150)).toBe(true)
  })

  it('returns false at 73°C boundary', () => {
    expect(isOutOfRange(73)).toBe(false)
  })

  it('returns false at 130°C boundary', () => {
    expect(isOutOfRange(130)).toBe(false)
  })

  it('returns false inside range', () => {
    expect(isOutOfRange(100)).toBe(false)
  })
})

describe('zoneTooltip distinctness', () => {
  it('green tooltip is distinct from yellow and red', () => {
    const green = zoneTooltip('green')
    const yellow = zoneTooltip('yellow')
    const red = zoneTooltip('red')
    expect(green).not.toBe(yellow)
    expect(green).not.toBe(red)
    expect(yellow).not.toBe(red)
  })

  it('green tooltip mentions terpenes and retention', () => {
    expect(zoneTooltip('green')).toContain('Terpene')
    expect(zoneTooltip('green')).toContain('retention')
  })

  it('yellow tooltip mentions standard decarb balance', () => {
    expect(zoneTooltip('yellow')).toContain('Standard decarb')
  })

  it('red tooltip mentions CBN degradation', () => {
    expect(zoneTooltip('red')).toContain('CBN')
  })
})

describe('ZONE_RATIOS', () => {
  it('sum to 57 (the total range)', () => {
    expect(ZONE_RATIOS.green + ZONE_RATIOS.yellow + ZONE_RATIOS.red).toBe(57)
  })
})
