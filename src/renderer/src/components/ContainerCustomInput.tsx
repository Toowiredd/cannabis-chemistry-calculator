/**
 * ContainerCustomInput — the wizard's Container step form.
 *
 * v2.2 (2026-07-27): the Container step used to be a carousel
 * of preset vacuum-bag sizes (1 Gallon, 1 Quart, etc.). The
 * user asked for the input to be **custom fill only** — the
 * user types in their own bag dimensions, the wizard
 * calculates the volume in cm³, and that volume flows
 * downstream to the Weight + Volume + Servings steps.
 *
 * Why custom only: the preset carousel forced the user to
 * pick the bag they had on the shelf, but vacuum bags come
 * in many sizes (and many users reuse stasher bags, mason
 * jars, sous-vide pouches from bulk rolls, etc.). A custom
 * input lets the user describe their actual container and
 * the wizard derives the volume from the user's own
 * measurements.
 *
 * The form has 3 inputs (width, length, depth) in cm, and
 * the volume in cm³ is computed live via
 * `calculateBagVolume` from `engine/bagVolume.ts`. The
 * "Continue" CTA is disabled until all 3 inputs are valid
 * positive numbers. On Continue, the form fires
 * `onConfirm` with the encoded option id `custom-${width}-
 * ${length}-${depth}` (matches the `${step}-${value}`
 * encoding pattern from the Weight / Volume steps) AND
 * writes the derived `customContainer` payload to
 * `selections` via the wizard's `onSelect` callback.
 *
 * The depth defaults to 0.2 cm (a typical vacuum-bag
 * thickness). Users can adjust to 0.1 cm (thin vacuum
 * pouch) or 0.3 cm (thick reusable bag) as needed.
 */
import { useId, useMemo, useState, type ChangeEvent } from 'react'
import { Check, Ruler } from 'lucide-react'
import { cn } from 'renderer/lib/utils'
import { calculateBagVolume } from 'renderer/src/engine/bagVolume'

export interface ContainerCustomInputProps {
  /** Initial values (for re-edit from a previous fill). */
  initialWidthCm?: number
  initialLengthCm?: number
  initialDepthCm?: number
  onConfirm: (optionId: string) => void
  /** Optional: fired on every input change with the live
   *  derived volume, so the parent can mirror it into
   *  `selections.customContainer` for the smart-skip check. */
  onVolumeChange?: (payload: {
    widthCm: number
    lengthCm: number
    depthCm: number
    volumeCm3: number
  }) => void
}

/** Default vacuum-bag thickness, in cm. Matches a typical
 *  food-grade vacuum pouch (3-mil). Users can override. */
const DEFAULT_DEPTH_CM = 0.2

/** The unit (cm) is the only supported unit. Vacuum-bag
 *  dimensions are always in cm in the engine; a future
 *  iteration can add an inch toggle if the user asks for it. */
const UNIT_LABEL = 'cm'

export function ContainerCustomInput({
  initialWidthCm,
  initialLengthCm,
  initialDepthCm,
  onConfirm,
  onVolumeChange,
}: ContainerCustomInputProps) {
  const widthId = useId()
  const lengthId = useId()
  const depthId = useId()
  // Use string state for the inputs (controlled inputs with
  // type="number" still keep the raw string — letting the
  // user clear the field without React complaining). We parse
  // to a number on every change and on submit.
  const [widthInput, setWidthInput] = useState<string>(
    initialWidthCm !== undefined ? String(initialWidthCm) : ''
  )
  const [lengthInput, setLengthInput] = useState<string>(
    initialLengthCm !== undefined ? String(initialLengthCm) : ''
  )
  const [depthInput, setDepthInput] = useState<string>(
    initialDepthCm !== undefined
      ? String(initialDepthCm)
      : String(DEFAULT_DEPTH_CM)
  )
  const widthCm = parseInput(widthInput)
  const lengthCm = parseInput(lengthInput)
  const depthCm = parseInput(depthInput)
  const isValid =
    widthCm !== null &&
    widthCm > 0 &&
    lengthCm !== null &&
    lengthCm > 0 &&
    depthCm !== null &&
    depthCm > 0
  const volumeCm3 = useMemo(() => {
    if (!isValid || widthCm === null || lengthCm === null || depthCm === null) {
      return 0
    }
    return calculateBagVolume(widthCm, lengthCm, depthCm)
  }, [isValid, widthCm, lengthCm, depthCm])
  // Fire `onVolumeChange` on every change so the parent can
  // mirror the live derived value into `selections.customContainer`
  // for the Weight + Volume smart-skip checks. Only fires when
  // the inputs are valid (otherwise the parent would receive a
  // half-baked payload that breaks the smart-skip predicate).
  useMemo(() => {
    if (
      isValid &&
      widthCm !== null &&
      lengthCm !== null &&
      depthCm !== null &&
      onVolumeChange
    ) {
      onVolumeChange({ widthCm, lengthCm, depthCm, volumeCm3 })
    }
    // The eslint-disable is intentional — `onVolumeChange` is
    // a stable callback from the parent (useCallback in the
    // wizard). We re-fire on every input change to keep the
    // parent's mirror up to date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthCm, lengthCm, depthCm, volumeCm3, isValid])
  const handleConfirm = () => {
    if (!isValid || widthCm === null || lengthCm === null || depthCm === null) {
      return
    }
    onConfirm(`custom-${widthCm}-${lengthCm}-${depthCm}`)
  }
  return (
    <div
      className="flex flex-col gap-4"
      data-testid="container-custom-input"
    >
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          data-testid="container-width-input"
          id={widthId}
          label="Width"
          max={200}
          min={1}
          onChange={setWidthInput}
          placeholder="30"
          unit={UNIT_LABEL}
          value={widthInput}
        />
        <NumberField
          data-testid="container-length-input"
          id={lengthId}
          label="Length"
          max={200}
          min={1}
          onChange={setLengthInput}
          placeholder="40"
          unit={UNIT_LABEL}
          value={lengthInput}
        />
        <NumberField
          data-testid="container-depth-input"
          id={depthId}
          label="Depth"
          max={5}
          min={0.1}
          onChange={setDepthInput}
          placeholder={String(DEFAULT_DEPTH_CM)}
          step={0.1}
          unit={UNIT_LABEL}
          value={depthInput}
        />
      </div>
      <div
        aria-live="polite"
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
          isValid
            ? 'border-accent/30 bg-accent/5 text-foreground'
            : 'border-foreground/10 bg-foreground/5 text-foreground/60'
        )}
        data-testid="container-volume-readout"
      >
        <Ruler aria-hidden="true" className="size-4 shrink-0" />
        <span className="font-mono text-xs">
          {isValid
            ? `${volumeCm3.toFixed(1)} cm³ geometric`
            : 'Enter all 3 dimensions to see the volume'}
        </span>
      </div>
      <button
        aria-disabled={!isValid}
        className={cn(
          'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold transition-colors',
          isValid
            ? 'bg-accent/30 text-foreground hover:bg-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60'
            : 'cursor-not-allowed bg-foreground/5 text-foreground/40'
        )}
        data-testid="container-continue-cta"
        onClick={handleConfirm}
        type="button"
      >
        <Check aria-hidden="true" className="size-4" />
        Use these dimensions
      </button>
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
  unit,
  min,
  max,
  step,
  'data-testid': testId,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  unit: string
  min: number
  max: number
  step?: number
  'data-testid'?: string
}) {
  return (
    <label
      className="flex flex-col gap-1"
      data-testid={testId}
      htmlFor={id}
    >
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/60">
        {label} ({unit})
      </span>
      <input
        aria-label={`${label} in ${unit}`}
        className="w-full rounded-md border border-foreground/15 bg-foreground/5 px-2 py-1.5 text-sm font-mono text-foreground outline-none transition-colors focus:border-accent/60 focus:ring-1 focus:ring-accent/40"
        id={id}
        inputMode="decimal"
        max={max}
        min={min}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        type="number"
        value={value}
      />
    </label>
  )
}

/**
 * Parse a raw input string to a positive number. Returns
 * `null` for empty strings, non-numeric values, and `NaN`.
 * The input element's `type="number"` already filters most
 * non-numeric keystrokes, but pasted values and edge cases
 * still need parsing.
 */
function parseInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const n = Number.parseFloat(trimmed)
  if (Number.isNaN(n)) return null
  return n
}
