import { useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import { INFUSION_FATS } from 'renderer/src/engine/models'
import { cn } from 'renderer/lib/utils'
import { Printer, X, Info, Tag, AlertTriangle, ShieldAlert } from 'lucide-react'

function fmt1(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return value.toFixed(1)
}

function todayDisplay(): string {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

export function LabelGenerator({
  mgPerServing,
  classification,
  servings,
}: {
  mgPerServing: number
  classification: string
  servings: number
}) {
  const label = useAppStore(s => s.label)
  const setLabel = useAppStore(s => s.setLabel)
  const resetLabel = useAppStore(s => s.resetLabel)
  const incrementBatchNumber = useAppStore(s => s.incrementBatchNumber)
  const infusion = useAppStore(s => s.infusion)

  const [showPrintable, setShowPrintable] = useState(false)

  const fatPreset = INFUSION_FATS.find(f => f.id === infusion.fatId)
  const fatName = fatPreset?.name ?? infusion.fatId

  /* Allergen warnings based on fat type */
  const allergenWarnings: string[] = []
  if (infusion.fatId === 'coconut' || infusion.fatId === 'mct') {
    allergenWarnings.push('Contains: Coconut')
  }
  if (infusion.fatId === 'ghee') {
    allergenWarnings.push('Contains: Milk (clarified butter)')
  }

  /* Facility allergen warnings */
  if (label.facilityNuts) {
    allergenWarnings.push('Produced in a facility that processes tree nuts')
  }
  if (label.facilityDairy) {
    allergenWarnings.push('Produced in a facility that processes dairy')
  }
  if (label.facilityGluten) {
    allergenWarnings.push('Produced in a facility that processes gluten')
  }

  /* Dosage tier warnings */
  const dosageWarnings: string[] = []
  if (mgPerServing > 10) {
    dosageWarnings.push('Beginner: start with 1/2 serving')
  }
  if (mgPerServing > 25) {
    dosageWarnings.push('Do not operate vehicles or machinery')
  }

  const handleGenerate = () => {
    setShowPrintable(true)
    incrementBatchNumber()
  }

  const handleClose = () => {
    setShowPrintable(false)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Configuration panel */}
      <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
          Label Configuration
        </h3>

        {/* Product name */}
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
            <Tag className="size-3.5 text-foreground/70" />
            Product Name
          </span>
          <input
            className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
            onChange={e => setLabel({ productName: e.target.value })}
            placeholder="e.g. Golden Infused Ghee"
            type="text"
            value={label.productName}
          />
        </div>

        {/* Ingredients */}
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
            <Info className="size-3.5 text-foreground/70" />
            Ingredients
          </span>
          <textarea
            className="min-h-[3.5rem] rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
            onChange={e => setLabel({ ingredients: e.target.value })}
            placeholder="e.g. Cannabis-infused ghee, lecithin"
            value={label.ingredients}
          />
        </div>

        {/* Storage */}
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
            Storage Instructions
          </span>
          <textarea
            className="min-h-[3.5rem] rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
            onChange={e => setLabel({ storage: e.target.value })}
            placeholder="Store in a cool, dark place..."
            value={label.storage}
          />
        </div>

        {/* Allergen toggles */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground/80">
            Facility Allergen Warnings
          </span>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/70">
            <input
              checked={label.facilityNuts}
              className="size-4 accent-foreground/60"
              onChange={e => setLabel({ facilityNuts: e.target.checked })}
              type="checkbox"
            />
            Facility processes tree nuts
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/70">
            <input
              checked={label.facilityDairy}
              className="size-4 accent-foreground/60"
              onChange={e => setLabel({ facilityDairy: e.target.checked })}
              type="checkbox"
            />
            Facility processes dairy
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/70">
            <input
              checked={label.facilityGluten}
              className="size-4 accent-foreground/60"
              onChange={e => setLabel({ facilityGluten: e.target.checked })}
              type="checkbox"
            />
            Facility processes gluten
          </label>
        </div>

        {/* Current batch number */}
        <div className="flex items-center justify-between rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
          <span className="text-sm font-medium text-foreground/80">
            Next Batch Number
          </span>
          <span className="text-sm font-bold text-foreground">
            {label.batchNumber}
          </span>
        </div>

        {/* Generate button */}
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground/15 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/25"
          onClick={handleGenerate}
          type="button"
        >
          <Tag className="size-3.5" />
          Generate Label
        </button>

        {/* Reset label config */}
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
          onClick={resetLabel}
          type="button"
        >
          Reset Label Defaults
        </button>
      </div>

      {/* Printable modal */}
      {showPrintable && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/70 backdrop-blur-sm print:hidden">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 rounded-2xl border border-foreground/20 bg-background p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Printable Label
              </h3>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/25"
                  onClick={handlePrint}
                  type="button"
                >
                  <Printer className="size-3.5" />
                  Print
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-lg border border-foreground/20 bg-foreground/5 p-1.5 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                  onClick={handleClose}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* The actual label card */}
            <div
              className={cn(
                'label-card flex flex-col gap-3 rounded-xl border-2 border-foreground/80 bg-white p-5 text-black print:shadow-none',
                'shadow-lg'
              )}
            >
              {/* Header: product name + batch */}
              <div className="flex items-start justify-between border-b-2 border-black pb-2">
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wider text-gray-600">
                    Product
                  </span>
                  <span className="text-lg font-bold leading-tight text-black">
                    {label.productName || 'Unnamed Product'}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs uppercase tracking-wider text-gray-600">
                    Batch
                  </span>
                  <span className="text-sm font-bold text-black">
                    #{label.batchNumber}
                  </span>
                </div>
              </div>

              {/* THC / servings row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600">
                    THC per Serving
                  </span>
                  <span className="text-base font-bold text-black">
                    {fmt1(mgPerServing)} mg
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600">
                    Servings
                  </span>
                  <span className="text-base font-bold text-black">
                    {servings}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600">
                    Classification
                  </span>
                  <span className="text-sm font-semibold text-black">
                    {classification}
                  </span>
                </div>
              </div>

              {/* Fat type + date */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600">
                    Carrier
                  </span>
                  <span className="text-sm font-semibold text-black">
                    {fatName}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600">
                    Date Produced
                  </span>
                  <span className="text-sm font-semibold text-black">
                    {todayDisplay()}
                  </span>
                </div>
              </div>

              {/* Ingredients */}
              {label.ingredients && (
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600">
                    Ingredients
                  </span>
                  <span className="text-xs leading-relaxed text-black">
                    {label.ingredients}
                  </span>
                </div>
              )}

              {/* Storage */}
              {label.storage && (
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600">
                    Storage
                  </span>
                  <span className="text-xs leading-relaxed text-black">
                    {label.storage}
                  </span>
                </div>
              )}

              {/* Allergen warnings */}
              {allergenWarnings.length > 0 && (
                <div className="flex flex-col gap-1 rounded-md border border-amber-500/60 bg-amber-50 p-2">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    <AlertTriangle className="size-3" />
                    Allergen Notice
                  </span>
                  {allergenWarnings.map(w => (
                    <span
                      className="text-[10px] font-medium text-amber-900"
                      key={w}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              )}

              {/* Dosage warnings */}
              {dosageWarnings.length > 0 && (
                <div className="flex flex-col gap-1 rounded-md border border-red-500/60 bg-red-50 p-2">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-800">
                    <ShieldAlert className="size-3" />
                    Dosage Warning
                  </span>
                  {dosageWarnings.map(w => (
                    <span
                      className="text-[10px] font-medium text-red-900"
                      key={w}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              )}

              {/* Child safety footer */}
              <div className="flex items-center justify-center gap-1 border-t-2 border-black pt-2">
                <ShieldAlert className="size-3.5 text-red-700" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-700">
                  Keep out of reach of children
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
