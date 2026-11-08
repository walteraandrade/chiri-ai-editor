import { describe, expect, it } from 'vitest'
import { buildEvalArgs } from './command'

const input = {
  runs: 2,
  model: 'haiku',
  maxCostUsd: 0.5,
  jsonFile: '/data/next/result.json',
  outputDir: '/data/next/report',
}

describe('buildEvalArgs', () => {
  it('builds the fixed command line', () => {
    expect(buildEvalArgs(input)).toEqual([
      'plugin',
      'eval',
      '.',
      '--trust-plugin',
      '--no-publish',
      '--threshold',
      '0',
      '--max-cost-usd',
      '0.5',
      '--runs',
      '2',
      '--model=haiku',
      '--json',
      '/data/next/result.json',
      '--output-dir',
      '/data/next/report',
    ])
  })

  it('keeps the model in one argument', () => {
    expect(buildEvalArgs({ ...input, model: 'claude-haiku-4.5' })).toContain(
      '--model=claude-haiku-4.5',
    )
  })

  it('never grants tools, scaffolds, real servers or turns mocks off', () => {
    const args = buildEvalArgs(input).join(' ')
    for (const flag of [
      '--allow-tools',
      '--scaffold',
      '--allow-real-servers',
      '--mocks',
    ])
      expect(args).not.toContain(flag)
  })
})
