import { ipcMain, type IpcMainInvokeEvent } from 'electron'

import type { IpcChannel, IpcChannelMap } from '../shared/types'

type Handler<C extends IpcChannel> = (
  payload: IpcChannelMap[C]['req'],
  event: IpcMainInvokeEvent
) => Promise<IpcChannelMap[C]['res']> | IpcChannelMap[C]['res']

function handle<C extends IpcChannel>(channel: C, handler: Handler<C>): void {
  ipcMain.handle(channel, async (event, payload) => handler(payload as never, event))
}

function notImplemented<C extends IpcChannel>(channel: C): Handler<C> {
  return () => {
    throw new Error(`IPC handler not implemented yet: ${channel}`)
  }
}

/**
 * Registers all IPC handlers exposed to the renderer.
 *
 * v0.1 milestone status:
 *   - connection:* — Milestone 1
 *   - compare:*    — Milestones 2-4
 *   - script:*     — Milestone 6
 *
 * Until each handler is implemented, calls throw a clear error so the renderer
 * surface is wired but obviously not yet functional.
 */
export function registerIpc(): void {
  handle('connection:list', notImplemented('connection:list'))
  handle('connection:create', notImplemented('connection:create'))
  handle('connection:update', notImplemented('connection:update'))
  handle('connection:delete', notImplemented('connection:delete'))
  handle('connection:test', notImplemented('connection:test'))

  handle('compare:list-tables', notImplemented('compare:list-tables'))
  handle('compare:run', notImplemented('compare:run'))

  handle('script:save', notImplemented('script:save'))
  handle('script:copy', notImplemented('script:copy'))
}
