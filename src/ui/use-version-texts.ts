import { useEffect, useState } from 'react'
import type { VersionId } from '../history/types'

type Loaded = {
  readonly key: string
  readonly texts: readonly (string | null)[]
}

const idsOf = (key: string): readonly VersionId[] =>
  key === '' ? [] : key.split(',').map(Number)

export const useVersionTexts = (
  load: (id: VersionId) => Promise<string | null>,
  ids: readonly VersionId[] | null,
): readonly (string | null)[] | undefined => {
  const key = ids === null ? null : ids.join(',')
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (key === null) return undefined
    const wanted = idsOf(key)
    let current = true
    Promise.all(wanted.map(load)).then(
      (texts) => {
        if (current) setLoaded({ key, texts })
      },
      () => {
        if (current) setLoaded({ key, texts: wanted.map(() => null) })
      },
    )
    return () => {
      current = false
    }
  }, [load, key])

  return key !== null && loaded?.key === key ? loaded.texts : undefined
}
