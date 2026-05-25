import { contextBridge, ipcRenderer } from 'electron'
import type { MainApi } from '@shared/types'

const api: MainApi = {
  quit: () => ipcRenderer.invoke('app:quit')
}

contextBridge.exposeInMainWorld('api', api)
