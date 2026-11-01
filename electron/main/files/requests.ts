import { basename, isAbsolute } from 'node:path'
import { z } from 'zod'
import type { SaveFileAsRequest, SaveFileRequest } from '../../api'
import { MAX_FILE_BYTES } from './limits'

export const MAX_TEXT_CHARS = MAX_FILE_BYTES
const MAX_PATH_CHARS = 4096
const MAX_NAME_CHARS = 255

const withoutNul = (value: string): boolean => !value.includes('\0')

const pathSchema = z
  .string()
  .min(1)
  .max(MAX_PATH_CHARS)
  .refine(withoutNul)
  .refine(isAbsolute)

const textSchema = z.string().max(MAX_TEXT_CHARS)

const nameSchema = z
  .string()
  .max(MAX_NAME_CHARS * 4)
  .refine(withoutNul)
  .transform((name) => basename(name))
  .pipe(z.string().min(1).max(MAX_NAME_CHARS))

const saveSchema = z.strictObject({
  path: pathSchema,
  text: textSchema,
  expected: textSchema,
})

const saveAsSchema = z.strictObject({
  text: textSchema,
  suggestedName: nameSchema,
})

const valueOrNull = <T>(result: z.ZodSafeParseResult<T>): T | null =>
  result.success ? result.data : null

export const parsePathRequest = (input: unknown): string | null =>
  valueOrNull(pathSchema.safeParse(input))

export const parseSaveRequest = (input: unknown): SaveFileRequest | null =>
  valueOrNull(saveSchema.safeParse(input))

export const parseSaveAsRequest = (input: unknown): SaveFileAsRequest | null =>
  valueOrNull(saveAsSchema.safeParse(input))
