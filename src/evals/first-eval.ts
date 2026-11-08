export type ExampleFile = {
  readonly path: string
  readonly text: string
}

export type FirstEvalExample = {
  readonly tree: string
  readonly files: readonly ExampleFile[]
}

const EVAL_NAME = 'first-eval'
const FOLDER = `evals/${EVAL_NAME}`

const quoted = (value: string): string => `'${value.replaceAll("'", "''")}'`

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

const frontmatter = (
  fields: readonly (readonly [string, string])[],
  body: string,
): string =>
  [
    '---',
    ...fields.map(([key, value]) => `${key}: ${value}`),
    '---',
    '',
    body,
    '',
  ].join('\n')

const skillNamePattern = (skillName: string): string =>
  `[":]${escapeRegex(skillName)}"`

export const firstEvalExample = (
  skillName: string,
  folderName: string,
): FirstEvalExample => ({
  tree: [
    `${folderName}/${FOLDER}/`,
    '├── prompt.md       what a user would ask',
    '└── graders/',
    '    ├── fired.md    type: tool_used, did the Skill fire?',
    '    └── answer.md   type: regex, does the answer say it?',
  ].join('\n'),
  files: [
    {
      path: `${FOLDER}/prompt.md`,
      text: frontmatter(
        [
          ['max_turns', '10'],
          ['allowed_tools', '[Read, Glob, Grep, Skill]'],
        ],
        'Write the request a user would make that this Skill should handle.',
      ),
    },
    {
      path: `${FOLDER}/graders/fired.md`,
      text: frontmatter(
        [
          ['type', 'tool_used'],
          ['tool', 'Skill'],
          ['input_match', quoted(skillNamePattern(skillName))],
        ],
        'Passes when the agent loads this Skill.',
      ),
    },
    {
      path: `${FOLDER}/graders/answer.md`,
      text: frontmatter(
        [
          ['type', 'regex'],
          ['pattern', quoted('text the answer must contain')],
        ],
        'Passes when the last message matches the pattern.',
      ),
    },
  ],
})
