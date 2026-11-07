import { type SummaryBaseline, TODAY_LABEL, versionLabel } from './baseline'
import type { Tally } from './report'
import type { HelpedOverall } from './signals'
import type { ReportPart } from './types'
import {
  type ArmLabels,
  countLabel,
  leftOutText,
  SKILL_ARMS,
  unpairedText,
} from './view'

export type RunCopy = {
  readonly intro: (caseCount: number, cliVersion: string) => string
  readonly stageNote: string | null
  readonly limitNote: string
  readonly todayTitle: string | null
  readonly olderTitle: string | null
}

const plural = (count: number): string => (count === 1 ? 'Eval' : 'Evals')

export const runCopy = (kind: 'none' | 'version'): RunCopy =>
  kind === 'none'
    ? {
        intro: (count, cli) =>
          `${count} ${plural(count)}, each run with and without the Skill, by the real agent through Claude CLI ${cli}.`,
        stageNote: null,
        limitNote: 'The CLI stops the run at the cost limit.',
        todayTitle: null,
        olderTitle: null,
      }
    : {
        intro: (count, cli) =>
          `${count} ${plural(count)}, each run with today's SKILL.md and with the Version, by the real agent through Claude CLI ${cli}.`,
        stageNote:
          "Two Stages run, one after the other. The older one has the Version's SKILL.md and today's other files, because History keeps only SKILL.md.",
        limitNote:
          'The cost limit covers both runs: the first gets half, the second what is left.',
        todayTitle: "Today's Stage",
        olderTitle: "The Version's Stage",
      }

export type SummaryView = {
  readonly labels: ArmLabels
  readonly columns: { readonly first: string; readonly second: string }
  readonly comparedNote: string | null
  readonly firedText: (first: Tally | null, second: Tally | null) => string
  readonly helpedText: (helped: HelpedOverall | null) => string
  readonly leftOut: (count: number) => string
  readonly reports: readonly ReportButton[]
  readonly firedSides: 1 | 2
}

export type ReportButton = {
  readonly part: ReportPart
  readonly label: string
}

const NOT_CHECKED = 'Not checked. No Eval has a tool_used Skill grader.'

export const summaryView = (
  baseline: SummaryBaseline,
  formatTime: (at: number) => string,
): SummaryView => {
  if (baseline.kind === 'none')
    return {
      labels: SKILL_ARMS,
      columns: { first: 'With', second: 'Without' },
      comparedNote: null,
      firedText: (first) =>
        first === null
          ? NOT_CHECKED
          : `${countLabel(first)} runs with the Skill`,
      helpedText: (helped) =>
        helped === null
          ? 'No run without the Skill to compare.'
          : `${countLabel(helped.with)} passes with, ${countLabel(helped.without)} without`,
      leftOut: leftOutText,
      reports: [{ part: 'today', label: 'Open report' }],
      firedSides: 1,
    }
  const labels = {
    first: TODAY_LABEL,
    second: versionLabel(baseline.at, formatTime),
  }
  return {
    labels,
    columns: { first: 'Today', second: 'Version' },
    comparedNote: `Compared ${labels.first} with ${labels.second}. The older Stage uses today's other files, because History keeps only SKILL.md.`,
    firedText: (first, second) =>
      first === null
        ? NOT_CHECKED
        : `${countLabel(first)} runs with ${labels.first}${second === null ? '' : `, ${countLabel(second)} with ${labels.second}`}`,
    helpedText: (helped) =>
      helped === null
        ? 'No Eval ran in both Stages to compare.'
        : `${countLabel(helped.with)} passes with ${labels.first}, ${countLabel(helped.without)} with ${labels.second}`,
    leftOut: unpairedText,
    reports: [
      { part: 'today', label: "Open today's report" },
      { part: 'version', label: "Open the Version's report" },
    ],
    firedSides: 2,
  }
}
