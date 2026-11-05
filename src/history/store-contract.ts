import { afterEach, describe, expect, it } from 'vitest'
import { countWords } from '../diff/count-words'
import type { HistoryStore } from './store'
import type { VersionCause } from './types'

export type StoreFixture = {
  readonly store: HistoryStore
  readonly dispose: () => void
}

export type StoreContractOptions = {
  readonly cap: number | null
  readonly perFile: boolean
}

const KEY = 'document'
const OTHER_KEY = 'other'
const EDITED: VersionCause = { kind: 'edited' }

export const describeHistoryStoreContract = (
  name: string,
  createFixture: () => Promise<StoreFixture>,
  { cap, perFile }: StoreContractOptions,
): void => {
  describe(`${name} implements the History store`, () => {
    const open: StoreFixture[] = []

    afterEach(() => {
      for (const fixture of open.splice(0)) fixture.dispose()
    })

    const fresh = async (): Promise<HistoryStore> => {
      const fixture = await createFixture()
      open.push(fixture)
      return fixture.store
    }

    const append = async (
      store: HistoryStore,
      texts: readonly string[],
      key = KEY,
    ): Promise<void> => {
      for (const [index, text] of texts.entries())
        await store.record(key, { at: 100 + index, cause: EDITED, text })
    }

    it('lists nothing for a History that was never written', async () => {
      expect(await (await fresh()).list(KEY)).toEqual([])
    })

    it('makes the first Version a Started one, whatever Cause came in', async () => {
      const store = await fresh()
      await store.record(KEY, { at: 5, cause: EDITED, text: 'one two three' })
      expect(await store.list(KEY)).toMatchObject([
        { at: 5, cause: { kind: 'started' }, words: 3 },
      ])
    })

    it('appends Versions in order, with the Cause and time they came with', async () => {
      const store = await fresh()
      await store.record(KEY, { at: 1, cause: EDITED, text: 'a' })
      await store.record(KEY, {
        at: 2,
        cause: { kind: 'opened', name: 'notes.md' },
        text: 'b',
      })
      await store.record(KEY, { at: 3, cause: { kind: 'external' }, text: 'c' })
      const versions = await store.list(KEY)
      expect(versions.map(({ at, cause }) => [at, cause.kind])).toEqual([
        [1, 'started'],
        [2, 'opened'],
        [3, 'external'],
      ])
      const ids = versions.map(({ id }) => id)
      expect(new Set(ids).size).toBe(3)
      expect([...ids].sort((a, b) => a - b)).toEqual(ids)
    })

    it('lists Versions without their text', async () => {
      const store = await fresh()
      await append(store, ['secret text'])
      const [version] = await store.list(KEY)
      expect(version).not.toHaveProperty('text')
    })

    it('counts the words of a text when it is recorded', async () => {
      const store = await fresh()
      const texts = ['', 'one', 'one  two\nthree four', '# Title\n\nSome body.']
      await append(store, texts)
      expect((await store.list(KEY)).map(({ words }) => words)).toEqual(
        texts.map(countWords),
      )
    })

    describe('word counts on insert', () => {
      const counts = async (store: HistoryStore, key = KEY) =>
        (await store.list(key)).map(({ wordsAdded, wordsRemoved }) => [
          wordsAdded,
          wordsRemoved,
        ])

      it('counts every word of the first Version as added', async () => {
        const store = await fresh()
        await append(store, ['one two three'])
        expect(await counts(store)).toEqual([[3, 0]])
      })

      it('counts the words each Version added and removed against the one before', async () => {
        const store = await fresh()
        await append(store, [
          'one two three',
          'one 2 three four',
          'one 2 three four five six',
          'one 2',
        ])
        expect(await counts(store)).toEqual([
          [3, 0],
          [2, 1],
          [2, 0],
          [0, 4],
        ])
      })

      it('counts a change of spacing as no words', async () => {
        const store = await fresh()
        await append(store, ['one two', 'one  two\n\n'])
        expect(await counts(store)).toEqual([
          [2, 0],
          [0, 0],
        ])
      })

      it('counts a restored old text against the last Version, not its source', async () => {
        const store = await fresh()
        await append(store, ['one two three', 'one two three four'])
        await store.record(KEY, {
          at: 300,
          cause: { kind: 'restored', from: 1 },
          text: 'one two three',
        })
        expect((await counts(store)).at(-1)).toEqual([0, 1])
      })

      it('counts a Version recorded by a save against the last Version', async () => {
        const store = await fresh()
        await append(store, ['one two'])
        await store.markSaved(KEY, {
          text: 'one two three',
          name: 'a.md',
          at: 9,
        })
        expect((await counts(store)).at(-1)).toEqual([1, 0])
      })

      it('does not count a Version a save only marked', async () => {
        const store = await fresh()
        await append(store, ['one two', 'one'])
        await store.markSaved(KEY, { text: 'one two', name: 'a.md', at: 9 })
        expect(await counts(store)).toEqual([
          [2, 0],
          [0, 1],
        ])
      })

      it('counts the first Version recorded by a save as all words added', async () => {
        const store = await fresh()
        await store.markSaved(KEY, { text: 'only these', name: 'a.md', at: 1 })
        expect(await counts(store)).toEqual([[2, 0]])
      })
    })

    it('does not record a text equal to the last Version', async () => {
      const store = await fresh()
      await append(store, ['same', 'same'])
      expect(await store.list(KEY)).toHaveLength(1)
    })

    it('records a text equal to an older Version', async () => {
      const store = await fresh()
      await append(store, ['a', 'b', 'a'])
      expect(await store.list(KEY)).toHaveLength(3)
    })

    it('applies writes in the order they were made, without waiting for each', async () => {
      const store = await fresh()
      await Promise.all(
        ['one', 'two', 'three'].map((text, index) =>
          store.record(KEY, { at: index, cause: EDITED, text }),
        ),
      )
      await store.markSaved(KEY, { text: 'two', name: 'a.md', at: 9 })
      const versions = await store.list(KEY)
      expect(
        await Promise.all(versions.map(({ id }) => store.text(KEY, id))),
      ).toEqual(['one', 'two', 'three'])
      expect(versions.map(({ saved }) => saved)).toEqual([
        undefined,
        'a.md',
        undefined,
      ])
    })

    it('loads the text of a Version on demand', async () => {
      const store = await fresh()
      await append(store, ['first ✓', 'second\n\nwith lines'])
      const versions = await store.list(KEY)
      expect(
        await Promise.all(versions.map(({ id }) => store.text(KEY, id))),
      ).toEqual(['first ✓', 'second\n\nwith lines'])
    })

    it('returns null for the text of an unknown Version', async () => {
      const store = await fresh()
      await append(store, ['a'])
      expect(await store.text(KEY, 987654)).toBeNull()
    })

    it('marks the newest Version holding the saved text', async () => {
      const store = await fresh()
      await append(store, ['a', 'b', 'a', 'c'])
      await store.markSaved(KEY, { text: 'a', name: 'notes.md', at: 200 })
      const versions = await store.list(KEY)
      expect(versions.map(({ saved }) => saved)).toEqual([
        undefined,
        undefined,
        'notes.md',
        undefined,
      ])
    })

    it('keeps the marks of earlier saves', async () => {
      const store = await fresh()
      await append(store, ['a', 'b'])
      await store.markSaved(KEY, { text: 'a', name: 'one.md', at: 200 })
      await store.markSaved(KEY, { text: 'b', name: 'two.md', at: 201 })
      expect((await store.list(KEY)).map(({ saved }) => saved)).toEqual([
        'one.md',
        'two.md',
      ])
    })

    it('records an Edited Version first when no Version holds the saved text', async () => {
      const store = await fresh()
      await append(store, ['old'])
      await store.markSaved(KEY, {
        text: 'new text',
        name: 'notes.md',
        at: 300,
      })
      const versions = await store.list(KEY)
      expect(versions).toHaveLength(2)
      expect(versions[1]).toMatchObject({
        at: 300,
        cause: { kind: 'edited' },
        words: 2,
        saved: 'notes.md',
      })
    })

    it('starts the History when the saved text is its first Version', async () => {
      const store = await fresh()
      await store.markSaved(KEY, { text: 'only', name: 'notes.md', at: 1 })
      expect(await store.list(KEY)).toMatchObject([
        { cause: { kind: 'started' }, saved: 'notes.md' },
      ])
    })

    it('keeps the text of a saved Version loadable', async () => {
      const store = await fresh()
      await store.markSaved(KEY, { text: 'saved text', name: 'a.md', at: 1 })
      const [version] = await store.list(KEY)
      expect(version && (await store.text(KEY, version.id))).toBe('saved text')
    })

    if (cap === null)
      it('keeps every Version', async () => {
        const store = await fresh()
        await append(
          store,
          Array.from({ length: 250 }, (_, index) => `version ${index}`),
        )
        const versions = await store.list(KEY)
        expect(versions).toHaveLength(250)
        const last = versions.at(-1)
        expect(last && (await store.text(KEY, last.id))).toBe('version 249')
      })
    else
      it(`keeps the newest ${cap} Versions`, async () => {
        const store = await fresh()
        const count = (cap ?? 0) + 5
        await append(
          store,
          Array.from({ length: count }, (_, index) => `version ${index}`),
        )
        const versions = await store.list(KEY)
        expect(versions).toHaveLength(cap ?? 0)
        const first = versions[0]
        const last = versions.at(-1)
        expect(first && (await store.text(KEY, first.id))).toBe('version 5')
        expect(last && (await store.text(KEY, last.id))).toBe(
          `version ${count - 1}`,
        )
      })

    if (perFile)
      describe('with a History per key', () => {
        it('keeps the Versions of each key apart', async () => {
          const store = await fresh()
          await append(store, ['a1', 'a2'])
          await append(store, ['b1'], OTHER_KEY)
          expect(await store.list(KEY)).toHaveLength(2)
          expect(await store.list(OTHER_KEY)).toMatchObject([
            { cause: { kind: 'started' }, words: 1 },
          ])
        })

        it('does not dedupe a text against another key', async () => {
          const store = await fresh()
          await append(store, ['same'])
          await append(store, ['same'], OTHER_KEY)
          expect(await store.list(OTHER_KEY)).toHaveLength(1)
        })

        it('does not load a text through another key', async () => {
          const store = await fresh()
          await append(store, ['a1'])
          await append(store, ['b1'], OTHER_KEY)
          const [mine] = await store.list(KEY)
          expect(mine && (await store.text(OTHER_KEY, mine.id))).toBeNull()
        })

        it('counts the first Version of a key from nothing', async () => {
          const store = await fresh()
          await append(store, ['one two three'])
          await append(store, ['one two three four'], OTHER_KEY)
          expect(
            (await store.list(OTHER_KEY)).map(
              ({ wordsAdded, wordsRemoved }) => [wordsAdded, wordsRemoved],
            ),
          ).toEqual([[4, 0]])
        })

        it('marks a save only in its own key', async () => {
          const store = await fresh()
          await append(store, ['same'])
          await append(store, ['same'], OTHER_KEY)
          await store.markSaved(OTHER_KEY, {
            text: 'same',
            name: 'b.md',
            at: 9,
          })
          expect((await store.list(KEY))[0]?.saved).toBeUndefined()
          expect((await store.list(OTHER_KEY))[0]?.saved).toBe('b.md')
        })
      })
  })
}
