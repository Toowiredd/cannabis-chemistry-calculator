/**
 * Strain Library Engine
 * Pure TypeScript — zero UI imports.
 * Provides in-memory strain management with validation.
 */

import type { Strain } from './models'
import { ValidationError } from './errors'

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

export interface StrainInput {
  name: string
  type: 'indica' | 'sativa' | 'hybrid'
  thcaPct: number
  thcPct: number
  cbdaPct?: number
  cbdPct?: number
  notes?: string
}

function validateStrain(
  data: Partial<StrainInput> & {
    name?: string
    type?: string
    thcaPct?: number
    thcPct?: number
  }
): Omit<Strain, 'id'> {
  const name = (data.name ?? '').trim()
  if (!name) throw new ValidationError('Strain name is required')

  if (name.length > 80)
    throw new ValidationError('Strain name too long (max 80 characters)')

  const type = data.type ?? 'hybrid'
  if (!['indica', 'sativa', 'hybrid'].includes(type)) {
    throw new ValidationError(
      'Invalid strain type (must be indica, sativa, or hybrid)'
    )
  }

  const thcaPct = data.thcaPct ?? 0
  if (Number.isNaN(thcaPct) || thcaPct < 0 || thcaPct > 100) {
    throw new ValidationError('THCA percentage must be between 0 and 100')
  }

  const thcPct = data.thcPct ?? 0
  if (Number.isNaN(thcPct) || thcPct < 0 || thcPct > 100) {
    throw new ValidationError('THC percentage must be between 0 and 100')
  }

  if (thcaPct + thcPct > 100) {
    throw new ValidationError('THCA + THC cannot exceed 100%')
  }

  const cbdaPct = data.cbdaPct ?? 0
  if (Number.isNaN(cbdaPct) || cbdaPct < 0 || cbdaPct > 100) {
    throw new ValidationError('CBDA percentage must be between 0 and 100')
  }

  const cbdPct = data.cbdPct ?? 0
  if (Number.isNaN(cbdPct) || cbdPct < 0 || cbdPct > 100) {
    throw new ValidationError('CBD percentage must be between 0 and 100')
  }

  if (cbdaPct + cbdPct > 100) {
    throw new ValidationError('CBDA + CBD cannot exceed 100%')
  }

  const notes = (data.notes ?? '').trim()
  if (notes.length > 500)
    throw new ValidationError('Notes too long (max 500 characters)')

  return {
    name,
    type: type as Strain['type'],
    thcaPct,
    thcPct,
    cbdaPct,
    cbdPct,
    notes,
  }
}

/* ------------------------------------------------------------------ */
/* Library class                                                      */
/* ------------------------------------------------------------------ */

export class StrainLibrary {
  private strains: Strain[] = []

  constructor(initial: Strain[] = []) {
    this.strains = [...initial]
  }

  /** Return all strains ordered by name */
  list(): Strain[] {
    return [...this.strains].sort((a, b) => a.name.localeCompare(b.name))
  }

  /** Get a single strain by id */
  get(id: string): Strain | undefined {
    return this.strains.find(s => s.id === id)
  }

  /** Add a new strain */
  add(data: StrainInput): Strain {
    const validated = validateStrain(data)
    const existing = this.strains.find(
      s => s.name.toLowerCase() === validated.name.toLowerCase()
    )
    if (existing) {
      throw new ValidationError(
        `A strain named "${validated.name}" already exists`
      )
    }
    const strain: Strain = { ...validated, id: generateId() }
    this.strains.push(strain)
    return strain
  }

  /** Update an existing strain by id */
  update(id: string, data: Partial<StrainInput>): Strain {
    const idx = this.strains.findIndex(s => s.id === id)
    if (idx === -1) throw new ValidationError('Strain not found')

    const current = this.strains[idx]
    const merged = { ...current, ...data }
    const validated = validateStrain(merged)

    // Prevent duplicate names (unless it's the same strain)
    const duplicate = this.strains.find(
      (s, i) =>
        i !== idx && s.name.toLowerCase() === validated.name.toLowerCase()
    )
    if (duplicate) {
      throw new ValidationError(
        `A strain named "${validated.name}" already exists`
      )
    }

    const updated: Strain = { ...validated, id }
    this.strains[idx] = updated
    return updated
  }

  /** Remove a strain by id */
  delete(id: string): boolean {
    const idx = this.strains.findIndex(s => s.id === id)
    if (idx === -1) return false
    this.strains.splice(idx, 1)
    return true
  }

  /** Replace entire library (used for loading from disk) */
  load(strains: Strain[]): void {
    this.strains = [...strains]
  }

  /** Export current library as serializable array */
  export(): Strain[] {
    return [...this.strains]
  }

  /** Total count */
  count(): number {
    return this.strains.length
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Singleton instance for global use */
export const globalStrainLibrary = new StrainLibrary()
