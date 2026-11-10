import type { ReactNode } from 'react'

type TitleBarProps = {
  readonly children?: ReactNode
}

export function TitleBar({ children }: TitleBarProps) {
  return (
    <div className="title-bar-drag fixed inset-x-0 top-0 z-50 flex h-(--title-bar-height) items-center justify-end border-hairline border-b bg-surface">
      <div className="title-bar-commands flex items-center gap-x-5">
        {children}
      </div>
    </div>
  )
}
