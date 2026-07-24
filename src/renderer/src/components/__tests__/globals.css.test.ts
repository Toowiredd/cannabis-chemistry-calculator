// @vitest-environment node
/**
 * Regression test for the 2026-07-25 ccc-uiux-reviewer report MINORs m2 + m3.
 *
 * m2: the global :focus-visible rule set a cyan box-shadow, but many
 *     button sites also carry a Tailwind utility class
 *     `focus-visible:ring-[var(--accent)]` (teal) which out-specifies
 *     the global rule on those buttons. Result: teal focus ring on
 *     buttons, cyan on native form controls — two focus colors in the
 *     same dialog. The fix is to keep this rule single-color (cyan is
 *     the canonical choice). Removing the teal utility from the
 *     ui-tabs button sites is a follow-up — out of scope for this
 *     regression test.
 *
 * m3: the same rule also set `border-radius: 0.375rem`, which
 *     overrode `rounded-lg` / `rounded-xl` / `rounded-2xl` on focus
 *     and snapped button corners when the user tabbed to them. The
 *     fix is to not set border-radius here — the element's own
 *     radius (from its Tailwind utility) must remain in effect.
 *
 * The test reads globals.css as text and asserts both properties of
 * the :focus-visible rule. It does NOT assert button-level
 * consistency across the project — that would be a broader scan
 * (and a separate audit). Scope: just this CSS file.
 *
 * This test runs in the `node` environment (not `jsdom` like the rest
 * of the suite) because the suite-level jsdom environment externalizes
 * `node:fs` / `node:path` for any file that imports them — a side effect
 * of the test file living under the renderer root. This test only reads
 * a text file; it doesn't need DOM.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Resolve the CSS file relative to this test file's location, not
// process.cwd(). Using import.meta.url is robust to invocation
// changes (e.g. running a single test file by absolute path).
const here = dirname(fileURLToPath(import.meta.url))
// This test lives at src/renderer/src/components/__tests__/; the CSS
// file it audits is at src/renderer/globals.css. Three `..` hops:
//   __tests__ -> components -> src -> renderer (the CSS sits here).
const CSS_PATH = resolve(here, '..', '..', '..', 'globals.css')

/**
 * Extract the body of the (single) :focus-visible rule in globals.css.
 * The file has only one such rule today; if a future contributor adds
 * another, the test will assert against the first match, which is the
 * right behaviour for "the canonical focus rule".
 */
function focusRuleBody(css: string): string {
  const start = css.indexOf(':focus-visible')
  expect(
    start,
    'globals.css should contain a :focus-visible rule'
  ).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  expect(
    open,
    'malformed :focus-visible rule (no opening brace)'
  ).toBeGreaterThan(start)
  expect(
    close,
    'malformed :focus-visible rule (no closing brace)'
  ).toBeGreaterThan(open)
  return css.slice(open + 1, close)
}

describe('globals.css focus rule (m2/m3 audit regression)', () => {
  it('canonical focus color is cyan rgba(34, 211, 238, 0.45)', () => {
    const css = readFileSync(CSS_PATH, 'utf-8')
    const body = focusRuleBody(css)
    expect(body).toContain('rgba(34, 211, 238, 0.45)')
  })

  it('focus rule does not also reference the teal var(--accent) ring (m2)', () => {
    const css = readFileSync(CSS_PATH, 'utf-8')
    const body = focusRuleBody(css)
    // m2: a single canonical color only. A teal reference would
    // re-introduce the split this regression test was added to lock down.
    expect(body).not.toContain('var(--accent)')
  })

  it('focus rule does not set border-radius (m3)', () => {
    const css = readFileSync(CSS_PATH, 'utf-8')
    const body = focusRuleBody(css)
    // m3: a `border-radius:` declaration here overrides rounded-lg / -xl
    // / -2xl on focus and snaps button corners. The element's own
    // radius must remain in effect on focus.
    expect(body).not.toMatch(/border-radius\s*:/)
  })
})
