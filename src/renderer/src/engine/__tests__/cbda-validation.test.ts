/**
 * Tests for CBDA/CBD Zod validation schemas.
 * Run with: pnpm exec vitest run src/renderer/src/engine/__tests__/cbda-validation.test.ts
 */
import { describe, it, expect } from 'vitest'
import {
  validateCbdaInput,
  type CbdaInput,
  type ValidationResult,
} from '../validation'

function expectValid<T>(result: ValidationResult<T>) {
  expect(result.success).toBe(true)
  expect(result.errors).toBeUndefined()
}

function expectInvalid<T>(result: ValidationResult<T>) {
  expect(result.success).toBe(false)
  expect(result.errors).toBeDefined()
  expect(result.errors?.length).toBeGreaterThan(0)
}

describe('validateCbdaInput', () => {
  it('accepts valid CBDA input', () => {
    const input: CbdaInput = { weight: 10, cbdaPct: 15, cbdPct: 0 }
    const result = validateCbdaInput(input)
    expectValid(result)
  })

  it('accepts valid input with existing CBD', () => {
    const input: CbdaInput = { weight: 10, cbdaPct: 10, cbdPct: 5 }
    const result = validateCbdaInput(input)
    expectValid(result)
  })

  it('rejects negative weight', () => {
    const input: CbdaInput = { weight: -5, cbdaPct: 15, cbdPct: 0 }
    const result = validateCbdaInput(input)
    expectInvalid(result)
  })

  it('rejects zero weight', () => {
    const input: CbdaInput = { weight: 0, cbdaPct: 15, cbdPct: 0 }
    const result = validateCbdaInput(input)
    expectInvalid(result)
  })

  it('rejects CBDA > 100%', () => {
    const input: CbdaInput = { weight: 10, cbdaPct: 110, cbdPct: 0 }
    const result = validateCbdaInput(input)
    expectInvalid(result)
  })

  it('rejects CBD > 100%', () => {
    const input: CbdaInput = { weight: 10, cbdaPct: 10, cbdPct: 105 }
    const result = validateCbdaInput(input)
    expectInvalid(result)
  })

  it('rejects CBDA + CBD > 100% (VAL-CBDA-003)', () => {
    const input: CbdaInput = { weight: 10, cbdaPct: 60, cbdPct: 50 }
    const result = validateCbdaInput(input)
    expectInvalid(result)
  })

  it('rejects negative CBDA (VAL-CBDA-003)', () => {
    const input: CbdaInput = { weight: 10, cbdaPct: -10, cbdPct: 0 }
    const result = validateCbdaInput(input)
    expectInvalid(result)
  })

  it('rejects negative CBD', () => {
    const input: CbdaInput = { weight: 10, cbdaPct: 10, cbdPct: -5 }
    const result = validateCbdaInput(input)
    expectInvalid(result)
  })

  it('warns when CBDA + CBD > 40% (VAL-CBDA-003)', () => {
    const input: CbdaInput = { weight: 10, cbdaPct: 25, cbdPct: 20 }
    const result = validateCbdaInput(input)
    expectValid(result)
    expect(result.warnings).toBeDefined()
    expect(result.warnings?.length).toBeGreaterThan(0)
    expect(result.warnings?.some(w => w.includes('40'))).toBe(true)
  })

  it('does not warn when CBDA + CBD <= 40%', () => {
    const input: CbdaInput = { weight: 10, cbdaPct: 20, cbdPct: 10 }
    const result = validateCbdaInput(input)
    expectValid(result)
    const hasWarning = (result.warnings ?? []).some(w => w.includes('40'))
    expect(hasWarning).toBe(false)
  })

  it('accepts zero CBDA and zero CBD', () => {
    const input: CbdaInput = { weight: 10, cbdaPct: 0, cbdPct: 0 }
    const result = validateCbdaInput(input)
    expectValid(result)
  })
})
