import { el } from './dom'

export const aiFlag = (
  extraClass = '',
  children: readonly Node[] = [],
): HTMLSpanElement =>
  el(
    'span',
    {
      class: `cm-ai-flag ${extraClass}`.trim(),
      attrs: { 'aria-hidden': 'true' },
    },
    [el('span', { class: 'cm-ai-flag-name' }, ['AI']), ...children],
  )
