import { useCallback, useEffect, useRef, useState } from 'react'
import { filesWithUnsavedText } from '../evals/unsaved'
import type { Skill } from '../skills/scan-skills'

export type SkillUnsaved = {
  readonly isOpen: (path: string) => boolean
  readonly openDirty: boolean
  readonly hasStored: (path: string) => Promise<boolean>
}

export const useSkillUnsaved = (skill: Skill, unsaved: SkillUnsaved) => {
  const [names, setNames] = useState<readonly string[]>([])
  const latest = useRef(0)

  const check = useCallback(async () => {
    const load = ++latest.current
    const markdown = skill.files.filter(({ isMarkdown }) => isMarkdown)
    const stored = new Set(
      (
        await Promise.all(
          markdown.map(async ({ path }) =>
            (await unsaved.hasStored(path)) ? [path] : [],
          ),
        )
      ).flat(),
    )
    if (load !== latest.current) return
    const paths = filesWithUnsavedText({
      files: markdown.map(({ path }) => path),
      isOpen: unsaved.isOpen,
      openDirty: unsaved.openDirty,
      stored,
    })
    setNames(
      markdown
        .filter(({ path }) => paths.includes(path))
        .map(({ name }) => name),
    )
  }, [skill.files, unsaved])

  useEffect(() => {
    void check()
  }, [check])

  return { names, check }
}
