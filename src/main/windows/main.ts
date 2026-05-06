import { app, BrowserWindow, ipcMain, dialog, clipboard } from 'electron'
import { join } from 'node:path'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'

import { createWindow } from 'lib/electron-app/factories/windows/create'
import { ENVIRONMENT } from 'shared/constants'
import { displayName } from '~/package.json'

let presetsDir: string

function getPresetsDir(): string {
  if (!presetsDir) {
    presetsDir = join(app.getPath('userData'), 'presets')
  }
  return presetsDir
}

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

  ipcMain.handle(
    'export-report',
    async (
      _event,
      data: {
        defaultFileName: string
        textContent: string
        jsonContent: string
      }
    ) => {
      const { filePath, canceled } = await dialog.showSaveDialog(window, {
        defaultPath: data.defaultFileName,
        filters: [
          { name: 'Text Report', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })

      if (canceled || !filePath) {
        return { canceled: true }
      }

      // Write text report
      writeFileSync(filePath, data.textContent, 'utf-8')

      // Write JSON with same base name
      const jsonPath = `${filePath.replace(/\.txt$/i, '')}.json`
      writeFileSync(jsonPath, data.jsonContent, 'utf-8')

      return { canceled: false, filePath, jsonPath }
    }
  )

  ipcMain.handle('copy-to-clipboard', (_event, text: string) => {
    clipboard.writeText(text)
    return true
  })

  /* ---------------------------------------------------------------- */
  /* Save Preset                                                       */
  /* ---------------------------------------------------------------- */

  function simpleHash(str: string): string {
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i)
    }
    // Return a 6-char hex string, always positive
    return (hash >>> 0).toString(16).padStart(6, '0').slice(0, 6)
  }

  ipcMain.handle(
    'save-preset',
    async (
      _event,
      data: {
        name: string
        presetData: Record<string, unknown>
      }
    ) => {
      try {
        const name = data.name.trim()
        if (!name) {
          return { success: false, error: 'Preset name cannot be empty' }
        }

        const dir = getPresetsDir()
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }

        const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_')
        const hashSuffix = simpleHash(name)
        const fileName = `${safeName}_${hashSuffix}.json`
        const filePath = join(dir, fileName)

        if (existsSync(filePath)) {
          return {
            success: false,
            error:
              'A preset with this name already exists. Choose a different name.',
          }
        }

        const payload = {
          name,
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          ...data.presetData,
        }

        writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
        return { success: true, filePath }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save preset'
        return { success: false, error: message }
      }
    }
  )

  /* ---------------------------------------------------------------- */
  /* Load Preset — open file dialog                                    */
  /* ---------------------------------------------------------------- */

  ipcMain.handle('load-preset-dialog', async () => {
    try {
      const dir = getPresetsDir()
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      const { filePaths, canceled } = await dialog.showOpenDialog(window, {
        defaultPath: dir,
        properties: ['openFile'],
        filters: [
          { name: 'Preset Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })

      if (canceled || filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      const content = readFileSync(filePaths[0], 'utf-8')

      let parsed: unknown
      try {
        parsed = JSON.parse(content)
      } catch {
        return {
          success: false,
          error: 'Cannot load preset: invalid JSON format',
        }
      }

      if (typeof parsed !== 'object' || parsed === null) {
        return {
          success: false,
          error: 'Cannot load preset: file is not a valid preset',
        }
      }

      const preset = parsed as Record<string, unknown>

      if (!preset.tabs || typeof preset.tabs !== 'object') {
        return {
          success: false,
          error: 'Cannot load preset: missing tab data',
        }
      }

      return { success: true, data: preset }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load preset'
      return { success: false, error: message }
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
