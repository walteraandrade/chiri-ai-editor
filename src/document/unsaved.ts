export type Unsaved = {
  readonly text: string
  readonly base: string
}

export type Arrival = {
  readonly text: string
  readonly savedText: string
  readonly restored: boolean
  readonly diskChanged: boolean
}

export const restoreUnsaved = (
  disk: string,
  unsaved: Unsaved | null,
): Arrival =>
  unsaved === null || unsaved.text === disk
    ? { text: disk, savedText: disk, restored: false, diskChanged: false }
    : {
        text: unsaved.text,
        savedText: unsaved.base,
        restored: true,
        diskChanged: unsaved.base !== disk,
      }
