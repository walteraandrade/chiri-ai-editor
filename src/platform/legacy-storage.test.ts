import { describe, expect, it } from 'vitest'
import { type ListableStorage, migrateLegacyStorage } from './legacy-storage'

const memoryStorage = (
  entries: Record<string, string>,
): ListableStorage & { readonly entries: Map<string, string> } => {
  const map = new Map(Object.entries(entries))
  return {
    entries: map,
    get length() {
      return map.size
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
  }
}

describe('migrateLegacyStorage', () => {
  it('copies every chiri key to its desafinado key', () => {
    const storage = memoryStorage({
      'chiri.lastFile': '/notes/a.md',
      'chiri.model': 'some/model',
    })
    migrateLegacyStorage(storage)
    expect(storage.getItem('desafinado.lastFile')).toBe('/notes/a.md')
    expect(storage.getItem('desafinado.model')).toBe('some/model')
  })

  it('keeps the old keys', () => {
    const storage = memoryStorage({ 'chiri.model': 'some/model' })
    migrateLegacyStorage(storage)
    expect(storage.getItem('chiri.model')).toBe('some/model')
  })

  it('never overwrites a desafinado key', () => {
    const storage = memoryStorage({
      'chiri.model': 'old/model',
      'desafinado.model': 'new/model',
    })
    migrateLegacyStorage(storage)
    expect(storage.getItem('desafinado.model')).toBe('new/model')
  })

  it('renames the old app theme', () => {
    const storage = memoryStorage({ 'chiri.theme': 'chiri' })
    migrateLegacyStorage(storage)
    expect(storage.getItem('desafinado.theme')).toBe('desafinado')
  })

  it('keeps any other theme choice', () => {
    const storage = memoryStorage({ 'chiri.theme': 'omarchy' })
    migrateLegacyStorage(storage)
    expect(storage.getItem('desafinado.theme')).toBe('omarchy')
  })

  it('ignores keys of other apps', () => {
    const storage = memoryStorage({ chirimoya: 'x' })
    migrateLegacyStorage(storage)
    expect([...storage.entries.keys()]).toEqual(['chirimoya'])
  })

  it('does nothing without storage', () => {
    expect(() => migrateLegacyStorage(null)).not.toThrow()
  })

  it('does not throw when storage fails', () => {
    const broken: ListableStorage = {
      length: 1,
      key: () => {
        throw new Error('denied')
      },
      getItem: () => null,
      setItem: () => {},
    }
    expect(() => migrateLegacyStorage(broken)).not.toThrow()
  })
})
