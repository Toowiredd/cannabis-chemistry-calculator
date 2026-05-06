/// <reference types="vite/client" />

declare global {
  interface Window {
    App: {
      window: {
        minimize(): void
        maximize(): void
        close(): void
      }
      platform: string
    }
  }
}
