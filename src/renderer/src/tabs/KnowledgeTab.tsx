import { cn } from 'renderer/lib/utils'
import {
  BookOpen,
  Flame,
  Scale,
  FlaskConical,
  Package,
  Leaf,
  AlertTriangle,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Section helpers                                                    */
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
    <div className={cn('glass-strong rounded-2xl p-6')}>
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <div className="mt-4 text-[14px] leading-relaxed text-white/80">
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Conceptual curve chart (SVG)                                       */
/* ------------------------------------------------------------------ */

function ConceptualCurveChart() {
  const w = 560
  const h = 280
  const padLeft = 56
  const padRight = 24
  const padTop = 24
  const padBottom = 48
  const gw = w - padLeft - padRight
  const gh = h - padTop - padBottom

  // conceptual smooth curves via cubic bezier
  // THCA: starts high (1.0) drops to near zero by end
  // THC: starts low, rises to peak mid, then falls
  // CBN: starts near 0, slowly rises then accelerates
  const thcaPath = `M ${padLeft} ${padTop + 0 * gh} C ${padLeft + gw * 0.15} ${padTop + 0.15 * gh}, ${padLeft + gw * 0.3} ${padTop + 0.4 * gh}, ${padLeft + gw * 0.55} ${padTop + 0.85 * gh} ${padLeft + gw * 0.75} ${padTop + 0.95 * gh}, ${padLeft + gw} ${padTop + 0.98 * gh}`

  const thcPath = `M ${padLeft} ${padTop + 0.95 * gh} C ${padLeft + gw * 0.2} ${padTop + 0.75 * gh}, ${padLeft + gw * 0.35} ${padTop + 0.35 * gh}, ${padLeft + gw * 0.55} ${padTop + 0.18 * gh} ${padLeft + gw * 0.75} ${padTop + 0.35 * gh}, ${padLeft + gw * 0.85} ${padTop + 0.6 * gh}, ${padLeft + gw} ${padTop + 0.9 * gh}`

  const cbnPath = `M ${padLeft} ${padTop + 0.98 * gh} C ${padLeft + gw * 0.25} ${padTop + 0.92 * gh}, ${padLeft + gw * 0.45} ${padTop + 0.78 * gh}, ${padLeft + gw * 0.65} ${padTop + 0.55 * gh} ${padLeft + gw * 0.82} ${padTop + 0.35 * gh}, ${padLeft + gw} ${padTop + 0.15 * gh}`

  const axisColor = 'rgba(255,255,255,0.35)'
  const gridColor = 'rgba(255,255,255,0.08)'

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0]
  const xTicks = [0, 0.25, 0.5, 0.75, 1.0]

  return (
    <div className="flex flex-col gap-3">
      <svg
        aria-label="Conceptual chart showing THCA, THC, and CBN concentrations over time and heat exposure"
        className="w-full"
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
            y1={padTop + (1 - t) * gh}
            y2={padTop + (1 - t) * gh}
          />
        ))}

        {/* Grid lines - vertical */}
        {xTicks.map(t => (
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

        {/* Axis Labels */}
        <text
          fill="rgba(255,255,255,0.7)"
          fontSize={13}
          fontWeight={500}
          textAnchor="middle"
          x={padLeft + gw / 2}
          y={h - 12}
        >
          Heat x Time
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
            y={padTop + (1 - t) * gh}
          >
            {Math.round(t * 100)}%
          </text>
        ))}

        {/* X tick labels */}
        {xTicks.map((t, i) => {
          const labels = ['Start', 'Early', 'Mid', 'Late', 'End']
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
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-block size-3 rounded-full bg-blue-400/80" />
          <span className="text-sm text-white/70">THCA</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block size-3 rounded-full bg-emerald-400/80" />
          <span className="text-sm text-white/70">THC</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block size-3 rounded-full bg-red-400/80" />
          <span className="text-sm text-white/70">CBN</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export function KnowledgeTab() {
  return (
    <div className="flex flex-col gap-5 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-white/70" />
          <h2 className="text-xl font-semibold text-white">Knowledge</h2>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Section 1: Conversion Pathway */}
        <SectionCard
          icon={<Flame className="size-5 text-white/80" />}
          title="Conversion Pathway"
        >
          <p>
            When you heat cannabis, a chemical chain reaction begins. First, the
            main inactive compound (THCA) converts into the active compound
            (THC) through a process called decarboxylation. This happens because
            heat removes a small carbon dioxide (CO₂) group from each THCA
            molecule, turning it into THC.
          </p>
          <p className="mt-3">
            But heat is not selective. If you apply too much heat for too long,
            THC itself starts to break down into CBN, a much less potent
            compound that tends to cause drowsiness. That is why the same
            temperature that activates your material can also degrade it if you
            are not careful.
          </p>
        </SectionCard>

        {/* Section 2: The 0.877 Factor */}
        <SectionCard
          icon={<Scale className="size-5 text-white/80" />}
          title="The 0.877 Factor"
        >
          <p>
            You will notice the calculator multiplies your THCA percentage by
            0.877 before turning it into milligrams. That number is not
            arbitrary -- it is the molecular weight ratio between THC and THCA.
          </p>
          <p className="mt-3">
            THCA weighs about 358.5 g per mole. THC weighs about 314.5 g per
            mole. The difference (44.0 g) is the exact weight of the CO₂ group
            that gets removed during decarboxylation. Divide THC by THCA and you
            get 314.5 ÷ 358.5 ≈ 0.877. That is why 1 gram of pure THCA never
            yields 1 gram of THC -- you always lose that CO₂ fragment in the
            process.
          </p>
        </SectionCard>

        {/* Section 3: Sous Vide Temperature Ceiling */}
        <SectionCard
          icon={<FlaskConical className="size-5 text-white/80" />}
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
          </p>
        </SectionCard>

        {/* Section 4: Vacuum Sealing and Oxidation */}
        <SectionCard
          icon={<Package className="size-5 text-white/80" />}
          title="Vacuum Sealing and Oxidation"
        >
          <p>
            Oxygen is the enemy of fresh flavor and potency. When cannabis is
            exposed to air during heating, oxygen molecules attack terpenes (the
            aromatic compounds) and also accelerate the conversion of THC into
            CBN.
          </p>
          <p className="mt-3">
            Vacuum-sealed sous vide bags remove almost all the air around the
            material before heat is applied. The result is better terpene
            preservation and less CBN formation compared with open-air oven
            methods. You can see this reflected in the presets: oven-open
            methods carry a higher CBN risk label because they expose the
            material directly to oxygen.
          </p>
        </SectionCard>

        {/* Section 5: Material Preparation */}
        <SectionCard
          icon={<Leaf className="size-5 text-white/80" />}
          title="Material Preparation"
        >
          <p>
            Coarse, chunky material retains terpenes better than fine powder.
            This sounds counterintuitive -- more surface area should mean faster
            heat transfer -- but the key is what happens before and during
            heating.
          </p>
          <p className="mt-3">
            Fine powder has more total surface area exposed to air. Volatile
            terpenes begin evaporating the moment you grind the material, and
            fine powder loses them even faster under heat. Coarse material or
            small buds lose fewer terpenes because the compounds stay trapped
            inside the plant structure longer during the decarb window.
          </p>
        </SectionCard>

        {/* Section 6: Terpene Retention vs Maximum Conversion */}
        <SectionCard
          icon={<Flame className="size-5 text-white/80" />}
          title="The Potency-Flavor Tradeoff"
        >
          <p>
            There is no single best decarb method because potency and flavor
            pull in opposite directions. Higher temperatures and longer times
            convert more THCA into THC (higher potency), but they also cook off
            more of the aromatic terpenes that give each strain its distinctive
            taste and smell.
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
          icon={<Scale className="size-5 text-white/80" />}
          title="Why Values Are Ranges"
        >
          <p>
            The numbers in this calculator are estimates, not lab-coordinated
            measurements. Real decarboxylation efficiency depends on variables
            you cannot perfectly control in a home kitchen: exact oven
            temperature fluctuations, material moisture content, how densely the
            material is packed, what container you use (glass, metal, ceramic),
            ambient humidity, and even altitude.
          </p>
          <p className="mt-3">
            That is why every preset shows a low-to-high efficiency range rather
            than a single number. The expected value is the most likely outcome
            under normal conditions, but your actual result could fall anywhere
            in the range depending on your setup and technique.
          </p>
        </SectionCard>

        {/* Section 8: Conceptual Heat x Time Curve */}
        <div className={cn('glass-strong rounded-2xl p-6')}>
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10">
              <Flame className="size-5 text-white/80" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              Conceptual Heat x Time Curve
            </h3>
          </div>

          <p className="mt-4 text-[14px] leading-relaxed text-white/80">
            The chart below shows the conceptual relationship between heat
            exposure and the three main compounds. THCA drops as it converts,
            THC rises to a peak then falls as it degrades into CBN, and CBN
            slowly accumulates over time. This is an illustrative model -- not
            data from a specific lab run -- but it captures the general behavior
            you should expect during decarboxylation.
          </p>

          <div className="mt-6">
            <ConceptualCurveChart />
          </div>

          <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3">
            <p className="text-sm text-amber-300/90">
              <strong>Illustrative only:</strong> This curve represents a
              conceptual model of the THCA -- THC -- CBN relationship over time
              and heat exposure. It is not derived from actual laboratory
              measurements and should be treated as educational guidance rather
              than precise scientific data.
            </p>
          </div>
        </div>

        {/* Section 9: Disclaimer */}
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-400/80" />
            <div>
              <h3 className="text-base font-semibold text-red-300">
                Medical Disclaimer
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-red-300/80">
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
