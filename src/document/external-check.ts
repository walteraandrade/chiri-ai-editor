import type { DiskRead, FileContents } from '../platform/kit'
import { createCoalescer } from './coalescer'
import { decideExternalChange } from './external-change'
import type { Conflict } from './file-actions'
import type { FileSession } from './file-session'

type ExternalCheckOptions<Ref> = {
  readonly readDisk: (ref: Ref) => Promise<DiskRead>
  readonly session: () => FileSession<Ref> | null
  readonly document: () => string | null
  readonly reload: (file: FileContents<Ref>) => void
  readonly notice: (conflict: Conflict<Ref> | null) => void
}

export type ExternalCheck<Ref> = {
  readonly run: (ref: Ref) => Promise<void>
  readonly saving: (text: string | null) => void
  readonly forget: () => void
}

const diskTextOf = (read: DiskRead): string | null =>
  read.kind === 'text' ? read.text : null

export const createExternalCheck = <Ref>({
  readDisk,
  session,
  document,
  reload,
  notice,
}: ExternalCheckOptions<Ref>): ExternalCheck<Ref> => {
  let writing: string | null = null
  let noticed: { readonly disk: string | null } | null = null
  let pending: Ref | null = null

  const check = async (ref: Ref): Promise<void> => {
    const read = await readDisk(ref)
    const file = session()
    const text = document()
    if (file === null || file.ref !== ref || text === null) return
    const disk = diskTextOf(read)
    const verdict = decideExternalChange({
      disk,
      savedText: file.savedText,
      document: text,
      writing,
      noticed,
    })
    if (verdict === 'settled') {
      noticed = null
      notice(null)
    } else if (verdict === 'reload' && read.kind === 'text') {
      noticed = null
      reload({ name: read.name, text: read.text, ref })
    } else if (verdict !== 'nothing') {
      noticed = { disk }
      notice({ name: file.name, ref })
    }
  }

  const coalescer = createCoalescer(async () => {
    const ref = pending
    pending = null
    if (ref !== null) await check(ref)
  })

  return {
    run: (ref) => {
      pending = ref
      return coalescer.request()
    },
    saving: (text) => {
      writing = text
    },
    forget: () => {
      noticed = null
    },
  }
}
