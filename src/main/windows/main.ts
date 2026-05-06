import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'

import { createWindow } from 'lib/electron-app/factories/windows/create'
import { ENVIRONMENT } from 'shared/constants'
import { displayName } from '~/package.json'

export async function MainWindow() {
  const window = createWindow({
    id: 'main',
    title: displayName,
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    center: true,
    movable: true,
    resizable: true,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,

    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  })

  ipcMain.on('window:minimize', () => {
    if (!window.isDestroyed()) {
      window.minimize()
    }
  })

  ipcMain.on('window:maximize', () => {
    if (!window.isDestroyed()) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
  })

  ipcMain.on('window:close', () => {
    if (!window.isDestroyed()) {
      window.close()
    }
  })

  window.webContents.on('did-finish-load', () => {
    if (ENVIRONMENT.IS_DEV) {
      window.webContents.openDevTools({ mode: 'detach' })
    }

    window.show()
  })

  window.on('close', () => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.destroy()
    }
  })

  return window
}
