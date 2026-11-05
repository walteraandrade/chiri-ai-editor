import { z } from 'zod'
import type { CreateSkillRequest } from '../../../src/skills/library'
import { pathSchema } from '../files/requests'

const MAX_NAME_CHARS = 200

const request = z.strictObject({
  root: pathSchema,
  name: z
    .string()
    .min(1)
    .max(MAX_NAME_CHARS)
    .refine((name) => !name.includes('\0')),
})

export const parseCreateSkillRequest = (
  input: unknown,
): CreateSkillRequest | null => {
  const parsed = request.safeParse(input)
  return parsed.success ? parsed.data : null
}
