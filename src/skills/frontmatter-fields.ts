import {
  Document,
  isCollection,
  isMap,
  isNode,
  isScalar,
  LineCounter,
  parseDocument,
  Scalar,
  type YAMLMap,
} from 'yaml'
import { type Frontmatter, findFrontmatter } from '../blocks/frontmatter'
import type { SkillField } from './skill-frontmatter'

export type FrontmatterProblemRule =
  | 'frontmatter-not-closed'
  | 'frontmatter-not-recognized'
  | 'yaml-syntax-error'
  | 'frontmatter-not-a-mapping'

export type FrontmatterProblem = {
  readonly rule: FrontmatterProblemRule
  readonly message: string
  readonly line?: number
  readonly column?: number
}

export type FrontmatterFields = Readonly<Record<string, unknown>>

export type SkillFieldValues = Readonly<Partial<Record<SkillField, string>>>

export type YamlFieldsReading =
  | { readonly ok: true; readonly fields: FrontmatterFields }
  | { readonly ok: false; readonly problem: FrontmatterProblem }

export type FrontmatterReading =
  | { readonly kind: 'absent' }
  | { readonly kind: 'present'; readonly fields: FrontmatterFields }
  | { readonly kind: 'invalid'; readonly problem: FrontmatterProblem }

export type FrontmatterEdit =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly problem: FrontmatterProblem }

type ParsedMapping =
  | {
      readonly ok: true
      readonly document: Document.Parsed
      readonly map: YAMLMap | null
    }
  | { readonly ok: false; readonly problem: FrontmatterProblem }

type FieldValue = readonly [SkillField, string]

type Located = {
  readonly value: unknown
  readonly keyEnd: number
  readonly valueEnd: number
}

type Edit = {
  readonly from: number
  readonly to: number
  readonly insert: string
}

type Carried = {
  readonly type?: Scalar.Type
  readonly comment?: string | null
  readonly commentBefore?: string | null
  readonly anchor?: string
}

const NOT_CLOSED: FrontmatterProblem = {
  rule: 'frontmatter-not-closed',
  message: 'frontmatter not closed',
}

const NOT_RECOGNIZED: FrontmatterProblem = {
  rule: 'frontmatter-not-recognized',
  message: 'frontmatter not recognized',
}

const NOT_A_MAPPING: FrontmatterProblem = {
  rule: 'frontmatter-not-a-mapping',
  message: 'frontmatter must be a mapping of keys to values',
}

const OPENING_DELIMITER = /^---[ \t]*\n/

const DELIMITED_BLOCK = /^---[ \t]*\n(?:[\s\S]*?\n)?---[ \t]*(?=\n|$)/

const UNICODE_LINE_BREAKS = /[\u0085\u2028\u2029]/g

const KEEP_CHOMPING_HEADER = /^[^\n:]+: [|>][^\s]*\+/

const FIELDS: readonly SkillField[] = ['name', 'description']

const lineNumberAt = (text: string, offset: number): number =>
  text.slice(0, offset).split('\n').length

const parseMapping = (yaml: string, firstLine: number): ParsedMapping => {
  const lineCounter = new LineCounter()
  const document = parseDocument(yaml, { lineCounter, prettyErrors: false })
  const [error] = document.errors
  if (error !== undefined) {
    const { line, col } = lineCounter.linePos(error.pos[0])
    return {
      ok: false,
      problem: {
        rule: 'yaml-syntax-error',
        message: error.message,
        line: line + firstLine - 1,
        column: col,
      },
    }
  }
  const { contents } = document
  return contents === null || isMap(contents)
    ? { ok: true, document, map: contents }
    : { ok: false, problem: NOT_A_MAPPING }
}

export const readYamlFields = (
  yaml: string,
  firstLine = 1,
): YamlFieldsReading => {
  const parsed = parseMapping(yaml, firstLine)
  if (!parsed.ok) return parsed
  try {
    return {
      ok: true,
      fields: parsed.map === null ? {} : parsed.document.toJS(),
    }
  } catch (error) {
    return {
      ok: false,
      problem: {
        rule: 'yaml-syntax-error',
        message: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

const closingLineStart = (text: string, { to }: Frontmatter): number =>
  text.lastIndexOf('\n', to - 1) + 1

const isUnclosed = (text: string): boolean => {
  if (!OPENING_DELIMITER.test(text)) return false
  const closed = `${text.replace(/\n+$/, '')}\n---`
  const found = findFrontmatter(closed)
  return (
    found !== undefined &&
    closed.slice(found.yamlFrom, found.yamlTo).trim() !== ''
  )
}

export const readFrontmatter = (text: string): FrontmatterReading => {
  const frontmatter = findFrontmatter(text)
  if (frontmatter === undefined)
    return isUnclosed(text)
      ? { kind: 'invalid', problem: NOT_CLOSED }
      : { kind: 'absent' }
  const reading = readYamlFields(
    text.slice(frontmatter.yamlFrom, closingLineStart(text, frontmatter)),
    lineNumberAt(text, frontmatter.yamlFrom),
  )
  return reading.ok
    ? { kind: 'present', fields: reading.fields }
    : { kind: 'invalid', problem: reading.problem }
}

const carriedFrom = (node: unknown): Carried =>
  isScalar(node)
    ? {
        type: node.type,
        comment: node.comment,
        commentBefore: node.commentBefore,
        anchor: node.anchor,
      }
    : isCollection(node)
      ? { anchor: node.anchor }
      : {}

const isBlockStyle = (type: Scalar.Type | undefined): type is Scalar.Type =>
  type === 'BLOCK_FOLDED' || type === 'BLOCK_LITERAL'

const styleFor = (
  value: string,
  previous: Scalar.Type | undefined,
): Scalar.Type =>
  isBlockStyle(previous)
    ? previous
    : value.includes('\n')
      ? 'BLOCK_LITERAL'
      : (previous ?? 'PLAIN')

const renderStyled = (
  [field, value]: FieldValue,
  style: Scalar.Type,
  { comment, commentBefore, anchor }: Carried,
  doubleQuotedAsJSON = false,
): string => {
  const scalar = new Scalar(value)
  scalar.type = style
  scalar.comment = comment
  scalar.commentBefore = commentBefore
  scalar.anchor = anchor
  return new Document({ [field]: scalar }).toString({
    lineWidth: 0,
    doubleQuotedAsJSON,
  })
}

const escapeUnicodeLineBreaks = (text: string): string =>
  text.replace(
    UNICODE_LINE_BREAKS,
    (character) =>
      `\\u${(character.codePointAt(0) ?? 0).toString(16).padStart(4, '0')}`,
  )

const isSafeToWrite = (
  rendered: string,
  [field, value]: FieldValue,
): boolean => {
  const document = parseDocument(rendered)
  return (
    document.errors.length === 0 &&
    document.get(field) === value &&
    !KEEP_CHOMPING_HEADER.test(rendered)
  )
}

const renderPair = (entry: FieldValue, previous?: unknown): string => {
  const carried = carriedFrom(previous)
  const preferred = renderStyled(
    entry,
    styleFor(entry[1], carried.type),
    carried,
  )
  return isSafeToWrite(preferred, entry)
    ? preferred
    : escapeUnicodeLineBreaks(
        renderStyled(entry, 'QUOTE_DOUBLE', carried, true),
      )
}

const locate = (
  map: YAMLMap | null,
  field: SkillField,
): Located | undefined => {
  const pair = map?.items.find(
    (item) => isScalar(item.key) && item.key.value === field,
  )
  const keyEnd = isScalar(pair?.key) ? pair.key.range?.[1] : undefined
  if (pair === undefined || keyEnd === undefined) return undefined
  const valueEnd = isNode(pair.value) ? pair.value.range?.[2] : undefined
  return { value: pair.value, keyEnd, valueEnd: valueEnd ?? keyEnd }
}

const lineEndAfter = (block: string, offset: number): number => {
  const index = block.indexOf('\n', Math.max(offset - 1, 0))
  return index === -1 ? block.length : index + 1
}

const replacement = (
  block: string,
  { value: previous, keyEnd, valueEnd }: Located,
  entry: FieldValue,
): readonly Edit[] => {
  const [field, value] = entry
  if (isScalar(previous) && previous.value === value) return []
  const rendered = renderPair(entry, previous).slice(field.length)
  const keepsLineEnd = block.slice(keyEnd, valueEnd).endsWith('\n')
  return [
    {
      from: keyEnd,
      to: valueEnd,
      insert: keepsLineEnd ? rendered : rendered.slice(0, -1),
    },
  ]
}

const insertion = (
  entries: readonly FieldValue[],
  at: number,
): readonly Edit[] =>
  entries.length === 0
    ? []
    : [
        {
          from: at,
          to: at,
          insert: entries.map((entry) => renderPair(entry)).join(''),
        },
      ]

const planEdits = (
  block: string,
  map: YAMLMap | null,
  entries: readonly FieldValue[],
): readonly Edit[] => {
  const name = locate(map, 'name')
  const targets = entries.map((entry) => ({
    entry,
    located: locate(map, entry[0]),
  }))
  const belongsAfterName = ([field]: FieldValue) =>
    field === 'description' && name !== undefined
  const missing = targets.flatMap(({ entry, located }) =>
    located === undefined ? [entry] : [],
  )
  return [
    ...targets.flatMap(({ entry, located }) =>
      located === undefined ? [] : replacement(block, located, entry),
    ),
    ...insertion(
      missing.filter((entry) => !belongsAfterName(entry)),
      0,
    ),
    ...insertion(
      missing.filter(belongsAfterName),
      name === undefined ? 0 : lineEndAfter(block, name.valueEnd),
    ),
  ]
}

const applyEdits = (block: string, edits: readonly Edit[]): string =>
  [...edits]
    .sort((a, b) => b.from - a.from)
    .reduce(
      (text, { from, to, insert }) =>
        text.slice(0, from) + insert + text.slice(to),
      block,
    )

const rewriteBlock = (
  block: string,
  map: YAMLMap | null,
  values: SkillFieldValues,
): string =>
  applyEdits(
    block,
    planEdits(
      block,
      map,
      FIELDS.flatMap((field): readonly FieldValue[] => {
        const value = values[field]
        return value === undefined ? [] : [[field, value]]
      }),
    ),
  )

const createFrontmatter = (
  text: string,
  values: SkillFieldValues,
): FrontmatterEdit => {
  const block = rewriteBlock('', null, values)
  if (block === '') return { ok: true, text }
  const separator = text === '' || text.startsWith('\n') ? '' : '\n'
  return { ok: true, text: `---\n${block}---\n${separator}${text}` }
}

export const setSkillFields = (
  text: string,
  values: SkillFieldValues,
): FrontmatterEdit => {
  const frontmatter = findFrontmatter(text)
  if (frontmatter === undefined)
    return isUnclosed(text)
      ? { ok: false, problem: NOT_CLOSED }
      : DELIMITED_BLOCK.test(text)
        ? { ok: false, problem: NOT_RECOGNIZED }
        : createFrontmatter(text, values)
  const blockEnd = closingLineStart(text, frontmatter)
  const block = text.slice(frontmatter.yamlFrom, blockEnd)
  const parsed = parseMapping(block, lineNumberAt(text, frontmatter.yamlFrom))
  return parsed.ok
    ? {
        ok: true,
        text:
          text.slice(0, frontmatter.yamlFrom) +
          rewriteBlock(block, parsed.map, values) +
          text.slice(blockEnd),
      }
    : parsed
}
