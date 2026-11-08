import { type RefObject, useLayoutEffect, useRef } from 'react'

const MOVE_MS = 260
const ENTER_MS = 260
const LEAVE_MS = 180
const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)'
const EASE_OUT_QUART = 'cubic-bezier(0.25, 1, 0.5, 1)'

const reducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const itemsOf = (
  root: HTMLElement,
  selector: string,
  key: string,
): ReadonlyMap<string, HTMLElement> =>
  new Map(
    [...root.querySelectorAll<HTMLElement>(selector)].flatMap((element) => {
      const id = element.dataset[key]
      return id === undefined ? [] : [[id, element] as const]
    }),
  )

const measure = (
  items: ReadonlyMap<string, HTMLElement>,
): ReadonlyMap<string, number> =>
  new Map([...items].map(([id, element]) => [id, element.offsetTop]))

const collapse = (element: HTMLElement): Promise<void> => {
  const { height } = element.getBoundingClientRect()
  element.style.overflow = 'hidden'
  return element
    .animate(
      [
        { height: `${height}px`, opacity: 1 },
        { height: '0px', opacity: 0, borderBottomWidth: '0px' },
      ],
      { duration: LEAVE_MS, easing: EASE_OUT_QUART, fill: 'forwards' },
    )
    .finished.then(() => undefined)
}

export type ListMotion = {
  readonly leave: (id: string) => Promise<void>
}

export function useListMotion(
  root: RefObject<HTMLElement | null>,
  selector: string,
  key: string,
): ListMotion {
  const tops = useRef<ReadonlyMap<string, number>>(new Map())

  useLayoutEffect(() => {
    const list = root.current
    if (list === null) return
    const items = itemsOf(list, selector, key)
    const previous = tops.current
    const next = measure(items)
    tops.current = next
    if (previous.size === 0 || reducedMotion()) return
    items.forEach((element, id) => {
      const before = previous.get(id)
      const after = next.get(id) ?? 0
      if (before === undefined) {
        element.animate(
          [
            { opacity: 0, transform: 'translateY(-6px)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: ENTER_MS, easing: EASE_OUT_EXPO },
        )
        return
      }
      const delta = before - after
      if (Math.abs(delta) < 1) return
      element.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: 'none' }],
        { duration: MOVE_MS, easing: EASE_OUT_EXPO },
      )
    })
  })

  const leave = async (id: string): Promise<void> => {
    const list = root.current
    if (list === null || reducedMotion()) return
    const items = itemsOf(list, selector, key)
    const element = items.get(id)
    if (element === undefined) return
    await collapse(element)
    tops.current = measure(
      new Map([...items].filter(([other]) => other !== id)),
    )
  }

  return { leave }
}
