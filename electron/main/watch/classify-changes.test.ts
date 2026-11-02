import { describe, expect, it } from 'vitest'
import { classifyEvents, type WatchEvent } from './classify-changes'

const event = (
  filename: string | null,
  eventType = 'change',
  dir = '/skills/pdf',
): WatchEvent => ({ dir, eventType, filename })

describe('classifyEvents', () => {
  it('reports the path of a file whose content changed, without touching the Library', () => {
    expect(classifyEvents([event('guide.md')], null)).toEqual({
      paths: ['/skills/pdf/guide.md'],
      library: false,
    })
  })

  it('tells the Library when an entry appears, disappears or is renamed', () => {
    expect(classifyEvents([event('new.md', 'rename')], null).library).toBe(true)
  })

  it('tells the Library when a SKILL.md changes, since its name and description show there', () => {
    expect(classifyEvents([event('SKILL.md')], null).library).toBe(true)
  })

  it('ignores hidden entries such as the temporary file of an atomic write', () => {
    expect(
      classifyEvents(
        [
          event('.SKILL.md.3f2a.tmp', 'rename'),
          event('.SKILL.md.3f2a.tmp'),
          event('.swp'),
          event('node_modules', 'rename'),
        ],
        null,
      ),
    ).toEqual({ paths: [], library: false })
  })

  it('still sees the rename that gives the atomic write its final name', () => {
    expect(
      classifyEvents(
        [event('.SKILL.md.3f2a.tmp', 'rename'), event('SKILL.md', 'rename')],
        null,
      ),
    ).toEqual({ paths: ['/skills/pdf/SKILL.md'], library: true })
  })

  it('keeps events for the open file even if its name is hidden', () => {
    expect(
      classifyEvents([event('.notes.md')], '/skills/pdf/.notes.md'),
    ).toEqual({ paths: ['/skills/pdf/.notes.md'], library: false })
  })

  it('reports the folder, and the Library, when the name is unknown', () => {
    expect(classifyEvents([event(null)], null)).toEqual({
      paths: ['/skills/pdf'],
      library: true,
    })
  })

  it('lists a path once however many events named it', () => {
    expect(
      classifyEvents([event('a.md'), event('a.md'), event('b.md')], null).paths,
    ).toEqual(['/skills/pdf/a.md', '/skills/pdf/b.md'])
  })

  it('has nothing to say about no events', () => {
    expect(classifyEvents([], null)).toEqual({ paths: [], library: false })
  })

  it('collapses a burst of paths to their folders, so the open file is still covered', () => {
    const burst = Array.from({ length: 250 }, (_, index) =>
      event(`f${index}.md`, 'change', index % 2 === 0 ? '/a' : '/b'),
    )
    const { paths } = classifyEvents(burst, null, 200)
    expect(paths).toEqual(['/a', '/b'])
  })
})
