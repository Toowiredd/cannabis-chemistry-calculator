// @vitest-environment node
/**
 * Regression test for the 2026-07-25 ccc-uiux-reviewer report MINOR m2,
 * follow-up sweep.
 *
 * Background: design-system fixed `globals.css` so the canonical cyan
 * focus ring (rgba(34, 211, 238, 0.45)) is applied to every focusable
 * element via a single `:focus-visible` rule. Many button sites in the
 * tab and component layers also carried a Tailwind utility
 * `focus-visible:ring-[var(--accent)]` (teal), which out-specified the
 * global rule and produced two focus colors in the same dialog.
 *
 * The follow-up removed those teal utility classes from individual files
 * so the global rule is the single source of truth for focus color.
 * This test is the regression guard: if any tab or component file
 * reintroduces `ring-[var(--accent)]` (in any of its `focus` /
 * `focus-visible` / standalone forms), this test fails.
 *
 * Scope: every `*.tsx` file under `src/renderer/src/tabs/` and
 * `src/renderer/src/components/`. The single match that legitimately
 * remains is the comment in `globals.css.test.ts` line 7, which is
 * documentation about the original audit — it is not a Tailwind class
 * string. That file is excluded from the scan.
 *
 * Like the sibling `globals.css.test.ts`, this test runs in the `node`
 * environment (not `jsdom`) because the suite-level jsdom environment
 * externalizes `node:fs` / `node:path` for any file that imports them.
 * This test only reads text files; it does not need DOM.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Resolve the audit root relative to this test file's location, not
// process.cwd(). Using import.meta.url is robust to invocation changes
// (e.g. running a single test file by absolute path).
const here = dirname(fileURLToPath(import.meta.url))
// This test lives at src/renderer/src/components/__tests__/. Two `..`
// hops put us at src/renderer/src/, where the tabs/ and components/
// subtrees we scan live.
const SRC_ROOT = resolve(here, '..', '..')

/** Directories scanned for the offending class string. */
const SCAN_DIRS = ['tabs', 'components'] as const

/**
 * Files we intentionally do not scan.
 *
 * - `globals.css.test.ts` matches the regex on line 7 inside a comment
 *   that documents the original audit. The comment is not a class
 *   string; leaving it out of the scan keeps this test honest about
 *   "no real class string reintroduced".
 */
const SKIP_FILES: ReadonlySet<string> = new Set([
  // The path below is matched by basename; full paths are derived
  // relative to SRC_ROOT.
  'globals.css.test.ts',
])

/** Recursively collect every `*.tsx` file under `dir`. */
function collectTsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out.push(...collectTsxFiles(full))
    } else if (stat.isFile() && entry.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

/** Return the basename of `path`, accepting either `\\` or `/` separators. */
function basename(path: string): string | undefined {
  const i = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return i === -1 ? path : path.slice(i + 1)
}

/**
 * Pattern intentionally matches the exact class string we removed
 * during the m2 follow-up: `ring-[var(--accent)]` preceded by any of
 * the standard Tailwind focus-ring prefixes (`focus-visible:ring-2`,
 * `focus:ring-2`, etc.) or used standalone. The leading class
 * separator is whitespace.
 *
 * This is broader than just the `focus-visible:ring-[var(--accent)]`
 * literal because the audit's pattern list also covered
 * `focus:ring-[var(--accent)]` and standalone `ring-[var(--accent)]`.
 */
const FORBIDDEN = /(?<![A-Za-z0-9_-])ring-\[var\(--accent\)\]/

describe('focus-ring follow-up (m2 audit regression)', () => {
  const files = SCAN_DIRS.flatMap(sub =>
    collectTsxFiles(join(SRC_ROOT, sub))
  ).filter(f => {
    const name = basename(f)
    return name !== undefined && !SKIP_FILES.has(name)
  })

  it('scans the expected number of files (sanity guard)', () => {
    // If this fails, the directory layout changed; update SCAN_DIRS
    // and re-verify the rest of this test still makes sense.
    expect(files.length).toBeGreaterThan(0)
    // Every file must live under one of the audited subtrees.
    for (const f of files) {
      expect(
        SCAN_DIRS.some(sub => f.startsWith(join(SRC_ROOT, sub))),
        `unexpected file in scan set: ${f}`
      ).toBe(true)
    }
  })

  it('no tab or component .tsx file uses ring-[var(--accent)]', () => {
    const offenders: { file: string; line: number; text: string }[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf-8')
      text.split(/\r?\n/).forEach((lineText, i) => {
        if (FORBIDDEN.test(lineText)) {
          offenders.push({ file, line: i + 1, text: lineText.trim() })
        }
      })
    }
    if (offenders.length > 0) {
      const detail = offenders
        .map(o => `  ${o.file}:${o.line}\n    ${o.text}`)
        .join('\n')
      throw new Error(
        `Found ${offenders.length} teal focus-ring utility class(es) — ` +
          'the global :focus-visible rule in globals.css (cyan) is the ' +
          'single source of truth for focus color. Remove the offending ' +
          'class string(s) below.\n' +
          detail
      )
    }
    expect(offenders).toEqual([])
  })
})
