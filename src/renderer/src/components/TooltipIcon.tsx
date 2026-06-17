import { useId, useState } from 'react'
import { Info } from 'lucide-react'

export function TooltipIcon({ text }: { text: string }) {
  const tooltipId = useId()
  const [show, setShow] = useState(false)
  return (
    <button
      aria-describedby={show ? tooltipId : undefined}
      aria-expanded={show}
      aria-label="Show explanation"
      className="relative inline-flex shrink-0 items-center justify-center rounded-full p-0.5"
      onBlur={() => setShow(false)}
      onClick={() => setShow(v => !v)}
      onFocus={() => setShow(true)}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          setShow(false)
          e.currentTarget.blur()
        }
      }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      type="button"
    >
      <Info
        aria-hidden="true"
        className="size-4 shrink-0 cursor-help text-foreground/70 transition-colors hover:text-foreground/80"
      />
      {show && (
        <div
          className="absolute bottom-full left-1/2 z-50 mb-2 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-foreground/20 bg-card px-3 py-2 text-left text-xs leading-relaxed text-foreground/90 shadow-xl"
          id={tooltipId}
          role="tooltip"
        >
          {text}
        </div>
      )}
    </button>
  )
}
