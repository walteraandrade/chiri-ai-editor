import { join } from 'node:path'
import type { ExternalChanges } from '../../api'

export type WatchEvent = {
  readonly dir: string
  readonly eventType: string
  readonly filename: string | null
}

export type AwaitedNames = ReadonlyMap<string, ReadonlySet<string>>

export type ClassifyOptions = {
  readonly awaited?: AwaitedNames
  readonly limit?: number
}

export const MAX_REPORTED_PATHS = 200

const SKILL_FILE = 'SKILL.md'

export const isIgnoredName = (name: string): boolean =>
  name.startsWith('.') || name === 'node_modules'

const pathOf = ({ dir, filename }: WatchEvent): string =>
  filename === null ? dir : join(dir, filename)

const isRelevant = (
  event: WatchEvent,
  openFile: string | null,
  awaited: AwaitedNames,
): boolean =>
  event.filename === null ||
  !isIgnoredName(event.filename) ||
  pathOf(event) === openFile ||
  awaited.get(event.dir)?.has(event.filename) === true

const changesLibrary = ({ eventType, filename }: WatchEvent): boolean =>
  filename === null || eventType === 'rename' || filename === SKILL_FILE

const unique = (values: readonly string[]): readonly string[] => [
  ...new Set(values),
]

export const classifyEvents = (
  events: readonly WatchEvent[],
  openFile: string | null,
  { awaited = new Map(), limit = MAX_REPORTED_PATHS }: ClassifyOptions = {},
): ExternalChanges => {
  const relevant = events.filter((event) =>
    isRelevant(event, openFile, awaited),
  )
  const paths = unique(relevant.map(pathOf))
  return {
    paths:
      paths.length > limit ? unique(relevant.map(({ dir }) => dir)) : paths,
    library: relevant.some(changesLibrary),
  }
}
