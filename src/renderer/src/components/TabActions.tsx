import { useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  buildExportReport,
  buildTabCopyText,
} from 'renderer/src/utils/exportReport'
import { FileDown, ClipboardCopy, Check } from 'lucide-react'
import { Toast } from './Toast'

export function TabActions({ tabId }: { tabId: string }) {
  const decarb = useAppStore(s => s.decarb)
  const infusion = useAppStore(s => s.infusion)
  const dose = useAppStore(s => s.dose)
  const units = useAppStore(s => s.units)
  const activeTab = useAppStore(s => s.activeTab)

  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2000)
  }

  const handleExport = async () => {
    const exportData = buildExportReport({
      decarb,
      infusion,
      dose,
      units,
      activeTab,
    })
    try {
      const result = await window.App.exportReport({
        defaultFileName: exportData.defaultFileName,
        textContent: exportData.textContent,
        jsonContent: exportData.jsonContent,
      })
      if (result && !result.canceled) {
        showToast('Report saved')
      }
    } catch {
      showToast('Export failed')
    }
  }

  const handleCopy = async () => {
    const text = buildTabCopyText(tabId, { decarb, infusion, dose, units })
    try {
      await window.App.copyToClipboard(text)
      setCopied(true)
      showToast('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Copy failed')
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          onClick={handleExport}
          type="button"
        >
          <FileDown className="size-3.5" />
          Export Report
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          onClick={handleCopy}
          type="button"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <ClipboardCopy className="size-3.5" />
          )}
          {copied ? 'Copied' : 'Copy Summary'}
        </button>
      </div>
      <Toast message={toastMsg} visible={toastVisible} />
    </>
  )
}
