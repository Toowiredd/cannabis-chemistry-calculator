export {}

declare global {
  interface Window {
    App: {
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
      exportReport: (data: {
        defaultFileName: string
        textContent: string
        jsonContent: string
      }) => Promise<{ canceled: boolean; filePath?: string; jsonPath?: string }>
      copyToClipboard: (text: string) => Promise<boolean>
      savePreset: (data: {
        name: string
        presetData: Record<string, unknown>
      }) => Promise<{ success: boolean; error?: string; filePath?: string }>
      loadPresetDialog: () => Promise<{
        success: boolean
        error?: string
        data?: Record<string, unknown>
        canceled?: boolean
      }>
      saveJournalEntry: (data: Record<string, unknown>) => Promise<{
        success: boolean
        error?: string
        id?: string
        filePath?: string
      }>
      loadJournalEntries: () => Promise<{
        success: boolean
        error?: string
        entries: Record<string, unknown>[]
      }>
      deleteJournalEntry: (id: string) => Promise<{
        success: boolean
        error?: string
      }>
      openExternal: (url: string) => Promise<{ success: boolean }>
      platform: string
    }
  }
}
