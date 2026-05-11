import { useState, useCallback } from 'react'
import { parseLabText, looksLikeLabData } from 'renderer/src/engine/labParser'
import { cn } from 'renderer/lib/utils'
import { FlaskConical, ClipboardPaste, X } from 'lucide-react'

export function LabPasteField({
  onParsed,
}: {
  onParsed: (data: {
    thcaPct: string
    thcPct: string
    cbdaPct: string
    cbdPct: string
  }) => void
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleParse = useCallback(() => {
    setError('')
    setSuccess(false)

    if (!text.trim()) {
      setError('Paste something first')
      return
    }

    if (!looksLikeLabData(text)) {
      setError('Could not find any cannabinoid values in that text')
      return
    }

    const result = parseLabText(text)
    const hasAny =
      result.thcaPct != null ||
      result.thcPct != null ||
      result.cbdaPct != null ||
      result.cbdPct != null

    if (!hasAny) {
      setError('Could not find any cannabinoid values in that text')
      return
    }

    onParsed({
      thcaPct: result.thcaPct != null ? String(result.thcaPct) : '',
      thcPct: result.thcPct != null ? String(result.thcPct) : '',
      cbdaPct: result.cbdaPct != null ? String(result.cbdaPct) : '',
      cbdPct: result.cbdPct != null ? String(result.cbdPct) : '',
    })

    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
  }, [text, onParsed])

  const handleClear = useCallback(() => {
    setText('')
    setError('')
    setSuccess(false)
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
          <FlaskConical className="size-4 text-foreground/70" />
          Paste Lab Results
        </span>
        {text && (
          <button
            className="inline-flex items-center gap-1 rounded p-1 text-xs text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={handleClear}
            type="button"
          >
            <X className="size-3" /> Clear
          </button>
        )}
      </div>

      <textarea
        className={cn(
          'min-h-[4.5rem] resize-none rounded-lg border bg-foreground/5 px-3 py-2 text-xs text-foreground outline-none transition-colors placeholder:text-foreground/30',
          error
            ? 'border-danger/60 focus:border-danger'
            : success
              ? 'border-success/60 focus:border-success'
              : 'border-foreground/20 focus:border-foreground/40'
        )}
        onChange={e => {
          setText(e.target.value)
          if (error) setError('')
          if (success) setSuccess(false)
        }}
        placeholder="Paste lab report text here (e.g. THCA: 22.4%, THC: 0.8%)"
        value={text}
      />

      <div className="flex items-center justify-between">
        <div className="flex-1">
          {error && <span className="text-xs text-danger">{error}</span>}
          {success && !error && (
            <span className="text-xs text-success">
              Lab data parsed and applied
            </span>
          )}
        </div>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          onClick={handleParse}
          type="button"
        >
          <ClipboardPaste className="size-3.5" />
          Apply
        </button>
      </div>
    </div>
  )
}
