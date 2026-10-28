type Child = Node | string

type Props = {
  readonly class?: string
  readonly attrs?: Readonly<Record<string, string>>
  readonly on?: {
    readonly [K in keyof HTMLElementEventMap]?: (
      event: HTMLElementEventMap[K],
    ) => void
  }
}

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  { class: className, attrs = {}, on = {} }: Props = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttribute(name, value)
  }
  for (const [name, handler] of Object.entries(on)) {
    node.addEventListener(name, handler as EventListener)
  }
  node.append(...children)
  return node
}
