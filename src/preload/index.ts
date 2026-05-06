import { contextBridge, ipcRenderer } from 'electron'

declare global {
  interface Window {
    App: typeof API
  }
}

const API = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
  exportReport: (data: {
    defaultFileName: string
    textContent: string
    jsonContent: string
  }) => ipcRenderer.invoke('export-report', data),
  copyToClipboard: (text: string) =>
    ipcRenderer.invoke('copy-to-clipboard', text),
  platform: process.platform,
} as const

contextBridge.exposeInMainWorld('App', API)
