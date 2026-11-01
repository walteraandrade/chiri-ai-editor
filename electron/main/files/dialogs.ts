import { dirname, join } from 'node:path'
import {
  type BrowserWindow,
  dialog,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron'

const FILTERS = [{ name: 'Markdown', extensions: ['md', 'markdown'] }]

export type FileDialogs = {
  readonly pickFile: (owner: BrowserWindow | null) => Promise<string | null>
  readonly pickSavePath: (
    owner: BrowserWindow | null,
    suggestedName: string,
  ) => Promise<string | null>
}

export const createFileDialogs = (): FileDialogs => {
  let directory: string | undefined

  const remember = (path: string): string => {
    directory = dirname(path)
    return path
  }

  const pickFile: FileDialogs['pickFile'] = async (owner) => {
    const options: OpenDialogOptions = {
      properties: ['openFile'],
      filters: FILTERS,
      ...(directory !== undefined && { defaultPath: directory }),
    }
    const { canceled, filePaths } =
      owner === null
        ? await dialog.showOpenDialog(options)
        : await dialog.showOpenDialog(owner, options)
    const [path] = filePaths
    return canceled || path === undefined ? null : remember(path)
  }

  const pickSavePath: FileDialogs['pickSavePath'] = async (
    owner,
    suggestedName,
  ) => {
    const options: SaveDialogOptions = {
      defaultPath:
        directory === undefined
          ? suggestedName
          : join(directory, suggestedName),
      filters: FILTERS,
      properties: ['showOverwriteConfirmation', 'createDirectory'],
    }
    const { canceled, filePath } =
      owner === null
        ? await dialog.showSaveDialog(options)
        : await dialog.showSaveDialog(owner, options)
    return canceled || filePath === '' ? null : remember(filePath)
  }

  return { pickFile, pickSavePath }
}
