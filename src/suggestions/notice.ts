import type { NoticeKind } from './types'

const MESSAGES: Readonly<Record<NoticeKind, string>> = {
  'text-changed': 'Suggestion discarded: the text changed',
  replaced: 'Suggestion discarded: replaced by your new request',
  'no-change': 'No change suggested',
}

export const noticeMessage = (kind: NoticeKind): string => MESSAGES[kind]
