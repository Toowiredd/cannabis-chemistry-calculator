import { useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  buildExportReport,
  buildTabCopyText,
} from 'renderer/src/utils/exportReport'
import { FileDown, ClipboardCopy, Check } from 'lucide-react'
import { Toast, type ToastVariant } from './Toast'

export function TabActions({ tabId }: { tabId: string }) {
  const decarb = useAppStore(s => s.decarb)
  const infusion = useAppStore(s => s.infusion)
  const dose = useAppStore(s => s.dose)
  const advancedTools = useAppStore(s => s.advancedTools)
  const units = useAppStore(s => s.units)
  const activeTab = useAppStore(s => s.activeTab)

  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastVariant, setToastVariant] = useState<ToastVariant>('default')
  const [copied, setCopied] = useState(false)

  const showToast = (msg: string, variant: ToastVariant = 'default') => {
    setToastMsg(msg)
    setToastVariant(variant)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2200)
  }

  const handleExport = async () => {
    const exportData = buildExportReport({
      decarb,
      infusion,
      dose,
      advancedTools,
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
        showToast('Report saved', 'success')
      }
    } catch {
      showToast('Could not export', 'danger')
    }
  }

  const handleCopy = async () => {
    const text = buildTabCopyText(tabId, {
      decarb,
      infusion,
      dose,
      advancedTools,
      units,
    })
    try {
      await window.App.copyToClipboard(text)
      setCopied(true)
      showToast('Copied to clipboard', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Could not copy', 'danger')
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <button
          aria-label="Export report"
          className="btn-primary"
          onClick={handleExport}
          title="Export report"
          type="button"
        >
          <FileDown aria-hidden="true" className="size-3.5" />
          <span className="hidden md:inline">Export Report</span>
        </button>
        <button
          aria-label={copied ? 'Copied summary' : 'Copy summary'}
          className={copied ? 'btn-secondary' : 'btn-ghost'}
          onClick={handleCopy}
          title={copied ? 'Copied summary' : 'Copy summary'}
          type="button"
        >
          {copied ? (
            <Check aria-hidden="true" className="size-3.5" />
          ) : (
            <ClipboardCopy aria-hidden="true" className="size-3.5" />
          )}
          <span className="hidden md:inline">
            {copied ? 'Copied' : 'Copy Summary'}
          </span>
        </button>
      </div>
      <Toast message={toastMsg} variant={toastVariant} visible={toastVisible} />
    </>
  )
}
