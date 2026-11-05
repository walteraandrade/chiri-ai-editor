import { describe, expect, it } from 'vitest'
import {
  decideExternalChange,
  type ExternalChangeFacts,
} from './external-change'

const facts = (
  overrides: Partial<ExternalChangeFacts> = {},
): ExternalChangeFacts => ({
  disk: '# A, by an agent\n',
  savedText: '# A\n',
  document: '# A\n',
  writing: null,
  noticed: null,
  ...overrides,
})

describe('decideExternalChange', () => {
  it('reloads a clean Document when the disk holds other text', () => {
    expect(decideExternalChange(facts())).toBe('reload')
  })

  it('shows the notice for a dirty Document, never overwriting it', () => {
    expect(decideExternalChange(facts({ document: '# A, mine\n' }))).toBe(
      'notice',
    )
  })

  it('treats a disk that holds the saved text as the app’s own write', () => {
    expect(
      decideExternalChange(
        facts({ disk: '# A\n', document: '# A, mine\n', savedText: '# A\n' }),
      ),
    ).toBe('settled')
  })

  it('ignores the text a Save is writing while it is still in flight', () => {
    expect(
      decideExternalChange(
        facts({
          disk: '# A, mine\n',
          document: '# A, mine\n',
          writing: '# A, mine\n',
        }),
      ),
    ).toBe('nothing')
  })

  it('does not take the in-flight write for an agent’s other text', () => {
    expect(
      decideExternalChange(
        facts({
          disk: '# A, by an agent\n',
          document: '# A, mine\n',
          writing: '# A, mine\n',
        }),
      ),
    ).toBe('notice')
  })

  it('adopts the disk when the dirty Document already holds the same text', () => {
    expect(
      decideExternalChange(
        facts({ disk: '# A, same\n', document: '# A, same\n' }),
      ),
    ).toBe('reload')
  })

  it('does not ask again about a disk text the user already answered', () => {
    expect(
      decideExternalChange(
        facts({
          document: '# A, mine\n',
          noticed: { disk: '# A, by an agent\n' },
        }),
      ),
    ).toBe('nothing')
  })

  it('asks again when the disk changes once more after the answer', () => {
    expect(
      decideExternalChange(
        facts({
          disk: '# A, by an agent, again\n',
          document: '# A, mine\n',
          noticed: { disk: '# A, by an agent\n' },
        }),
      ),
    ).toBe('notice')
  })

  it('leaves a clean Document alone after Keep mine on the same disk text', () => {
    expect(
      decideExternalChange(facts({ noticed: { disk: '# A, by an agent\n' } })),
    ).toBe('nothing')
  })

  it('tells about a file that is gone or unreadable, dirty or not', () => {
    expect(decideExternalChange(facts({ disk: null }))).toBe('notice')
    expect(
      decideExternalChange(facts({ disk: null, document: '# A, mine\n' })),
    ).toBe('notice')
  })

  it('does not repeat the notice about a file that stays gone', () => {
    expect(
      decideExternalChange(facts({ disk: null, noticed: { disk: null } })),
    ).toBe('nothing')
  })

  it('settles once the disk is back to the saved text', () => {
    expect(
      decideExternalChange(
        facts({ disk: '# A\n', noticed: { disk: '# A, by an agent\n' } }),
      ),
    ).toBe('settled')
  })
})
