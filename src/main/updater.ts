import { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

export function initUpdater(window: BrowserWindow): void {
  // electron-updater doesn't work in dev — no published release to check
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    window.webContents.send('update:available', { version: info.version })
  })

  autoUpdater.on('update-downloaded', () => {
    window.webContents.send('update:downloaded')
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err.message)
  })

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[updater] checkForUpdates failed:', err.message)
  })
}
