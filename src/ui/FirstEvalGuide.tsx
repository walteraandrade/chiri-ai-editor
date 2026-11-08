import { firstEvalExample } from '../evals/first-eval'

type FirstEvalGuideProps = {
  readonly skillName: string
  readonly folderName: string
  readonly onCheck: () => void
}

const CODE =
  'mt-1 overflow-x-auto border border-hairline bg-raised px-3 py-2 font-mono text-xs leading-relaxed'

export function FirstEvalGuide({
  skillName,
  folderName,
  onCheck,
}: FirstEvalGuideProps) {
  const { tree, files } = firstEvalExample(skillName, folderName)
  return (
    <section aria-labelledby="first-eval-title" className="mt-6">
      <h3
        id="first-eval-title"
        className="font-semibold text-base text-ink-strong"
      >
        This Skill has no Evals yet
      </h3>
      <p className="mt-2">
        An Eval is a folder you write by hand under the Skill's{' '}
        <code className="font-mono">evals/</code>. An Eval run sends its{' '}
        <code className="font-mono">prompt.md</code> to the agent in two Arms,
        with the Skill and without it, and the files in{' '}
        <code className="font-mono">graders/</code> score each answer.
      </p>
      <pre className={CODE}>{tree}</pre>
      {files.map(({ path, text }) => (
        <div key={path} className="mt-4">
          <p className="font-mono text-ink-muted text-xs">{path}</p>
          <pre className={CODE}>{text}</pre>
        </div>
      ))}
      <p className="mt-4">
        Reach for the free graders first:{' '}
        <code className="font-mono">regex</code>,{' '}
        <code className="font-mono">tool_used</code>,{' '}
        <code className="font-mono">tool_order</code> and{' '}
        <code className="font-mono">file_exists</code> cost nothing and give the
        same verdict every time. An <code className="font-mono">llm</code>{' '}
        grader calls a judge 3 times per run, so keep it for short answers.
      </p>
      <p className="mt-4 flex flex-wrap items-center gap-2">
        <span>Save the files, then check again.</span>
        <button type="button" className="cm-ai-button" onClick={onCheck}>
          Check again
        </button>
      </p>
    </section>
  )
}
