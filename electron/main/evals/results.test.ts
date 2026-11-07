import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createResultsStore, skillKeyOf } from './results'

const made: string[] = []

const store = () => {
  const dir = mkdtempSync(join(tmpdir(), 'chiri-results-test-'))
  made.push(dir)
  return { dir, results: createResultsStore(dir) }
}

const KEY = skillKeyOf('/skills/pdf')

afterEach(() => {
  for (const dir of made.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

describe('skillKeyOf', () => {
  it('hashes the real path', () => {
    expect(KEY).toMatch(/^[0-9a-f]{64}$/)
    expect(skillKeyOf('/a/pdf')).not.toBe(skillKeyOf('/b/pdf'))
  })
})

describe('createResultsStore', () => {
  it('writes a run under next/ of the skill key', async () => {
    const { dir, results } = store()
    const next = await results.begin(KEY)
    expect(next.jsonFile).toBe(
      join(dir, 'eval-runs', KEY, 'next', 'result.json'),
    )
    expect(next.outputDir).toBe(join(dir, 'eval-runs', KEY, 'next', 'report'))
  })

  it('has no last run before one is promoted', async () => {
    const { results } = store()
    expect(await results.readLast(KEY)).toBeNull()
    expect(await results.lastReport(KEY)).toBeNull()
  })

  it('promotes next to last and replaces the previous last', async () => {
    const { results } = store()
    const first = await results.begin(KEY)
    writeFileSync(first.jsonFile, 'one')
    mkdirSync(first.outputDir)
    writeFileSync(join(first.outputDir, 'report.html'), '<p>one</p>')
    await results.promote(KEY)
    expect((await results.readLast(KEY))?.firstText).toBe('one')
    const second = await results.begin(KEY)
    writeFileSync(second.jsonFile, 'two')
    await results.promote(KEY)
    expect((await results.readLast(KEY))?.firstText).toBe('two')
    expect(await results.lastReport(KEY)).toBeNull()
  })

  it('finds the report of the last run', async () => {
    const { dir, results } = store()
    const next = await results.begin(KEY)
    writeFileSync(next.jsonFile, '{}')
    mkdirSync(next.outputDir)
    writeFileSync(join(next.outputDir, 'report.html'), '<p>r</p>')
    await results.promote(KEY)
    const report = await results.lastReport(KEY)
    expect(report).toBe(
      join(dir, 'eval-runs', KEY, 'last', 'report', 'report.html'),
    )
    expect(readFileSync(report ?? '', 'utf8')).toBe('<p>r</p>')
  })

  it('leaves last alone when next is discarded', async () => {
    const { dir, results } = store()
    const first = await results.begin(KEY)
    writeFileSync(first.jsonFile, 'kept')
    await results.promote(KEY)
    const second = await results.begin(KEY)
    writeFileSync(second.jsonFile, 'dropped')
    await results.discard(KEY)
    expect((await results.readLast(KEY))?.firstText).toBe('kept')
    expect(existsSync(join(dir, 'eval-runs', KEY, 'next'))).toBe(false)
  })

  it('puts the last run back when promoting fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'chiri-results-test-'))
    made.push(dir)
    const failing = createResultsStore(dir, async (from, to) => {
      if (String(from).endsWith('next')) throw new Error('rename failed')
      return rename(from, to)
    })
    const first = await createResultsStore(dir).begin(KEY)
    writeFileSync(first.jsonFile, 'kept')
    await createResultsStore(dir).promote(KEY)
    const second = await failing.begin(KEY)
    writeFileSync(second.jsonFile, 'new')
    await expect(failing.promote(KEY)).rejects.toThrow('rename failed')
    expect((await failing.readLast(KEY))?.firstText).toBe('kept')
  })

  it('starts each run from an empty next', async () => {
    const { results } = store()
    const first = await results.begin(KEY)
    writeFileSync(first.jsonFile, 'stale')
    await results.begin(KEY)
    expect(await results.readNext(KEY)).toBeNull()
  })

  it('keeps the two reports of a Version run in separate folders with the baseline', async () => {
    const { dir, results } = store()
    await results.begin(KEY)
    const today = await results.beginPart(KEY, 'today')
    const older = await results.beginPart(KEY, 'version')
    expect(today.jsonFile).toBe(
      join(dir, 'eval-runs', KEY, 'next', 'today', 'result.json'),
    )
    expect(older.outputDir).toBe(
      join(dir, 'eval-runs', KEY, 'next', 'version', 'report'),
    )
    writeFileSync(today.jsonFile, 'T')
    writeFileSync(older.jsonFile, 'V')
    mkdirSync(today.outputDir)
    writeFileSync(join(today.outputDir, 'report.html'), '<p>t</p>')
    expect(await results.readNext(KEY, 'today')).toBe('T')
    expect(await results.readNext(KEY, 'version')).toBe('V')
    const baseline = '{"kind":"version","versionId":3,"at":9}'
    await results.writeBaseline(KEY, baseline)
    await results.promote(KEY)
    expect(await results.readLast(KEY)).toEqual({
      baselineText: baseline,
      firstText: 'T',
      secondText: 'V',
    })
    expect(await results.lastReport(KEY)).toBe(
      join(dir, 'eval-runs', KEY, 'last', 'today', 'report', 'report.html'),
    )
  })

  it('reads a run with no baseline file as a single report', async () => {
    const { results } = store()
    const next = await results.begin(KEY)
    writeFileSync(next.jsonFile, 'one')
    await results.promote(KEY)
    expect(await results.readLast(KEY)).toEqual({
      baselineText: null,
      firstText: 'one',
      secondText: null,
    })
  })
})
