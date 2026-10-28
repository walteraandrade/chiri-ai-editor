import { z } from 'zod'

export const suggestionSchema = z.object({
  replacement: z
    .string()
    .describe(
      'The new text that replaces the Target, in Markdown, in the language of the Target.',
    ),
  rationale: z
    .string()
    .describe(
      'One short sentence explaining the change, in the language of the Document.',
    ),
})

export const reviewEditSchema = z.object({
  blockId: z.string().describe('The id of the Block to replace, such as "p3".'),
  replacement: z
    .string()
    .describe(
      'The complete new text of that Block, in Markdown, in the language of that Block.',
    ),
  rationale: z
    .string()
    .describe(
      'One short sentence explaining the change, in the language of the Document.',
    ),
})

export type SuggestionOutput = z.infer<typeof suggestionSchema>
export type ReviewEdit = z.infer<typeof reviewEditSchema>
