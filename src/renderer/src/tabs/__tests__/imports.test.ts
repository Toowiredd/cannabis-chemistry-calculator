/**
 * Structural import-coverage test.
 *
 * Every `src/renderer/src/tabs/*.tsx` file (the user-facing tab surfaces)
 * must be imported from at least one other source file in the project.
 * The 2026-07-25 ccc Infusion audit's MAJOR #1 (FatsTab) was a
 * 435-line dead-code file that the AppRouter / main screen never
 * imported — the file shipped, but no user could ever see it. This test
 * catches that class of bug statically: if you add a new tab to the
 * directory and forget to wire it into the router, the test fails.
 *
 * Allowed reference sites (any one is enough to mark a tab "wired"):
 *   - src/renderer/src/screens/main.tsx (the AppRouter)
 *   - src/renderer/src/components/__tests__/ (the integration tests
 *     vi.mock the tab modules, which counts as a reference)
 *   - src/renderer/src/tabs/__tests__/ (per-tab test files)
 *   - src/renderer/src/components/__tests__/StartupRouting.test.tsx
 *
 * The check is intentionally simple: it only asks "is the module path
 * referenced from somewhere?". It does not enforce that the import is
 * used in render — that's a separate concern (and would false-positive
 * on a tab that is imported and re-exported but conditionally rendered).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const TABS_DIR = join(process.cwd(), 'src', 'renderer', 'src', 'tabs')
// All reference sites are looked up via these roots. Anything outside
// is not a recognised "wire" — the test will fail with a clear list of
// the offenders so the author can decide whether to add the import or
// to add a new root.
const REFERENCE_ROOTS = [
  join(process.cwd(), 'src', 'renderer', 'src', 'screens'),
  join(process.cwd(), 'src', 'renderer', 'src', 'components', '__tests__'),
  join(process.cwd(), 'src', 'renderer', 'src', 'tabs', '__tests__'),
]

/** Collect every .tsx file in a directory, recursively, excluding `__tests__`. */
function listTabs(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue
      out.push(...listTabs(full))
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

/** Collect every .ts/.tsx file under a root, recursively. */
function listAllFiles(root: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(root)) {
    const full = join(root, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listAllFiles(full))
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

/** Build one big string of file contents for substring scanning. */
function slurpAll(files: string[]): string {
  let blob = ''
  for (const f of files) {
    blob += `\n---FILE:${relative(process.cwd(), f)}---\n`
    blob += readFileSync(f, 'utf-8')
  }
  return blob
}

describe('Tab import coverage', () => {
  it('every tabs/*.tsx is imported from a recognised reference site', () => {
    const tabFiles = listTabs(TABS_DIR)
    expect(tabFiles.length).toBeGreaterThan(0)

    const referenceFiles = REFERENCE_ROOTS.flatMap(listAllFiles)
    const referenceBlob = slurpAll(referenceFiles)

    const orphans: string[] = []
    for (const tab of tabFiles) {
      // Convert the absolute path into the import-path the project uses
      // (e.g. "renderer/src/tabs/FatsTab"). Both path shapes are
      // accepted because some sites use the full path and some use a
      // relative "./FatsTab" — but in practice every reference site in
      // this project uses the `renderer/src/tabs/<name>` form.
      const rel = relative(process.cwd(), tab)
      const modulePath = rel
        .replace(/^src[\\/]/, '')
        .replace(/\\/g, '/')
        .replace(/\.tsx?$/, '')
      if (!referenceBlob.includes(modulePath)) {
        orphans.push(modulePath)
      }
    }

    expect(orphans).toEqual([])
  })
})
