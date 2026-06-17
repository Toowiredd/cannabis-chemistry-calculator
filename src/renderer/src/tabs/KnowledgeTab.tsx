import { useState, useMemo, useCallback, useEffect } from 'react'
import { cn } from 'renderer/lib/utils'
import {
  BookOpen,
  Flame,
  Scale,
  FlaskConical,
  Package,
  Leaf,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { DECARB_METHODS } from 'renderer/src/engine/models'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  simulateDoneness,
  timeLabel,
} from 'renderer/src/engine/doneness-simulation'
import { MolecularBuilder } from 'renderer/src/components/MolecularBuilder'
import { TERPENES } from 'renderer/src/engine/terpenes'

/* ------------------------------------------------------------------ */
/* Range slider styled for glassmorphism                               */
/* ------------------------------------------------------------------ */

function RangeSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground/80">{label}</span>
        <span className="text-sm tabular-nums text-foreground/70">
          {value}
          {unit}
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        <input
          className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
          aria-label={label}
          max={max}
          min={min}
          onChange={e => onChange(parseFloat(e.target.value))}
          step={step}
          type="range"
          value={value}
        />
        {/* Track */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-75"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Thumb */}
        <div
          className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-background bg-accent shadow-md transition-[left] duration-75"
          style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Doneness simulation is now imported from engine/doneness-simulation  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Interactive animated doneness curve                                 */
/* ------------------------------------------------------------------ */

function DonenessCurve() {
  const presetId = useAppStore(s => s.decarb.presetId)
  const preset = useMemo(
    () => DECARB_METHODS.find(m => m.id === presetId) ?? DECARB_METHODS[0],
    [presetId]
  )
  const methodMaxTime = Math.max(120, preset.timeMax)
  const defaultTemp = preset.tempC

  const [tempC, setTempC] = useState(defaultTemp)
  const [timeMin, setTimeMin] = useState(Math.round(methodMaxTime / 2))

  // Reset to method defaults when preset changes
  useEffect(() => {
    setTempC(preset.tempC)
    setTimeMin(Math.round(preset.timeMax / 2))
  }, [preset])

  const setDecarb = useAppStore(s => s.setDecarb)
  const setActiveTab = useAppStore(s => s.setActiveTab)

  const handleApplyToDecarb = useCallback(() => {
    setDecarb({
      tempOverride: String(tempC),
      timeOverride: String(timeMin),
    })
    setActiveTab('decarb')
  }, [setDecarb, setActiveTab, tempC, timeMin])

  function handleReset() {
    setTempC(preset.tempC)
    setTimeMin(Math.round(preset.timeMax / 2))
  }

  const data = useMemo(
    () => simulateDoneness(tempC, methodMaxTime),
    [tempC, methodMaxTime]
  )

  const currentIndex = useMemo(() => {
    let idx = 0
    for (let i = 0; i < data.length; i++) {
      if (data[i].t >= timeMin) {
        idx = i
        break
      }
    }
    return idx
  }, [data, timeMin])

  const w = 560
  const h = 280
  const padLeft = 56
  const padRight = 24
  const padTop = 24
  const padBottom = 56
  const gw = w - padLeft - padRight
  const gh = h - padTop - padBottom

  const maxT = data[data.length - 1]?.t ?? methodMaxTime

  const xFor = useCallback((t: number) => padLeft + (t / maxT) * gw, [maxT, gw])
  const yFor = useCallback((val: number) => padTop + (1 - val / 100) * gh, [gh])

  const buildPath = useCallback(
    (key: 'thca' | 'thc' | 'cbn') => {
      if (!data.length) return ''
      let d = `M ${xFor(data[0].t)} ${yFor(data[0][key])}`
      for (let i = 1; i < data.length; i++) {
        d += ` L ${xFor(data[i].t)} ${yFor(data[i][key])}`
      }
      return d
    },
    [data, xFor, yFor]
  )

  const thcaPath = useMemo(() => buildPath('thca'), [buildPath])
  const thcPath = useMemo(() => buildPath('thc'), [buildPath])
  const cbnPath = useMemo(() => buildPath('cbn'), [buildPath])

  const axisColor = 'rgba(255,255,255,0.35)'
  const gridColor = 'rgba(255,255,255,0.08)'

  const yTicks = [0, 25, 50, 75, 100]

  const cursorX = xFor(data[currentIndex]?.t ?? 0)
  const cursorThca = yFor(data[currentIndex]?.thca ?? 0)
  const cursorThc = yFor(data[currentIndex]?.thc ?? 0)
  const cursorCbn = yFor(data[currentIndex]?.cbn ?? 0)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <RangeSlider
            label="Temperature"
            max={140}
            min={60}
            onChange={setTempC}
            step={1}
            unit="°C"
            value={tempC}
          />
        </div>
        <div className="flex-1">
          <RangeSlider
            label="Time"
            max={methodMaxTime}
            min={0}
            onChange={setTimeMin}
            step={5}
            unit=""
            value={timeMin}
          />
        </div>
      </div>

      <svg
        aria-label="Simulated decarboxylation chart showing THCA, THC, and CBN progression over time"
        className="w-full max-w-full"
        role="img"
        viewBox={`0 0 ${w} ${h}`}
      >
        {/* Background */}
        <rect fill="rgba(0,0,0,0.2)" height={h} rx="8" width={w} />

        {/* Grid lines - horizontal */}
        {yTicks.map(t => (
          <line
            key={`yh-${t}`}
            stroke={gridColor}
            strokeDasharray="4 4"
            strokeWidth={1}
            x1={padLeft}
            x2={w - padRight}
            y1={yFor(t)}
            y2={yFor(t)}
          />
        ))}

        {/* Grid lines - vertical (time markers) */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line
            key={`xv-${t}`}
            stroke={gridColor}
            strokeDasharray="4 4"
            strokeWidth={1}
            x1={padLeft + t * gw}
            x2={padLeft + t * gw}
            y1={padTop}
            y2={h - padBottom}
          />
        ))}

        {/* Axes */}
        <line
          stroke={axisColor}
          strokeWidth={2}
          x1={padLeft}
          x2={w - padRight}
          y1={h - padBottom}
          y2={h - padBottom}
        />
        <line
          stroke={axisColor}
          strokeWidth={2}
          x1={padLeft}
          x2={padLeft}
          y1={padTop}
          y2={h - padBottom}
        />

        {/* Animated fill areas under curves (subtle) */}
        <path
          d={`${thcPath} L ${padLeft + gw} ${h - padBottom} L ${padLeft} ${h - padBottom} Z`}
          fill="rgba(52,211,153,0.08)"
        />

        {/* Curves */}
        <path
          d={thcaPath}
          fill="none"
          stroke="#60a5fa"
          strokeLinecap="round"
          strokeWidth={2.5}
        />
        <path
          d={thcPath}
          fill="none"
          stroke="#34d399"
          strokeLinecap="round"
          strokeWidth={2.5}
        />
        <path
          d={cbnPath}
          fill="none"
          stroke="#f87171"
          strokeLinecap="round"
          strokeWidth={2.5}
        />

        {/* Vertical cursor line at selected time */}
        <line
          opacity={0.6}
          stroke="rgba(255,255,255,0.4)"
          strokeDasharray="3 3"
          strokeWidth={1.5}
          x1={cursorX}
          x2={cursorX}
          y1={padTop}
          y2={h - padBottom}
        />

        {/* Dots at cursor intersection */}
        <circle
          cx={cursorX}
          cy={cursorThca}
          fill="#60a5fa"
          r={4}
          stroke="rgba(0,0,0,0.5)"
          strokeWidth={1}
        />
        <circle
          cx={cursorX}
          cy={cursorThc}
          fill="#34d399"
          r={4}
          stroke="rgba(0,0,0,0.5)"
          strokeWidth={1}
        />
        <circle
          cx={cursorX}
          cy={cursorCbn}
          fill="#f87171"
          r={4}
          stroke="rgba(0,0,0,0.5)"
          strokeWidth={1}
        />

        {/* Axis Labels */}
        <text
          fill="rgba(255,255,255,0.7)"
          fontSize={13}
          fontWeight={500}
          textAnchor="middle"
          x={padLeft + gw / 2}
          y={h - 10}
        >
          Time
        </text>
        <text
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.7)"
          fontSize={13}
          fontWeight={500}
          textAnchor="middle"
          transform={`rotate(-90, 18, ${padTop + gh / 2})`}
          x={18}
          y={padTop + gh / 2}
        >
          Relative Concentration
        </text>

        {/* Y tick labels */}
        {yTicks.map(t => (
          <text
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.7)"
            fontSize={11}
            key={`yt-${t}`}
            textAnchor="end"
            x={padLeft - 8}
            y={yFor(t)}
          >
            {t}%
          </text>
        ))}

        {/* X tick labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const labels = [
            '0m',
            timeLabel(maxT * 0.25),
            timeLabel(maxT * 0.5),
            timeLabel(maxT * 0.75),
            timeLabel(maxT),
          ]
          return (
            <text
              dominantBaseline="hanging"
              fill="rgba(255,255,255,0.7)"
              fontSize={11}
              key={`xt-${t}`}
              textAnchor="middle"
              x={padLeft + t * gw}
              y={h - padBottom + 8}
            >
              {labels[i]}
            </text>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <span className="inline-block size-3 rounded-full bg-info/80" />
          <span className="text-sm text-foreground/70">THCA</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block size-3 rounded-full bg-success/80" />
          <span className="text-sm text-foreground/70">THC</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block size-3 rounded-full bg-danger/80" />
          <span className="text-sm text-foreground/70">CBN</span>
        </div>
      </div>

      {/* Current-point readout */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-info/20 bg-info/10 px-3 py-2 text-center">
          <div className="text-xs text-info/80">THCA</div>
          <div className="text-sm font-semibold tabular-nums text-info">
            {(data[currentIndex]?.thca ?? 0).toFixed(1)}%
          </div>
        </div>
        <div className="rounded-xl border border-success/20 bg-success/10 px-3 py-2 text-center">
          <div className="text-xs text-success/80">THC</div>
          <div className="text-sm font-semibold tabular-nums text-success">
            {(data[currentIndex]?.thc ?? 0).toFixed(1)}%
          </div>
        </div>
        <div className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-center">
          <div className="text-xs text-danger/80">CBN</div>
          <div className="text-sm font-semibold tabular-nums text-danger/80">
            {(data[currentIndex]?.cbn ?? 0).toFixed(1)}%
          </div>
        </div>
      </div>
      {/* Apply + Reset controls */}
      <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent/50"
          onClick={handleApplyToDecarb}
          type="button"
        >
          Apply to Decarb Calculator
          <ArrowRight className="size-4" />
        </button>
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/30"
          onClick={handleReset}
          type="button"
        >
          Reset Curve
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Inline citation helper                                              */
/* ------------------------------------------------------------------ */

function Cite({ label, doi }: { label: string; doi: string }) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    window.App.openExternal(`https://doi.org/${doi}`)
  }

  return (
    <a
      className="ml-1 inline text-xs text-info dark:text-info dark:text-info/90 underline underline-offset-2 hover:text-info"
      aria-label={`Open DOI reference for ${label}`}
      href={`https://doi.org/${doi}`}
      onClick={handleClick}
      rel="noopener noreferrer"
      target="_blank"
    >
      [{label}]
    </a>
  )
}

/* ------------------------------------------------------------------ */
/* Section helpers                                                     */
/* ------------------------------------------------------------------ */

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-5 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-6'
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-foreground/20 bg-foreground/10">
          {icon}
        </div>
        <h3 className="min-w-0 break-words text-lg font-semibold text-foreground">
          {title}
        </h3>
      </div>
      <div className="mt-2 min-w-0 text-sm leading-relaxed text-foreground/80 sm:mt-4">
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export function KnowledgeTab() {
  return (
    <div className="flex min-w-0 flex-col gap-5 p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="size-5 text-foreground/70" />
          <h2 className="text-xl font-semibold text-foreground">Knowledge</h2>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {/* Section 1: Conversion Pathway */}
        <SectionCard
          icon={<Flame className="size-5 text-foreground/80" />}
          title="Conversion Pathway"
        >
          <p>
            When you heat cannabis, a chemical chain reaction begins. First, the
            main inactive compound (THCA) converts into the active compound
            (THC) through a process called decarboxylation. This happens because
            heat removes a small carbon dioxide (CO₂) group from each THCA
            molecule, turning it into THC.
            <Cite doi="10.1089/can.2016.0020" label="Wang et al. 2016" />
            <Cite doi="10.1186/s42238-021-00062-4" label="Tahir et al. 2021" />
          </p>
          <p className="mt-3">
            But heat is not selective. If you apply too much heat for too long,
            THC itself starts to break down into CBN, a much less potent
            compound that tends to cause drowsiness. That is why the same
            temperature that activates your material can also degrade it if you
            are not careful.
            <Cite doi="10.1089/can.2021.0004" label="Jaidee et al. 2022" />
            <Cite
              doi="10.3389/fchem.2022.1038729"
              label="Garcia-Valverde et al. 2022"
            />
          </p>
        </SectionCard>

        {/* Section 1b: Molecular Builder */}
        <SectionCard
          icon={<FlaskConical className="size-5 text-foreground/80" />}
          title="How Decarboxylation Works"
        >
          <MolecularBuilder />
        </SectionCard>

        {/* Section 2: The 0.877 Factor */}
        <SectionCard
          icon={<Scale className="size-5 text-foreground/80" />}
          title="The 0.877 Factor"
        >
          <p>
            You will notice the calculator multiplies your THCA percentage by
            0.877 before turning it into milligrams. That number is not
            arbitrary -- it is the molecular weight ratio between THC and THCA.
            <Cite doi="10.1089/can.2021.0072" label="Filer 2022" />
          </p>
          <p className="mt-3">
            THCA weighs about 358.47 g per mole. THC weighs about 314.45 g per
            mole. The difference (44.02 g) is the exact weight of the CO₂ group
            that gets removed during decarboxylation. Divide THC by THCA and you
            get 314.45 ÷ 358.47 ≈ 0.877. That is why 1 gram of pure THCA never
            yields 1 gram of THC -- you always lose that CO₂ fragment in the
            process.
            <Cite doi="10.1021/acs.iecr.0c03791" label="Moreno et al. 2020" />
          </p>
        </SectionCard>

        {/* Section 2b: CBDA→CBD Pathway */}
        <SectionCard
          icon={<Flame className="size-5 text-foreground/80" />}
          title="CBDA to CBD Pathway"
        >
          <p>
            Cannabidiolic acid (CBDA) decarboxylates into cannabidiol (CBD)
            through the same mechanism as THCA → THC. CBDA and THCA are
            constitutional isomers: same atoms (C₂₂H₃₀O₄), same weight (~358.47
            g/mol), different arrangement. Same structure means same 0.877
            factor applies.
            <Cite doi="10.1021/acs.iecr.0c03791" label="Moreno et al. 2020" />
          </p>
          <p className="mt-3">
            Despite being the same molecule reshuffled, CBDA decarboxylates
            faster than THCA. Its activation energy barrier is a touch lower, so
            CBD-rich material can hit good conversion at slightly cooler
            temperatures or shorter times than THC-dominant strains. The
            calculator still applies the same 0.877 ratio and efficiency ranges
            to both pathways — the molecular-weight math is identical.
            <Cite doi="10.1021/acs.iecr.0c03791" label="Moreno et al. 2020" />
          </p>
        </SectionCard>

        {/* Section 3: Sous Vide Temperature Ceiling */}
        <SectionCard
          icon={<FlaskConical className="size-5 text-foreground/80" />}
          title="Sous Vide Temperature Ceiling"
        >
          <p>
            Sous vide decarboxylation uses a hot water bath to heat the material
            gently and evenly. But there is a hard ceiling: water boils at 100°C
            (212°F) at standard atmospheric pressure. That means you physically
            cannot heat a water bath past that point unless you use a pressure
            cooker, which the calculator does not cover.
          </p>
          <p className="mt-3">
            This is actually a feature, not a bug. Most home cooks do not want
            their decarb to exceed 100°C because higher temperatures destroy
            delicate compounds while also pushing THC toward CBN. The 95°C and
            85°C presets stay safely below that boiling ceiling while still
            providing plenty of heat for full decarboxylation.
            <Cite doi="10.1089/can.2016.0020" label="Wang et al. 2016" />
            <Cite doi="10.1021/acs.iecr.0c03791" label="Moreno et al. 2020" />
          </p>
        </SectionCard>

        {/* Section 4: Vacuum Sealing and Oxidation */}
        <SectionCard
          icon={<Package className="size-5 text-foreground/80" />}
          title="Vacuum Sealing and Oxidation"
        >
          <p>
            Oxygen is the enemy of fresh flavor and potency. When cannabis is
            exposed to air during heating, oxygen molecules attack terpenes (the
            aromatic compounds) and also accelerate the conversion of THC into
            CBN.
            <Cite
              doi="10.3389/fchem.2022.1038729"
              label="Garcia-Valverde et al. 2022"
            />
            <Cite doi="10.1089/can.2021.0173" label="Eyal et al. 2023" />
          </p>
          <p className="mt-3">
            Vacuum-sealed sous vide bags remove almost all the air around the
            material before heat is applied. The result is better terpene
            preservation and less CBN formation compared with open-air oven
            methods. You can see this reflected in the presets: oven-open
            methods carry a higher CBN risk label because they expose the
            material directly to oxygen.
            <Cite doi="10.3390/molecules27206920" label="Raz et al. 2022" />
          </p>
        </SectionCard>

        {/* Section 5: Material Preparation */}
        <SectionCard
          icon={<Leaf className="size-5 text-foreground/80" />}
          title="Material Preparation"
        >
          <p>
            Coarse, chunky material retains terpenes better than fine powder.
            This sounds counterintuitive -- more surface area should mean faster
            heat transfer -- but the key is what happens before and during
            heating.
            <Cite doi="10.1089/can.2021.0173" label="Eyal et al. 2023" />
          </p>
          <p className="mt-3">
            Fine powder has more total surface area exposed to air. Volatile
            terpenes begin evaporating the moment you grind the material, and
            fine powder loses them even faster under heat. Coarse material or
            small buds lose fewer terpenes because the compounds stay trapped
            inside the plant structure longer during the decarb window.
            <Cite doi="10.3390/molecules27206920" label="Raz et al. 2022" />
          </p>
        </SectionCard>

        {/* Section 6: Terpene Retention vs Maximum Conversion */}
        <SectionCard
          icon={<Flame className="size-5 text-foreground/80" />}
          title="The Potency-Flavor Tradeoff"
        >
          <p>
            There is no single best decarb method because potency and flavor
            pull in opposite directions. Higher temperatures and longer times
            convert more THCA into THC (higher potency), but they also cook off
            more of the aromatic terpenes that give each strain its distinctive
            taste and smell.
            <Cite doi="10.1089/can.2021.0173" label="Eyal et al. 2023" />
            <Cite doi="10.3390/molecules27206920" label="Raz et al. 2022" />
          </p>
          <p className="mt-3">
            Lower temperatures and longer times preserve more terpenes but
            typically reach a slightly lower efficiency ceiling for THCA
            conversion. That is why the calculator labels each preset with both
            an efficiency range and a terpene-retention grade. The choice
            depends on whether you care more about maximum potency or maximum
            flavor.
          </p>
        </SectionCard>

        {/* Section 7: Why Values Are Ranges, Not Exact Constants */}
        <SectionCard
          icon={<Scale className="size-5 text-foreground/80" />}
          title="Why Values Are Ranges"
        >
          <p>
            The numbers in this calculator are estimates, not lab-coordinated
            measurements. Real decarboxylation efficiency depends on variables
            you cannot perfectly control in a home kitchen: exact oven
            temperature fluctuations, material moisture content, how densely the
            material is packed, what container you use (glass, metal, ceramic),
            ambient humidity, and even altitude.
            <Cite doi="10.1089/can.2016.0020" label="Wang et al. 2016" />
            <Cite doi="10.1021/acs.iecr.0c03791" label="Moreno et al. 2020" />
          </p>
          <p className="mt-3">
            That is why every preset shows a low-to-high efficiency range rather
            than a single number. The expected value is the most likely outcome
            under normal conditions, but your actual result could fall anywhere
            in the range depending on your setup and technique.
          </p>
        </SectionCard>

        {/* Section 8: Clinical Dosing Context */}
        <SectionCard
          icon={<Scale className="size-5 text-foreground/80" />}
          title="Clinical Dosing Context"
        >
          <p>
            The dose labels in this calculator pull from real clinical
            guidelines. MacCallum and Russo (2018) laid out a practical approach
            that I think gets it right: start low and go slow until you find the
            smallest dose that works. Simple advice, but it genuinely prevents a
            lot of bad experiences.
            <Cite
              doi="10.1016/j.ejim.2018.01.004"
              label="MacCallum & Russo 2018"
            />
          </p>
          <p className="mt-3">
            Bhaskar et al. (2021) got a panel of international pain specialists
            to agree on basically the same thing — for chronic pain, start in
            the 2.5–10 mg THC range. That is where the dose boundaries in this
            app come from.
            <Cite
              doi="10.1186/s42238-021-00073-1"
              label="Bhaskar et al. 2021"
            />
          </p>
        </SectionCard>

        {/* Section 9: Lipid Extraction Science */}
        <SectionCard
          icon={<FlaskConical className="size-5 text-foreground/80" />}
          title="Lipid Extraction Science"
        >
          <p>
            Here is the reason infusion recipes always use fat instead of water:
            cannabinoids are intensely lipophilic. They practically flee from
            water and leap into oil. When you simmer decarbed material in a
            carrier fat, the THC and friends migrate out of the plant and into
            the lipid. How well this works depends on which fat you pick, how
            hot you go, how long you wait, and how finely you broke up the
            material.
            <Cite doi="10.3390/molecules25132986" label="Ramella et al. 2020" />
          </p>
          <p className="mt-3">
            MCT oil wins on extraction efficiency. The molecules are small
            enough to squeeze into plant cells better than longer-chain fats
            can. Ghee and coconut oil — both loaded with saturated fats — come
            close but land a bit behind. That is why you will see higher
            extraction numbers on the MCT preset than on butter or olive oil.
            <Cite doi="10.3390/molecules25132986" label="Ramella et al. 2020" />
            <Cite doi="10.1055/s-0032-1327893" label="Romano & Hazekamp 2013" />
          </p>
        </SectionCard>

        {/* Section 10: Kinetics and Activation Energy */}
        <SectionCard
          icon={<Flame className="size-5 text-foreground/80" />}
          title="Decarboxylation Kinetics"
        >
          <p>
            In a home kitchen, THCA decarboxylation follows first-order
            kinetics. What that actually means: the speed of the reaction
            depends on how much THCA is left, so it slows down as it goes. The
            Arrhenius equation captures the relationship between temperature and
            reaction rate — each 10°C bump roughly doubles the speed.
            <Cite
              doi="10.1016/j.molstruc.2010.11.062"
              label="Perrotin-Brunel et al. 2011"
            />
            <Cite doi="10.1021/acs.iecr.0c03791" label="Moreno et al. 2020" />
          </p>
          <p className="mt-3">
            The activation energy for THCA decarboxylation sits around 85–100
            kJ/mol. CBDA has a slightly different kinetic profile despite being
            the same molecule with the atoms rearranged — same formula
            (C₂₂H₃₀O₄), same weight (~358.47 g/mol), but not quite the same
            reaction speed. That is why you cannot assume the same
            time-temperature combo gives identical results for THC and CBD
            pathways.
            <Cite doi="10.1021/acs.iecr.0c03791" label="Moreno et al. 2020" />
            <Cite doi="10.1016/j.jpba.2017.11.044" label="Citti et al. 2018" />
          </p>
        </SectionCard>

        {/* Section 11: Biosynthesis */}
        <SectionCard
          icon={<Leaf className="size-5 text-foreground/80" />}
          title="Cannabinoid Biosynthesis"
        >
          <p>
            Inside a living cannabis plant, cannabinoids are built from two
            simple starting materials: geranyl pyrophosphate and olivetolic
            acid. These hook together to make CBGA — the mother of all
            cannabinoids. From there, three different enzymes steer CBGA into
            either THCA, CBDA, or CBCA. Which one dominates depends entirely on
            which enzyme the plant is making more of at that moment.
            <Cite doi="10.1186/s42238-021-00062-4" label="Tahir et al. 2021" />
          </p>
          <p className="mt-3">
            THCA and CBDA end up as constitutional isomers: same atoms
            (C₂₂H₃₀O₄), same weight (~358.47 g/mol), different arrangement. That
            shared structure is why both use the same 0.877 factor when they
            lose CO₂ during decarboxylation. The calculator treats both pathways
            identically because, on a molecular-weight basis, they are
            identical.
            <Cite doi="10.1089/can.2021.0072" label="Filer 2022" />
            <Cite doi="10.1186/s42238-021-00062-4" label="Tahir et al. 2021" />
          </p>
        </SectionCard>

        {/* Section 12: Terpene Boiling Points */}
        <SectionCard
          icon={<FlaskConical className="size-5 text-foreground/80" />}
          title="Terpene Boiling Points"
        >
          <p>
            The major cannabis terpenes have normal boiling points ranging from
            about 150°C to over 260°C, but here is the catch: noticeable
            evaporation starts way below those numbers. Vapor pressure climbs
            steadily with temperature, so terpenes begin drifting away in a warm
            kitchen well before the oven hits their official boiling point. The
            table below lists the big five.
            <Cite doi="10.1089/can.2021.0173" label="Eyal et al. 2023" />
          </p>

          <div className="mt-4 min-w-0 overflow-x-auto rounded-xl border border-foreground/10 bg-foreground/5">
            <table className="min-w-[640px] w-full text-sm text-foreground/80">
              <thead className="border-b border-foreground/10 bg-foreground/10">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70">
                    Terpene
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70">
                    Normal Boiling Point
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70">
                    Notes
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {TERPENES.map(t => (
                  <tr className="hover:bg-foreground/5" key={t.name}>
                    <td className="px-4 py-2 font-medium text-foreground">
                      {t.name}
                    </td>
                    <td className="px-4 py-2">
                      {Math.round((t.boilingPointC * 9) / 5 + 32)}°F /{' '}
                      {t.boilingPointC}°C
                    </td>
                    <td className="px-4 py-2 text-foreground/70">
                      {t.notes ?? '-'}
                    </td>
                    <td className="px-4 py-2 text-foreground/70">
                      {t.citation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-foreground/70">
            Source: boiling-point data from Eyal et al. (2023)
            {<Cite doi="10.1089/can.2021.0173" label="Eyal et al. 2023" />}
            and Raz et al. (2022).
            {<Cite doi="10.3390/molecules27206920" label="Raz et al. 2022" />}
          </p>
        </SectionCard>

        {/* Section 12b: Terpene Retention */}
        <SectionCard
          icon={<Leaf className="size-5 text-foreground/80" />}
          title="Terpene Retention and Evaporation"
        >
          <p>
            Terpene retention during decarboxylation is a tug-of-war between two
            variables: temperature and time. Eyal et al. (2023) found that
            monoterpenes — myrcene, limonene, alpha-pinene — start evaporating
            measurably at 40–50°C, which is barely warm. Long before your decarb
            is done, your flavor is already leaking away.
            {<Cite doi="10.1089/can.2021.0173" label="Eyal et al. 2023" />}
            Raz et al. (2022) looked at how handling and packaging change the
            rate of loss. The headline result: vacuum and sealed systems make a
            dramatic difference. Removing air cuts terpene oxidation and slows
            the evaporation gradient.
            {<Cite doi="10.3390/molecules27206920" label="Raz et al. 2022" />}
          </p>
          <p className="mt-3">
            What this boils down to: the coolest preset in the calculator keeps
            the most terpenes. The hottest presets trade flavor for speed on the
            cannabinoid side. Vacuum-sealed methods beat open-air methods for
            both potency and flavor because they knock out two threats at once —
            oxygen-driven degradation and the vapor-pressure gradient that
            pushes volatiles into the air.
          </p>
        </SectionCard>

        {/* Section 12c: Terpene Volatility */}
        <SectionCard
          icon={<Flame className="size-5 text-foreground/80" />}
          title="Terpene Volatility and Vapor Pressure"
        >
          <p>
            Terpenes are volatile organic compounds — high vapor pressure, ready
            to evaporate at temperatures you would barely call warm.
            Monoterpenes like myrcene and limonene officially boil around
            165–175°C. Sesquiterpenes like caryophyllene hold out closer to
            250°C. But none of that matters much because they start vanishing
            long before the thermometer gets there.
            <Cite doi="10.1089/can.2021.0173" label="Eyal et al. 2023" />
          </p>
          <p className="mt-3">
            Vapor pressure is what makes a compound flee. Cannabis terpenes
            begin losing measurable mass around 40–50°C — barely above body
            temperature, way before decarboxylation finishes. That is the whole
            reason low-temperature, long-time methods keep more flavor: they
            give THCA enough thermal energy to convert while keeping the vapor
            pressure on delicate terpenes as low as possible.
            <Cite doi="10.1089/can.2021.0173" label="Eyal et al. 2023" />
            <Cite doi="10.3390/molecules27206920" label="Raz et al. 2022" />
          </p>
        </SectionCard>

        {/* Section 13: Interactive Doneness Curve */}
        <div
          className={cn(
            'flex min-w-0 flex-col gap-5 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-6'
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-foreground/20 bg-foreground/10">
              <Flame className="size-5 text-foreground/80" />
            </div>
            <h3 className="min-w-0 break-words text-lg font-semibold text-foreground">
              Interactive Decarboxylation Curve
            </h3>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-foreground/80">
            Slide the temperature and time sliders below to watch THCA drop, THC
            rise and peak, and CBN slowly accumulate. The shapes are driven by a
            simplified Arrhenius model: both the conversion of THCA into THC and
            the degradation of THC into CBN speed up exponentially as
            temperature increases. Mess around with the sliders for a minute —
            you will feel the tradeoffs faster than you can read about them.
          </p>

          <div className="mt-4 min-w-0 sm:mt-6">
            <DonenessCurve />
          </div>

          <div className="mt-4 rounded-lg border border-warning/20 bg-warning/10 dark:bg-warning/10 px-4 py-3">
            <p className="text-sm text-warning dark:text-warning dark:text-warning/90">
              <strong>Simulated / Illustrative only:</strong> This curve is
              generated from a simplified kinetic model for educational
              purposes. It is not derived from actual laboratory measurements
              and should be treated as illustrative guidance rather than precise
              scientific data.
            </p>
          </div>
        </div>

        {/* Section 14: Disclaimer */}
        <div className="min-w-0 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger/80" />
            <div>
              <h3 className="text-base font-semibold text-danger">
                Medical Disclaimer
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-danger/80">
                The content in this Knowledge section is for educational and
                informational purposes only. It does not constitute medical
                advice, diagnosis, or treatment. Always consult a qualified
                healthcare professional before using cannabis for medical
                purposes. Individual responses to cannabis vary widely, and the
                information here should not replace professional medical
                guidance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer spacer */}
      <div className="h-2" />
    </div>
  )
}
