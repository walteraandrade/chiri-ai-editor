import type { ReactNode } from 'react'

type TitleBarProps = {
  readonly apple: boolean
  readonly children?: ReactNode
}

export function TitleBar({ apple, children }: TitleBarProps) {
  return (
    <div
      className="title-bar-drag fixed inset-x-0 top-0 z-50 flex h-(--title-bar-height) items-center border-hairline border-b bg-surface"
      data-apple={apple || undefined}
    >
      <div className="title-bar-commands relative flex h-full items-center">
        {children}
      </div>
    </div>
  )
}
