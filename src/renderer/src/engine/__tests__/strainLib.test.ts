import { describe, it, expect, beforeEach } from 'vitest'
import { StrainLibrary, globalStrainLibrary } from '../strainLib'
import { ValidationError } from '../errors'

describe('strainLib', () => {
  let lib: StrainLibrary

  beforeEach(() => {
    lib = new StrainLibrary()
  })

  describe('add', () => {
    it('adds a valid strain and returns it with an id', () => {
      const strain = lib.add({
        name: 'Blue Dream',
        type: 'sativa',
        thcaPct: 22.5,
        thcPct: 0.8,
        cbdaPct: 0,
        cbdPct: 0,
        notes: 'Popular daytime strain',
      })

      expect(strain.id).toBeTruthy()
      expect(strain.name).toBe('Blue Dream')
      expect(strain.type).toBe('sativa')
      expect(strain.thcaPct).toBe(22.5)
      expect(strain.thcPct).toBe(0.8)
      expect(lib.count()).toBe(1)
    })

    it('adds a strain with minimal fields', () => {
      const strain = lib.add({
        name: 'Minimal',
        type: 'hybrid',
        thcaPct: 20,
        thcPct: 0,
      })

      expect(strain.name).toBe('Minimal')
      expect(strain.cbdaPct).toBe(0)
      expect(strain.cbdPct).toBe(0)
      expect(strain.notes).toBe('')
    })

    it('throws on empty name', () => {
      expect(() =>
        lib.add({ name: '', type: 'indica', thcaPct: 20, thcPct: 0 })
      ).toThrow(ValidationError)
      expect(() =>
        lib.add({ name: '', type: 'indica', thcaPct: 20, thcPct: 0 })
      ).toThrow('Strain name is required')
    })

    it('throws on duplicate name (case-insensitive)', () => {
      lib.add({ name: 'Blue Dream', type: 'sativa', thcaPct: 20, thcPct: 0 })
      expect(() =>
        lib.add({ name: 'blue dream', type: 'indica', thcaPct: 18, thcPct: 0 })
      ).toThrow('A strain named "blue dream" already exists')
    })

    it('throws on THCA > 100', () => {
      expect(() =>
        lib.add({ name: 'Bad', type: 'hybrid', thcaPct: 110, thcPct: 0 })
      ).toThrow('THCA percentage must be between 0 and 100')
    })

    it('throws on negative THC', () => {
      expect(() =>
        lib.add({ name: 'Bad', type: 'hybrid', thcaPct: 20, thcPct: -1 })
      ).toThrow('THC percentage must be between 0 and 100')
    })

    it('throws on THCA + THC > 100', () => {
      expect(() =>
        lib.add({ name: 'Bad', type: 'hybrid', thcaPct: 60, thcPct: 50 })
      ).toThrow('THCA + THC cannot exceed 100%')
    })

    it('throws on invalid type', () => {
      expect(() =>
        lib.add({ name: 'Bad', type: 'unknown' as any, thcaPct: 20, thcPct: 0 })
      ).toThrow('Invalid strain type')
    })

    it('trims names and notes', () => {
      const strain = lib.add({
        name: '  OG Kush  ',
        type: 'indica',
        thcaPct: 25,
        thcPct: 1.2,
        notes: '  Strong indica  ',
      })
      expect(strain.name).toBe('OG Kush')
      expect(strain.notes).toBe('Strong indica')
    })
  })

  describe('list', () => {
    it('returns strains sorted by name', () => {
      lib.add({ name: 'Zkittlez', type: 'indica', thcaPct: 20, thcPct: 0 })
      lib.add({ name: 'Amnesia Haze', type: 'sativa', thcaPct: 22, thcPct: 0 })
      lib.add({ name: 'Blue Dream', type: 'hybrid', thcaPct: 21, thcPct: 0 })

      const list = lib.list()
      expect(list.map(s => s.name)).toEqual([
        'Amnesia Haze',
        'Blue Dream',
        'Zkittlez',
      ])
    })

    it('returns empty array for empty library', () => {
      expect(lib.list()).toEqual([])
    })
  })

  describe('get', () => {
    it('returns strain by id', () => {
      const added = lib.add({
        name: 'Blue Dream',
        type: 'sativa',
        thcaPct: 20,
        thcPct: 0,
      })
      const found = lib.get(added.id)
      expect(found?.name).toBe('Blue Dream')
    })

    it('returns undefined for unknown id', () => {
      expect(lib.get('nonexistent')).toBeUndefined()
    })
  })

  describe('update', () => {
    it('updates strain fields', () => {
      const added = lib.add({
        name: 'Blue Dream',
        type: 'sativa',
        thcaPct: 20,
        thcPct: 0,
      })
      const updated = lib.update(added.id, { thcaPct: 24, notes: 'Updated' })
      expect(updated.thcaPct).toBe(24)
      expect(updated.notes).toBe('Updated')
      expect(updated.name).toBe('Blue Dream')
    })

    it('throws on unknown id', () => {
      expect(() => lib.update('nope', { thcaPct: 20 })).toThrow(
        'Strain not found'
      )
    })

    it('prevents duplicate name on update', () => {
      const a = lib.add({
        name: 'Strain A',
        type: 'indica',
        thcaPct: 20,
        thcPct: 0,
      })
      lib.add({ name: 'Strain B', type: 'sativa', thcaPct: 22, thcPct: 0 })
      expect(() => lib.update(a.id, { name: 'Strain B' })).toThrow(
        'already exists'
      )
    })

    it('allows same name on self-update', () => {
      const a = lib.add({
        name: 'Strain A',
        type: 'indica',
        thcaPct: 20,
        thcPct: 0,
      })
      const updated = lib.update(a.id, { name: 'Strain A', thcaPct: 25 })
      expect(updated.thcaPct).toBe(25)
    })
  })

  describe('delete', () => {
    it('removes strain and returns true', () => {
      const added = lib.add({
        name: 'Blue Dream',
        type: 'sativa',
        thcaPct: 20,
        thcPct: 0,
      })
      expect(lib.delete(added.id)).toBe(true)
      expect(lib.count()).toBe(0)
    })

    it('returns false for unknown id', () => {
      expect(lib.delete('nope')).toBe(false)
    })
  })

  describe('load / export', () => {
    it('round-trips strains through load/export', () => {
      const a = lib.add({
        name: 'Blue Dream',
        type: 'sativa',
        thcaPct: 20,
        thcPct: 0,
      })
      const b = lib.add({
        name: 'OG Kush',
        type: 'indica',
        thcaPct: 25,
        thcPct: 1,
      })
      const exported = lib.export()

      const lib2 = new StrainLibrary()
      lib2.load(exported)

      expect(lib2.count()).toBe(2)
      expect(lib2.get(a.id)?.name).toBe('Blue Dream')
      expect(lib2.get(b.id)?.name).toBe('OG Kush')
    })
  })

  describe('globalStrainLibrary', () => {
    it('is an empty library by default', () => {
      expect(globalStrainLibrary.count()).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('handles zero percentages', () => {
      const strain = lib.add({
        name: 'Zero',
        type: 'hybrid',
        thcaPct: 0,
        thcPct: 0,
      })
      expect(strain.thcaPct).toBe(0)
      expect(strain.thcPct).toBe(0)
    })

    it('handles large name (exactly 80 chars)', () => {
      const name = 'A'.repeat(80)
      const strain = lib.add({ name, type: 'hybrid', thcaPct: 20, thcPct: 0 })
      expect(strain.name).toBe(name)
    })

    it('throws on name too long', () => {
      expect(() =>
        lib.add({
          name: 'A'.repeat(81),
          type: 'hybrid',
          thcaPct: 20,
          thcPct: 0,
        })
      ).toThrow('Strain name too long')
    })

    it('throws on notes too long', () => {
      expect(() =>
        lib.add({
          name: 'Ok',
          type: 'hybrid',
          thcaPct: 20,
          thcPct: 0,
          notes: 'N'.repeat(501),
        })
      ).toThrow('Notes too long')
    })
  })
})
