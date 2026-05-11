import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  calculateTheoreticalMax,
  calculateDecarbedThc,
} from 'renderer/src/engine/decarb'
import { calculateInfusedThc } from 'renderer/src/engine/infusion'
import { calculateMgPerServing, classifyDose } from 'renderer/src/engine/dosing'
import { cn } from 'renderer/lib/utils'
import {
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  ChefHat,
  FlaskConical,
  UtensilsCrossed,
  Scale,
  Clock,
  Thermometer,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function _round1(value: number): number {
  if (value == null || Number.isNaN(value)) return 0
  return Math.round((value + 1e-9) * 10) / 10
}

function fmt1(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '0.0'
  return value.toFixed(1)
}

const OVEN_SEALED_EFF = 0.93 // expected efficiency for oven_sealed
const COCONUT_EFF = 0.82 // extraction efficiency for coconut oil
const DEFAULT_SERVINGS = 16

const STEPS = [
  {
    id: 'checklist',
    label: 'What you need',
    icon: UtensilsCrossed,
  },
  {
    id: 'prepare',
    label: 'Prepare your material',
    icon: Scale,
  },
  {
    id: 'decarb',
    label: 'Decarb',
    icon: Thermometer,
  },
  {
    id: 'infuse',
    label: 'Infuse',
    icon: FlaskConical,
  },
  {
    id: 'dose',
    label: 'Figure out your dose',
    icon: Sparkles,
  },
  {
    id: 'make',
    label: 'Make your edibles',
    icon: ChefHat,
  },
]

interface EquipmentItem {
  name: string
  substitution: string
  checked: boolean
}

const DEFAULT_EQUIPMENT: EquipmentItem[] = [
  {
    name: 'Cannabis flower',
    substitution: 'Any amount works. Quality matters more than quantity.',
    checked: false,
  },
  {
    name: 'Glass baking dish',
    substitution: 'A ceramic casserole dish or even a pie plate works fine.',
    checked: false,
  },
  {
    name: 'Aluminum foil',
    substitution: 'An oven-safe lid or tight layer of parchment plus foil.',
    checked: false,
  },
  {
    name: 'Butter or coconut oil',
    substitution:
      'Ghee or any oil with some fat content works. Avoid watery oils.',
    checked: false,
  },
  {
    name: 'An oven',
    substitution: 'A toaster oven with a temperature dial works too.',
    checked: false,
  },
  {
    name: 'A stove or slow cooker',
    substitution: 'A double boiler or even a very low oven works in a pinch.',
    checked: false,
  },
  {
    name: 'A strainer or cheesecloth',
    substitution: 'A clean kitchen towel, fine mesh sieve, or nut-milk bag.',
    checked: false,
  },
  {
    name: 'Something to bake',
    substitution:
      'Brownie mix, cookie dough, cake mix, gummies, whatever you like.',
    checked: false,
  },
]

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function FirstTimerGuide() {
  const firstTimerOpen = useAppStore(s => s.firstTimerOpen)
  const setFirstTimerOpen = useAppStore(s => s.setFirstTimerOpen)
  const dismissFirstRun = useAppStore(s => s.dismissFirstRun)
  const _firstRunDismissed = useAppStore(s => s.firstRunDismissed)

  const [stepIndex, setStepIndex] = useState(0)
  const [equipment, setEquipment] = useState<EquipmentItem[]>([
    ...DEFAULT_EQUIPMENT,
  ])

  const [grams, setGrams] = useState('3.5')
  const [thcaPct, setThcaPct] = useState('20')
  const [servings, setServings] = useState(String(DEFAULT_SERVINGS))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const step = STEPS[stepIndex]

  /* ---- auto-calculation ---- */
  const results = useMemo(() => {
    const g = parseFloat(grams)
    const p = parseFloat(thcaPct)
    const s = parseFloat(servings)

    if (
      Number.isNaN(g) ||
      Number.isNaN(p) ||
      Number.isNaN(s) ||
      g <= 0 ||
      p <= 0 ||
      p > 100 ||
      s <= 0
    ) {
      return null
    }

    try {
      const theoretical = calculateTheoreticalMax(g, p, 0)
      const decarbed = calculateDecarbedThc(theoretical, OVEN_SEALED_EFF)
      const infused = calculateInfusedThc(decarbed, COCONUT_EFF)
      const perServing = calculateMgPerServing(infused, s)
      const classification = classifyDose(perServing)

      return {
        theoretical,
        decarbed,
        infused,
        perServing,
        classification,
      }
    } catch {
      return null
    }
  }, [grams, thcaPct, servings])

  /* ---- validation ---- */
  useEffect(() => {
    const next: Record<string, string> = {}
    const g = parseFloat(grams)
    const p = parseFloat(thcaPct)
    const s = parseFloat(servings)

    if (grams.trim() === '' || Number.isNaN(g) || g <= 0) {
      next.grams = 'Enter a positive amount in grams'
    }
    if (thcaPct.trim() === '' || Number.isNaN(p) || p <= 0 || p > 100) {
      next.thcaPct = 'Enter a percentage between 1 and 100'
    }
    if (servings.trim() === '' || Number.isNaN(s) || s <= 0) {
      next.servings = 'Enter a positive number of servings'
    }

    setErrors(next)
  }, [grams, thcaPct, servings])

  const handleDismiss = useCallback(() => {
    dismissFirstRun()
    setFirstTimerOpen(false)
  }, [dismissFirstRun, setFirstTimerOpen])

  const toggleEquip = useCallback((i: number) => {
    setEquipment(prev =>
      prev.map((item, idx) =>
        idx === i ? { ...item, checked: !item.checked } : item
      )
    )
  }, [])

  /* ---- dose classification plain text ---- */
  const doseDescription = useMemo(() => {
    if (!results) return ''
    const c = results.classification
    const map: Record<string, string> = {
      'sub-microdose':
        "That's a sub-microdose — barely perceptual. Great if you are very sensitive or want a very gentle introduction.",
      microdose:
        "That's a microdose — very mild. You'll likely feel relaxed but stay fully functional.",
      low: "That's a low dose — noticeable but still manageable for most people. Good for casual use.",
      moderate:
        "That's a moderate dose — the standard range for most users. Expect a solid, pleasant experience.",
      strong:
        "That's a strong dose — intense effects. Make sure you have no plans and a comfortable setting.",
      'very strong':
        "That's a very strong dose — for experienced users only. Start lower if you are unsure.",
      extreme:
        "That's an extreme dose — medical or very high-tolerance territory. Proceed with caution.",
    }
    return map[c] || ''
  }, [results])

  const doseTitle = useMemo(() => {
    if (!results) return ''
    const c = results.classification
    const map: Record<string, string> = {
      'sub-microdose': 'Sub-Microdose',
      microdose: 'Microdose',
      low: 'Low Tolerance',
      moderate: 'Moderate',
      strong: 'Strong',
      'very strong': 'Very Strong',
      extreme: 'Extreme',
    }
    return map[c] || c
  }, [results])

  if (!firstTimerOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-strong relative flex h-full max-h-[900px] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-foreground/10 shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-foreground/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground/90">
              First-Timer Guide
            </h2>
            <p className="text-xs text-foreground/60">
              Your foolproof walkthrough from flower to edible
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={handleDismiss}
              type="button"
            >
              I know what I am doing — take me to the full app
            </button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={() => setFirstTimerOpen(false)}
              title="Close guide"
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-foreground/10 px-6 py-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = i === stepIndex
            const past = i < stepIndex
            return (
              <button
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-foreground/15 text-foreground border border-foreground/20'
                    : past
                      ? 'text-foreground/60 hover:bg-foreground/5'
                      : 'text-foreground/40 hover:bg-foreground/5'
                )}
                key={s.id}
                onClick={() => setStepIndex(i)}
                type="button"
              >
                <Icon className="size-3.5" />
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ---------- Step 1: Equipment ---------- */}
          {step.id === 'checklist' && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-foreground/80">
                Do not worry if you do not have everything on this list. Most
                items have easy substitutions, and the one thing you cannot mess
                up is the temperature.
              </p>

              <div className="space-y-2">
                {equipment.map((item, i) => (
                  <button
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                      item.checked
                        ? 'border-success/30 bg-success/10'
                        : 'border-foreground/10 bg-foreground/5 hover:bg-foreground/10'
                    )}
                    key={item.name}
                    onClick={() => toggleEquip(i)}
                    type="button"
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                        item.checked
                          ? 'border-success bg-success'
                          : 'border-foreground/20'
                      )}
                    >
                      {item.checked && (
                        <Check className="size-3.5 text-white" />
                      )}
                    </div>
                    <div>
                      <p
                        className={cn(
                          'text-sm font-medium',
                          item.checked
                            ? 'text-success line-through'
                            : 'text-foreground/90'
                        )}
                      >
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-foreground/60 leading-relaxed">
                        {item.substitution}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3">
                <p className="text-xs font-medium text-warning">
                  The one thing you cannot mess up
                </p>
                <p className="mt-1 text-xs text-foreground/70 leading-relaxed">
                  Keep the oven at 235°F (113°C) and do not open the door during
                  the first hour. Opening the door drops the temperature and
                  lets out the good stuff.
                </p>
              </div>
            </div>
          )}

          {/* ---------- Step 2: Prepare ---------- */}
          {step.id === 'prepare' && (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-foreground/80">
                Here is the trick: you do not need to be precise to the
                milligram. A kitchen scale and a rough idea of your percentage
                is plenty to get started.
              </p>

              <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4 space-y-4">
                <div>
                  <label
                    className="mb-1.5 block text-xs font-medium text-foreground/80"
                    htmlFor="ftg-grams"
                  >
                    How much cannabis do you have? (grams)
                  </label>
                  <input
                    className="w-full rounded-lg border border-foreground/20 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/40"
                    id="ftg-grams"
                    onChange={e => setGrams(e.target.value)}
                    type="number"
                    value={grams}
                  />
                  {errors.grams && (
                    <p className="mt-1 text-xs text-danger">{errors.grams}</p>
                  )}
                </div>

                <div>
                  <label
                    className="mb-1.5 block text-xs font-medium text-foreground/80"
                    htmlFor="ftg-thca"
                  >
                    Roughly what percent THC? (If you do not know, 15% to 20% is
                    a safe guess for decent flower.)
                  </label>
                  <input
                    className="w-full rounded-lg border border-foreground/20 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/40"
                    id="ftg-thca"
                    max="100"
                    min="1"
                    onChange={e => setThcaPct(e.target.value)}
                    type="number"
                    value={thcaPct}
                  />
                  {errors.thcaPct && (
                    <p className="mt-1 text-xs text-danger">{errors.thcaPct}</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-info/20 bg-info/10 px-4 py-3">
                <p className="text-xs text-info/90 leading-relaxed">
                  Do not worry if your numbers are rough. This calculator gives
                  you an estimate, not a lab report. You can always adjust your
                  serving size later.
                </p>
              </div>
            </div>
          )}

          {/* ---------- Step 3: Decarb ---------- */}
          {step.id === 'decarb' && (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-foreground/80">
                Decarbing is just a fancy word for "heat it up so it becomes
                active." Put your ground cannabis in a glass baking dish, cover
                it tight with foil, and bake at 235°F for an hour. That is it —
                you just decarbed.
              </p>

              <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
                    <Thermometer className="size-4 text-foreground/80" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground/90">
                      Temperature
                    </p>
                    <p className="text-xs text-foreground/60">113°C / 235°F</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
                    <Clock className="size-4 text-foreground/80" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground/90">
                      Time
                    </p>
                    <p className="text-xs text-foreground/60">60 minutes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
                    <FlaskConical className="size-4 text-foreground/80" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground/90">
                      Container
                    </p>
                    <p className="text-xs text-foreground/60">
                      Glass dish + tight foil cover. No airflow = no lost
                      potency.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3">
                <p className="text-xs font-medium text-warning">
                  The one thing you cannot mess up
                </p>
                <p className="mt-1 text-xs text-foreground/70 leading-relaxed">
                  Do not go hotter than 250°F (121°C). Above that, you start
                  burning off the good stuff faster than you convert it. 235°F
                  is the sweet spot.
                </p>
              </div>

              {results && (
                <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-3">
                  <p className="text-xs text-success/90">
                    With {grams}g at {thcaPct}% THC, after decarbing you will
                    have roughly{' '}
                    <strong className="font-semibold text-success">
                      {fmt1(results.decarbed)} mg
                    </strong>{' '}
                    of active THC ready to infuse.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ---------- Step 4: Infuse ---------- */}
          {step.id === 'infuse' && (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-foreground/80">
                Now you pull the THC out of the plant and into the fat. Butter
                and coconut oil work best because THC loves fat. Here is the
                easiest way.
              </p>

              <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4 space-y-3">
                <h3 className="text-sm font-medium text-foreground/90">
                  Stovetop method (simplest)
                </h3>
                <ol className="list-decimal space-y-2 pl-4 text-xs text-foreground/70 leading-relaxed">
                  <li>
                    Melt 1/2 to 1 cup of butter or coconut oil in a saucepan on
                    the lowest possible heat.
                  </li>
                  <li>
                    Add your decarbed cannabis. Stir so it is fully coated.
                  </li>
                  <li>
                    Keep it barely simmering — tiny bubbles, no rolling boil —
                    for 2 to 3 hours. Stir every 20 minutes or so.
                  </li>
                  <li>
                    Strain through cheesecloth or a fine sieve. Squeeze gently.
                    Do not wring it like a towel — that pushes plant bits
                    through.
                  </li>
                  <li>
                    Let it cool, then store in the fridge. That is your infused
                    fat.
                  </li>
                </ol>
              </div>

              <div className="rounded-xl border border-info/20 bg-info/10 px-4 py-3">
                <p className="text-xs text-info/90 leading-relaxed">
                  Slow cooker method: combine decarbed cannabis and fat in the
                  slow cooker on Low for 4 to 6 hours. Strain the same way. You
                  cannot really overcook it at Low, so do not stress about the
                  exact time.
                </p>
              </div>

              {results && (
                <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-3">
                  <p className="text-xs text-success/90">
                    After infusing into coconut oil, you should end up with
                    roughly{' '}
                    <strong className="font-semibold text-success">
                      {fmt1(results.infused)} mg
                    </strong>{' '}
                    of THC in your fat.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ---------- Step 5: Dose ---------- */}
          {step.id === 'dose' && (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-foreground/80">
                This is the part everyone worries about. The good news: with the
                numbers you already entered, the math is done. Just decide how
                many pieces you are making.
              </p>

              <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4 space-y-4">
                <div>
                  <label
                    className="mb-1.5 block text-xs font-medium text-foreground/80"
                    htmlFor="ftg-servings"
                  >
                    How many servings are you making? (A standard brownie mix
                    makes about 16 brownies.)
                  </label>
                  <input
                    className="w-full rounded-lg border border-foreground/20 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/40"
                    id="ftg-servings"
                    min="1"
                    onChange={e => setServings(e.target.value)}
                    type="number"
                    value={servings}
                  />
                  {errors.servings && (
                    <p className="mt-1 text-xs text-danger">
                      {errors.servings}
                    </p>
                  )}
                </div>
              </div>

              {results && (
                <div className="rounded-xl border border-success/20 bg-success/10 p-4 space-y-2">
                  <p className="text-xs text-success/90">
                    Each serving will contain roughly{' '}
                    <strong className="text-sm font-semibold text-success">
                      {fmt1(results.perServing)} mg
                    </strong>{' '}
                    of THC.
                  </p>
                  <div className="mt-2 inline-block rounded-md border border-success/30 bg-success/20 px-3 py-1 text-xs font-semibold text-success">
                    {doseTitle}
                  </div>
                  <p className="text-xs text-success/80 leading-relaxed">
                    {doseDescription}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3">
                <p className="text-xs font-medium text-warning">
                  First-timer tip
                </p>
                <p className="mt-1 text-xs text-foreground/70 leading-relaxed">
                  If the dose looks strong, just cut each brownie in half. You
                  can always eat more, but you cannot un-eat one. Start low and
                  wait at least 90 minutes before taking more.
                </p>
              </div>
            </div>
          )}

          {/* ---------- Step 6: Make ---------- */}
          {step.id === 'make' && (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-foreground/80">
                You have decarbed, infused, and calculated your dose. Now just
                substitute your infused fat for regular butter or oil in any
                recipe. Brownies, cookies, gummies — whatever sounds good.
              </p>

              <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4 space-y-3">
                <h3 className="text-sm font-medium text-foreground/90">
                  Quick substitution rules
                </h3>
                <ul className="list-disc space-y-2 pl-4 text-xs text-foreground/70 leading-relaxed">
                  <li>
                    If the recipe calls for butter, use your infused butter
                    1-for-1.
                  </li>
                  <li>
                    If it calls for oil, use your infused coconut oil 1-for-1.
                  </li>
                  <li>
                    If the recipe needs both, split it however you like. The
                    total fat amount is what matters.
                  </li>
                  <li>
                    Mix thoroughly. Uneven mixing means some pieces will be
                    stronger than others.
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-info/20 bg-info/10 px-4 py-3">
                <p className="text-xs text-info/90 leading-relaxed">
                  A box of brownie mix typically uses 1/2 cup of oil. If you
                  made 1 cup of infused oil, use 1/2 cup in the brownies and
                  save the rest. Label it clearly so no one accidentally uses it
                  for regular cooking.
                </p>
              </div>

              <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-3">
                <p className="text-xs text-success/90 leading-relaxed">
                  That is the whole process. You now have everything you need to
                  make consistent, dosed edibles at home. When you are ready for
                  more control — different methods, custom fats, detailed
                  comparisons — the full calculator tabs are always here for
                  you.
                </p>
              </div>

              <button
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-foreground/20 bg-foreground/10 px-4 py-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-foreground/15"
                onClick={handleDismiss}
                type="button"
              >
                <ArrowRight className="size-4" />
                Go to the full calculator
              </button>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex shrink-0 items-center justify-between border-t border-foreground/10 px-6 py-4">
          <button
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              stepIndex > 0
                ? 'text-foreground/80 hover:bg-foreground/10'
                : 'invisible'
            )}
            disabled={stepIndex === 0}
            onClick={() => setStepIndex(i => i - 1)}
            type="button"
          >
            <ChevronLeft className="size-4" />
            Back
          </button>

          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  i === stepIndex
                    ? 'bg-foreground/80'
                    : i < stepIndex
                      ? 'bg-foreground/40'
                      : 'bg-foreground/15'
                )}
                key={i}
              />
            ))}
          </div>

          <button
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              stepIndex < STEPS.length - 1
                ? 'bg-foreground/15 text-foreground hover:bg-foreground/20'
                : 'invisible'
            )}
            disabled={stepIndex === STEPS.length - 1}
            onClick={() => setStepIndex(i => i + 1)}
            type="button"
          >
            Next
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
