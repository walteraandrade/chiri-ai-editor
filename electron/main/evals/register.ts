import { homedir } from 'node:os'
import { app, type IpcMainInvokeEvent, ipcMain, shell } from 'electron'
import {
  EVALS_CANCEL_CHANNEL,
  EVALS_OPEN_REPORT_CHANNEL,
  EVALS_PREPARE_CHANNEL,
  EVALS_RUN_CHANNEL,
  EVALS_STATUS_CHANNEL,
} from '../../api'
import type { HistoryAccess } from '../history-main'
import { type LibraryDeps, listLibrary } from '../library/handlers'
import { findClaude, isExecutableFile } from './find-claude'
import { createEvalHandlers } from './handlers'
import { createResultsStore } from './results'
import { createSpawnRunner } from './runner'
import { countEvals, stageSkill } from './stage'

type Trust = (event: IpcMainInvokeEvent) => boolean

export const registerEvalHandlers = (
  isTrusted: Trust,
  library: LibraryDeps,
  history: HistoryAccess,
): void => {
  const home = homedir()
  const path = process.env.PATH
  const handlers = createEvalHandlers({
    librarySkillPaths: async () =>
      (await listLibrary(library)).roots.flatMap(({ skills }) =>
        skills.map(({ realPath }) => realPath),
      ),
    realPath: library.fileSystem.realPath,
    findClaude: () =>
      findClaude({ path, home, isExecutable: isExecutableFile }),
    runner: createSpawnRunner({ home, path }),
    stage: (skillPath, skillText) =>
      stageSkill(skillPath, undefined, skillText),
    countEvals,
    history: {
      versions: (file) => history.db().list(file),
      text: (file, id) => history.db().text(file, id),
    },
    results: createResultsStore(app.getPath('userData')),
    openPath: (file) => shell.openPath(file),
  })

  const handle = (
    channel: string,
    run: (input: unknown) => Promise<unknown>,
  ): void => {
    ipcMain.handle(channel, (event, input: unknown) => {
      if (!isTrusted(event)) throw new Error('Untrusted sender')
      return run(input)
    })
  }

  let closing = false
  app.on('before-quit', (event) => {
    if (closing || !handlers.isRunning()) return
    closing = true
    event.preventDefault()
    void handlers.shutdown().finally(() => app.quit())
  })

  handle(EVALS_STATUS_CHANNEL, handlers.status)
  handle(EVALS_PREPARE_CHANNEL, handlers.prepare)
  handle(EVALS_RUN_CHANNEL, handlers.run)
  handle(EVALS_OPEN_REPORT_CHANNEL, handlers.openReport)
  handle(EVALS_CANCEL_CHANNEL, handlers.cancel)
}
