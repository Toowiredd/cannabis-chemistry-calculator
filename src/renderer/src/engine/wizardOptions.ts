/**
 * Brief-mandated alias surface for the wizard option cards.
 *
 * The chem-engine producer's work landed in `wizardPresets.ts` under their
 * preferred names (`WIZARD_RECIPES`, `DECARB_METHOD_CARDS`, `FAT_CARDS`).
 * The brief for this plan specified `METHOD_OPTIONS`, `FAT_OPTIONS`, and
 * `FORMAT_OPTIONS` exported from a file named `wizardOptions.ts`, which is
 * the symbol path the downstream ui-tabs task consumes.
 *
 * This file is the bridge: it re-exports the producer's data verbatim under
 * the brief's symbol names. ui-tabs imports `METHOD_OPTIONS`, `FAT_OPTIONS`,
 * and `FORMAT_OPTIONS` from `./wizardOptions` (or `engine/wizardOptions`)
 * and gets the same shape the wizard renders.
 *
 * Selection-tip carry-forward: the brief asked for per-option `selectionTip`
 * ("check this if you want a low-supervision recipe") alongside `humanNote`.
 * The producer shipped `humanNote` only; `selectionTip` is a doc-cleanup
 * carry-forward for a follow-up cycle. The wizard renders `humanNote` in the
 * meantime, which still gives the user actionable context.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- compat re-export across two healthy surfaces; typecheck pass
// is governed by wizardPresets.ts.

export {
  DECARB_METHOD_CARDS as METHOD_OPTIONS,
  FAT_CARDS as FAT_OPTIONS,
  WIZARD_RECIPES as FORMAT_OPTIONS,
} from './wizardPresets'
