import {
  DEFAULT_DECARB,
  DEFAULT_DOSE,
  DEFAULT_INFUSION,
  type DecarbState,
  type DoseState,
  type InfusionState,
  type StartupIntent,
  type StartupRoutingState,
  type TabId,
} from 'renderer/src/stores/appStore'

export interface StartupRoutingContext {
  decarb: DecarbState
  infusion: InfusionState
  dose: DoseState
  startupRouting: StartupRoutingState
}

export interface StartupRoutingDecision {
  confidence: 'low' | 'medium' | 'high'
  destinationTab: TabId
  mode: 'chooser' | 'route'
  reason: string
  recommendedIntent: StartupIntent
}

const CHOOSER_INTENT_PRIORITY: StartupIntent[] = [
  'make_batch',
  'resume_repeat',
  'history_learn',
]

function hasDraftedDecarb(state: DecarbState): boolean {
  return (
    state.weight !== DEFAULT_DECARB.weight ||
    state.thcaPct !== DEFAULT_DECARB.thcaPct ||
    state.thcPct !== DEFAULT_DECARB.thcPct ||
    state.cbdaPct !== DEFAULT_DECARB.cbdaPct ||
    state.cbdPct !== DEFAULT_DECARB.cbdPct ||
    state.presetId !== DEFAULT_DECARB.presetId ||
    state.tempOverride !== DEFAULT_DECARB.tempOverride ||
    state.timeOverride !== DEFAULT_DECARB.timeOverride ||
    state.effLowOverride !== DEFAULT_DECARB.effLowOverride ||
    state.effExpectedOverride !== DEFAULT_DECARB.effExpectedOverride ||
    state.effHighOverride !== DEFAULT_DECARB.effHighOverride ||
    state.bagExpanded !== DEFAULT_DECARB.bagExpanded ||
    state.bagGrindId !== DEFAULT_DECARB.bagGrindId ||
    state.bagPresetId !== DEFAULT_DECARB.bagPresetId ||
    state.bagWidthOverride !== DEFAULT_DECARB.bagWidthOverride ||
    state.bagLengthOverride !== DEFAULT_DECARB.bagLengthOverride ||
    state.bagHasStems !== DEFAULT_DECARB.bagHasStems ||
    state.strainId !== DEFAULT_DECARB.strainId ||
    state.materialMode !== DEFAULT_DECARB.materialMode ||
    state.concentrateTypeId !== DEFAULT_DECARB.concentrateTypeId
  )
}

function hasDraftedInfusion(state: InfusionState): boolean {
  return (
    state.decarbedThc !== DEFAULT_INFUSION.decarbedThc ||
    state.volume !== DEFAULT_INFUSION.volume ||
    state.fatId !== DEFAULT_INFUSION.fatId ||
    state.customEfficiency !== DEFAULT_INFUSION.customEfficiency
  )
}

function hasDraftedDose(state: DoseState): boolean {
  return (
    state.totalThc !== DEFAULT_DOSE.totalThc ||
    state.servings !== DEFAULT_DOSE.servings ||
    state.formatId !== DEFAULT_DOSE.formatId ||
    state.reverseMode !== DEFAULT_DOSE.reverseMode ||
    state.desiredMgPerServing !== DEFAULT_DOSE.desiredMgPerServing
  )
}

export function resolveResumeTab({
  decarb,
  infusion,
  dose,
  startupRouting,
}: StartupRoutingContext): TabId | null {
  if (hasDraftedDose(dose)) return 'dose'
  if (hasDraftedInfusion(infusion)) return 'infusion'
  if (hasDraftedDecarb(decarb)) return 'decarb'

  if (
    startupRouting.lastSuccessfulTab === 'decarb' ||
    startupRouting.lastSuccessfulTab === 'infusion' ||
    startupRouting.lastSuccessfulTab === 'dose' ||
    startupRouting.lastSuccessfulTab === 'quickbatch'
  ) {
    return startupRouting.lastSuccessfulTab
  }

  return null
}

function intentDestination(
  intent: StartupIntent,
  context: StartupRoutingContext
): TabId {
  switch (intent) {
    case 'make_batch':
      return 'quickbatch'
    case 'history_learn':
      return 'journal'
    case 'manual_calculator':
      return (
        resolveResumeTab(context) ??
        context.startupRouting.lastSuccessfulTab ??
        'dose'
      )
    case 'resume_repeat':
      return resolveResumeTab(context) ?? 'quickbatch'
  }
}

function normalizeChooserIntent(intent: StartupIntent): StartupIntent {
  if (intent === 'manual_calculator') return 'resume_repeat'
  if (CHOOSER_INTENT_PRIORITY.includes(intent)) return intent
  return 'make_batch'
}

export function evaluateStartupRouting(
  context: StartupRoutingContext
): StartupRoutingDecision {
  const resumeTab = resolveResumeTab(context)
  const lastSuccessfulIntent = context.startupRouting.lastSuccessfulIntent
  const lastChooserIntent = context.startupRouting.lastChooserIntent
  const lastIntentCount = lastSuccessfulIntent
    ? context.startupRouting.successCounts[lastSuccessfulIntent]
    : 0

  if (
    resumeTab &&
    (lastSuccessfulIntent === 'resume_repeat' ||
      lastSuccessfulIntent === 'manual_calculator' ||
      lastChooserIntent === 'resume_repeat')
  ) {
    return {
      confidence: 'high',
      destinationTab: resumeTab,
      mode: 'route',
      reason: `Resume work where you last left off in ${resumeTab}.`,
      recommendedIntent: 'resume_repeat',
    }
  }

  if (lastSuccessfulIntent && lastIntentCount >= 2) {
    const recommendedIntent = normalizeChooserIntent(lastSuccessfulIntent)
    return {
      confidence: 'high',
      destinationTab: intentDestination(lastSuccessfulIntent, context),
      mode: 'route',
      reason: 'Reuse the last path that repeatedly led to a finished outcome.',
      recommendedIntent,
    }
  }

  if (resumeTab) {
    return {
      confidence: 'medium',
      destinationTab: resumeTab,
      mode: 'chooser',
      reason: `A saved draft points back to ${resumeTab}, but the app should still confirm intent.`,
      recommendedIntent: 'resume_repeat',
    }
  }

  if (lastSuccessfulIntent) {
    const recommendedIntent = normalizeChooserIntent(lastSuccessfulIntent)
    return {
      confidence: 'medium',
      destinationTab: intentDestination(lastSuccessfulIntent, context),
      mode: 'chooser',
      reason:
        'There is one meaningful prior success, but not enough evidence to auto-route yet.',
      recommendedIntent,
    }
  }

  if (lastChooserIntent) {
    return {
      confidence: 'medium',
      destinationTab: intentDestination(lastChooserIntent, context),
      mode: 'chooser',
      reason:
        'The last chosen start mode is a useful hint, but not a strong enough default.',
      recommendedIntent: normalizeChooserIntent(lastChooserIntent),
    }
  }

  return {
    confidence: 'low',
    destinationTab: 'quickbatch',
    mode: 'chooser',
    reason:
      'No trustworthy history exists yet, so start from a guided intent chooser.',
    recommendedIntent: 'make_batch',
  }
}

export function destinationForStartupIntent(
  intent: StartupIntent,
  context: StartupRoutingContext
): TabId {
  return intentDestination(intent, context)
}
