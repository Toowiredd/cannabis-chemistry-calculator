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
      platform: string
    }
  }
}
