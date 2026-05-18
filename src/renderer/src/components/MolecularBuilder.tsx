import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { cn } from 'renderer/lib/utils'
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import {
  computeTransforms,
  pointsToStr,
  hexPoints,
  HEX_RADIUS,
  getRing1Base,
  getRing2Base,
  getRing3Base,
  clamp,
  COLOR_AMBER,
  COLOR_BOND,
  COLOR_CO2,
} from './moleculeGeometry'

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const DURATION_DEFAULT = 4000 // ms at 1x
const SPEEDS = [0.5, 1, 2] as const
type Speed = (typeof SPEEDS)[number]

/* ------------------------------------------------------------------ */
/* RangeSlider sub-component                                          */
/* ------------------------------------------------------------------ */

function ScrubSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value))
    },
    [onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onChange(clamp(value - 0.01, 0, 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onChange(clamp(value + 0.01, 0, 1))
      } else if (e.key === 'Home') {
        e.preventDefault()
        onChange(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        onChange(1)
      }
    },
    [value, onChange]
  )

  return (
    <div className="relative h-6 flex flex-1 items-center">
      <input
        aria-label="Animation scrub slider"
        className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
        max={1}
        min={0}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        step={0.001}
        tabIndex={0}
        type="range"
        value={value}
      />
      {/* Track */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-75"
          style={{ width: `${value * 100}%` }}
        />
      </div>
      {/* Thumb */}
      <div
        className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-background bg-accent shadow-md transition-[left] duration-75"
        style={{ left: `${value * 100}%`, transform: 'translate(-50%, -50%)' }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Static Diagram (reduced-motion)                                    */
/* ------------------------------------------------------------------ */

function StaticDiagram() {
  const r1 = getRing1Base()
  const r2 = getRing2Base()
  const r3 = getRing3Base()

  const pts1 = useMemo(() => pointsToStr(hexPoints(r1.x, r1.y, HEX_RADIUS)), [])
  const pts2 = useMemo(() => pointsToStr(hexPoints(r2.x, r2.y, HEX_RADIUS)), [])
  const pts3 = useMemo(() => pointsToStr(hexPoints(r3.x, r3.y, HEX_RADIUS)), [])

  return (
    <svg
      aria-label="Static diagram showing THCA decarboxylation into THC plus CO₂"
      className="w-full"
      role="img"
      viewBox="0 0 380 260"
    >
      <g transform="translate(0, 10)">
        {/* Bond line broken */}
        <line
          opacity={0.4}
          stroke={COLOR_BOND}
          strokeDasharray="4 4"
          strokeWidth="2.5"
          x1={r3.x + 5}
          x2={r3.x + 55}
          y1={r3.y - 58}
          y2={r3.y - 85}
        />
        {/* Rings */}
        <g
          fill="rgba(20,184,166,0.18)"
          stroke="#14b8a6"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <polygon points={pts1} />
          <polygon points={pts2} />
          <polygon points={pts3} />
        </g>
        {/* Carboxyl group as CO₂ */}
        <g transform="translate(55, -75)">
          <circle
            cx={r3.x + 22}
            cy={r3.y - 10}
            fill={COLOR_CO2}
            opacity={0.9}
            r="7"
          />
          <circle
            cx={r3.x + 36}
            cy={r3.y - 4}
            fill={COLOR_CO2}
            opacity={0.9}
            r="5.5"
          />
          <circle
            cx={r3.x + 26}
            cy={r3.y + 8}
            fill={COLOR_CO2}
            opacity={0.9}
            r="5.5"
          />
        </g>
        {/* Labels */}
        <text
          fill="rgba(255,255,255,0.85)"
          fontSize={14}
          fontWeight={600}
          textAnchor="end"
          x={r1.x - 45}
          y={r1.y + 5}
        >
          THCA
        </text>
        <text
          fill={COLOR_CO2}
          fontSize={13}
          fontWeight={600}
          textAnchor="start"
          x={r3.x + 85}
          y={r3.y - 82}
        >
          CO₂
        </text>
        <text
          fill="rgba(255,255,255,0.85)"
          fontSize={14}
          fontWeight={600}
          textAnchor="start"
          x={r2.x + 48}
          y={r2.y + 5}
        >
          THC
        </text>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Animated SVG                                                       */
/* ------------------------------------------------------------------ */

function AnimatedMolecule({ progress }: { progress: number }) {
  const r1 = getRing1Base()
  const r2 = getRing2Base()
  const r3 = getRing3Base()

  const pts1 = useMemo(() => pointsToStr(hexPoints(r1.x, r1.y, HEX_RADIUS)), [])
  const pts2 = useMemo(() => pointsToStr(hexPoints(r2.x, r2.y, HEX_RADIUS)), [])
  const pts3 = useMemo(() => pointsToStr(hexPoints(r3.x, r3.y, HEX_RADIUS)), [])

  const t = computeTransforms(progress)

  // Carboxyl group circles (small circles arranged in triangle)
  const carboxylCx = r3.x + 5
  const carboxylCy = r3.y - HEX_RADIUS * 1.35

  return (
    <svg
      aria-label="Animated molecule showing decarboxylation"
      className="w-full"
      role="img"
      style={{ willChange: 'transform' }}
      viewBox="0 0 380 260"
    >
      <defs>
        <filter height="200%" id="carboxyl-glow" width="200%" x="-50%" y="-50%">
          <feGaussianBlur result="blur" stdDeviation="3" />
          <feComposite in="blur" in2="SourceGraphic" operator="over" />
        </filter>
      </defs>

      <g
        opacity={t.moleculeOpacity}
        style={{ transition: 'opacity 0.1s ease' }}
      >
        {/* Vibration wrapper around entire molecule */}
        <g
          style={{
            transform: `translate(${t.vibrationOffset.x}px, ${t.vibrationOffset.y}px)`,
            willChange: 'transform',
          }}
        >
          {/* Rings */}
          <g
            style={{
              transform: `translate(${t.ring1Translate.x}px, ${t.ring1Translate.y}px)`,
              willChange: 'transform',
              transition: 'transform 0.05s ease-out',
            }}
          >
            <polygon
              fill="none"
              points={pts1}
              stroke={t.ringColor}
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </g>
          <g
            style={{
              transform: `translate(${t.ring2Translate.x}px, ${t.ring2Translate.y}px)`,
              willChange: 'transform',
              transition: 'transform 0.05s ease-out',
            }}
          >
            <polygon
              fill="none"
              points={pts2}
              stroke={t.ringColor}
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </g>
          <g
            style={{
              transform: `translate(${t.ring3Translate.x}px, ${t.ring3Translate.y}px)`,
              willChange: 'transform',
              transition: 'transform 0.05s ease-out',
            }}
          >
            <polygon
              fill="none"
              points={pts3}
              stroke={t.ringColor}
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </g>

          {/* Bond line between top ring and carboxyl */}
          <line
            opacity={t.bondOpacity}
            stroke={COLOR_BOND}
            strokeWidth="2.5"
            style={{ transition: 'opacity 0.05s ease-out' }}
            x1={r3.x + 5}
            x2={carboxylCx}
            y1={r3.y - HEX_RADIUS}
            y2={carboxylCy + 8}
          />

          {/* Carboxyl group */}
          <g
            opacity={t.carboxylOpacity}
            style={{
              transform: `translate(${t.carboxylTranslate.x}px, ${t.carboxylTranslate.y}px)`,
              willChange: 'transform',
              transition: 'transform 0.05s ease-out',
            }}
          >
            {/* Carboxyl glow */}
            <g opacity={t.glowIntensity} style={{ pointerEvents: 'none' }}>
              <circle
                cx={carboxylCx}
                cy={carboxylCy - 6}
                fill={COLOR_AMBER}
                filter="url(#carboxyl-glow)"
                opacity={0.7}
                r="16"
              />
            </g>
            {/* Main carboxyl circles */}
            <circle
              cx={carboxylCx}
              cy={carboxylCy - 6}
              fill={COLOR_AMBER}
              r="7"
            />
            <circle
              cx={carboxylCx + 14}
              cy={carboxylCy}
              fill={COLOR_AMBER}
              r="5.5"
            />
            <circle
              cx={carboxylCx + 4}
              cy={carboxylCy + 12}
              fill={COLOR_AMBER}
              r="5.5"
            />
          </g>
        </g>

        {/* THCA label */}
        <g
          opacity={progress < 0.75 ? 1 : 0}
          style={{ transition: 'opacity 0.3s ease' }}
        >
          <text
            fill="rgba(255,255,255,0.7)"
            fontSize={13}
            fontWeight={600}
            textAnchor="end"
            x={r1.x - 50}
            y={r1.y + 5}
          >
            THCA
          </text>
        </g>

        {/* CO₂ label */}
        <g
          opacity={t.co2LabelOpacity}
          style={{
            transform: `translate(${t.co2LabelTranslate.x}px, ${t.co2LabelTranslate.y}px)`,
            willChange: 'transform',
            transition: 'opacity 0.1s ease',
          }}
        >
          <text
            fill={COLOR_CO2}
            fontSize={14}
            fontWeight={700}
            textAnchor="start"
            x={carboxylCx + 55}
            y={carboxylCy - 70}
          >
            CO₂
          </text>
        </g>

        {/* THC label */}
        <g
          opacity={t.thcLabelOpacity}
          style={{
            transform: `translate(${t.thcLabelTranslate.x}px, ${t.thcLabelTranslate.y}px)`,
            willChange: 'transform',
            transition: 'opacity 0.1s ease',
          }}
        >
          <text
            fill={COLOR_AMBER}
            fontSize={15}
            fontWeight={700}
            textAnchor="start"
            x={r2.x + 52}
            y={r2.y + 8}
          >
            THC
          </text>
        </g>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export function MolecularBuilder() {
  const [progress, setProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const [hasStarted, setHasStarted] = useState(false)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const wasInViewRef = useRef(false)
  const isVisibleRef = useRef(false)

  // IntersectionObserver for auto-play on first view
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // reduced-motion check
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting
        isVisibleRef.current = visible
        if (visible && !wasInViewRef.current && !hasStarted) {
          wasInViewRef.current = true
          setHasStarted(true)
          setIsPlaying(true)
          setProgress(0)
          lastTimeRef.current = performance.now()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasStarted])

  // Tab switch detection: when not visible, pause
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        setIsPlaying(prev => {
          if (prev) return false
          return prev
        })
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      return
    }

    const tick = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now
      const dt = now - lastTimeRef.current
      lastTimeRef.current = now

      setProgress(prev => {
        const next = clamp(prev + dt / (DURATION_DEFAULT / speed))
        if (next >= 1) {
          setIsPlaying(false)
          return 1
        }
        return next
      })

      if (isPlaying) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    lastTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [isPlaying, speed])

  const handlePlayPause = useCallback(() => {
    if (progress >= 1) {
      setProgress(0)
      setIsPlaying(true)
      lastTimeRef.current = performance.now()
    } else {
      setIsPlaying(prev => !prev)
    }
  }, [progress])

  const handleReplay = useCallback(() => {
    setProgress(0)
    setIsPlaying(true)
    lastTimeRef.current = performance.now()
  }, [])

  const handleSpeedChange = useCallback(() => {
    const idx = SPEEDS.indexOf(speed)
    const next = SPEEDS[(idx + 1) % SPEEDS.length]
    setSpeed(next)
  }, [speed])

  const handleScrub = useCallback(
    (v: number) => {
      setProgress(v)
      if (isPlaying) {
        setIsPlaying(false)
      }
    },
    [isPlaying]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        // Only if focus is on buttons
        if (e.target instanceof HTMLButtonElement) {
          e.preventDefault()
          if (e.target.dataset.action === 'replay') handleReplay()
          else if (e.target.dataset.action === 'playPause') handlePlayPause()
        }
      }
      if (e.key === 'r' || e.key === 'R') {
        handleReplay()
      }
    },
    [handlePlayPause, handleReplay]
  )

  // Check for reduced motion
  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  const percentLabel = `${Math.round(progress * 100)}%`

  return (
    <section
      aria-label="Molecular decarboxylation animation"
      className="flex flex-col gap-5"
      onKeyDown={handleKeyDown}
      ref={containerRef}
    >
      <div
        className={cn(
          'relative flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-6'
        )}
      >
        {/* SVG area */}
        <div className="flex items-center justify-center">
          {reducedMotion ? (
            <StaticDiagram />
          ) : (
            <AnimatedMolecule progress={progress} />
          )}
        </div>

        {/* Caption */}
        <p
          className="mt-2 text-center text-sm leading-relaxed text-foreground/80"
          style={{
            opacity: reducedMotion
              ? 1
              : computeTransforms(progress).captionOpacity,
            transform: reducedMotion
              ? 'none'
              : `translateY(${(1 - computeTransforms(progress).captionOpacity) * 8}px)`,
            transition: 'opacity 0.3s ease, transform 0.3s ease',
          }}
        >
          THCA loses its carboxyl group at ~105°C. The result is psychoactive
          THC.
        </p>

        {!reducedMotion && (
          <>
            {/* Controls bar */}
            <div className="mt-4 flex items-center gap-3">
              {/* Replay */}
              <button
                aria-label="Replay animation"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-foreground/20 bg-foreground/5 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/50"
                data-action="replay"
                onClick={handleReplay}
                tabIndex={0}
                title="Replay (R)"
                type="button"
              >
                <RotateCcw className="size-4" />
              </button>

              {/* Play/Pause */}
              <button
                aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-foreground/20 bg-foreground/5 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/50"
                data-action="playPause"
                onClick={handlePlayPause}
                tabIndex={0}
                title="Play/Pause"
                type="button"
              >
                {isPlaying ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
              </button>

              {/* Scrub slider */}
              <ScrubSlider onChange={handleScrub} value={progress} />

              {/* Percentage */}
              <span className="w-12 shrink-0 text-right text-xs font-medium text-foreground/60 tabular-nums">
                {percentLabel}
              </span>

              {/* Speed toggle */}
              <button
                aria-label={`Speed ${speed}x`}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-foreground/20 bg-foreground/5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/50 tabular-nums"
                onClick={handleSpeedChange}
                tabIndex={0}
                title="Change playback speed"
                type="button"
              >
                {speed === 0.5 && <ChevronsLeft className="size-3.5" />}
                {speed === 1 && <ChevronLeft className="size-3.5" />}
                {speed === 2 && <ChevronsRight className="size-3.5" />}
                <span className="ml-0.5">{speed}x</span>
              </button>
            </div>

            {/* Progress tick marks */}
            <div aria-hidden="true" className="hidden">
              {[0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map(t => (
                <span key={t}>{t.toFixed(3)}</span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
