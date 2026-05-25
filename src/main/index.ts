import { app, BrowserWindow, Tray, nativeImage, screen, Menu, ipcMain } from 'electron'
import { join } from 'node:path'

const WINDOW_WIDTH = 440
const WINDOW_HEIGHT = 600

let tray: Tray | null = null
let window: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    movable: false,
    transparent: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) {
      win.hide()
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function getWindowPosition(): { x: number; y: number } {
  if (!tray || !window) return { x: 0, y: 0 }
  const trayBounds = tray.getBounds()
  const windowBounds = window.getBounds()
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y
  })

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
  const y = Math.round(trayBounds.y + trayBounds.height + 4)

  const minX = display.workArea.x + 4
  const maxX = display.workArea.x + display.workArea.width - windowBounds.width - 4
  x = Math.max(minX, Math.min(maxX, x))

  return { x, y }
}

function toggleWindow(): void {
  if (!window) return
  if (window.isVisible()) {
    window.hide()
    return
  }
  const { x, y } = getWindowPosition()
  window.setPosition(x, y, false)
  window.show()
  window.focus()
}

function buildTrayIcon(): Electron.NativeImage {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'iconTemplate.png')
    : join(__dirname, '../../resources/iconTemplate.png')
  const image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    const fallback = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAQUlEQVR4AWP4z8AAxIRoBgYG/CCkP1AwBgYGBmJgwhgGCgYGMjEwMDAwMxAxMDAwMDExoYIBhpGDDAaQARRAAB+wDXkE+W4WAAAAAElFTkSuQmCC'
    )
    fallback.setTemplateImage(true)
    return fallback
  }
  image.setTemplateImage(true)
  return image
}

function createTray(): void {
  tray = new Tray(buildTrayIcon())
  tray.setToolTip('Vocab')

  tray.on('click', () => toggleWindow())
  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      { label: 'Open Vocab', click: () => toggleWindow() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
    tray!.popUpContextMenu(menu)
  })
}

// Default behavior on macOS is to keep the app alive when all windows close — perfect for a tray app.
// Explicit handler omitted; the tray icon keeps the process running.

if (process.platform === 'darwin') {
  app.dock?.hide()
}

app.whenReady().then(() => {
  ipcMain.handle('app:quit', () => app.quit())
  window = createWindow()
  createTray()
})
