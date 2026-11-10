import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { nextEnabled } from './menu-nav'

export type MenuItem = {
  readonly label: string
  readonly shortcut?: string
  readonly disabled?: boolean
  readonly tone?: 'danger'
  readonly separated?: boolean
  readonly onSelect: () => void
}

export type Menu = {
  readonly label: string
  readonly items: readonly MenuItem[]
  readonly badge?: string
  readonly buttonRef?: RefObject<HTMLButtonElement | null>
}

type MenuBarProps = {
  readonly menus: readonly Menu[]
}

type OpenMenu = { readonly index: number; readonly active: number }

const MENU_KEYS = new Map<
  string,
  'down' | 'up' | 'next' | 'previous' | 'close' | 'leave'
>([
  ['ArrowDown', 'down'],
  ['ArrowUp', 'up'],
  ['ArrowRight', 'next'],
  ['ArrowLeft', 'previous'],
  ['Escape', 'close'],
  ['Tab', 'leave'],
])

const enabledOf = (menu: Menu): boolean[] =>
  menu.items.map((item) => item.disabled !== true)

export function MenuBar({ menus }: MenuBarProps) {
  const [open, setOpen] = useState<OpenMenu | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const baseId = useId()

  useEffect(() => {
    if (open === null) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (open !== null && open.active >= 0)
      itemRefs.current[open.active]?.focus()
  }, [open])

  const openAt = (index: number, focusFirst: boolean): void => {
    const menu = menus[index]
    if (menu === undefined) return
    setOpen({
      index,
      active: focusFirst ? nextEnabled(enabledOf(menu), -1, 1) : -1,
    })
  }

  const close = (focusButton: boolean): void => {
    const index = open?.index
    setOpen(null)
    if (focusButton && index !== undefined) buttonRefs.current[index]?.focus()
  }

  const select = (item: MenuItem): void => {
    if (item.disabled === true) return
    setOpen(null)
    item.onSelect()
  }

  const shift = (step: 1 | -1): void => {
    if (open === null) return
    const index = (open.index + step + menus.length) % menus.length
    openAt(index, true)
    buttonRefs.current[index]?.focus()
  }

  const onMenuKeyDown = (event: KeyboardEvent): void => {
    if (open === null) return
    const menu = menus[open.index]
    if (menu === undefined) return
    const move = (step: 1 | -1): void =>
      setOpen({
        ...open,
        active: nextEnabled(enabledOf(menu), open.active, step),
      })
    const action = MENU_KEYS.get(event.key)
    if (action === undefined) return
    if (action !== 'leave') event.preventDefault()
    event.stopPropagation()
    if (action === 'down') move(1)
    else if (action === 'up') move(-1)
    else if (action === 'next') shift(1)
    else if (action === 'previous') shift(-1)
    else close(action === 'close')
  }

  return (
    <div
      ref={rootRef}
      role="menubar"
      tabIndex={-1}
      aria-label="Application"
      className="flex h-full items-center"
      onKeyDown={onMenuKeyDown}
    >
      {menus.map((menu, index) => {
        const expanded = open?.index === index
        const menuId = `${baseId}-menu-${index}`
        return (
          <div key={menu.label} className="relative flex h-full items-center">
            <button
              ref={(node) => {
                buttonRefs.current[index] = node
                if (menu.buttonRef !== undefined) menu.buttonRef.current = node
              }}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={expanded}
              aria-controls={expanded ? menuId : undefined}
              className="menu-bar-button"
              onClick={() => (expanded ? setOpen(null) : openAt(index, false))}
              onPointerEnter={() => {
                if (open !== null && !expanded) openAt(index, false)
              }}
              onKeyDown={(event) => {
                if (expanded) return
                if (
                  event.key === 'ArrowDown' ||
                  event.key === 'Enter' ||
                  event.key === ' '
                ) {
                  event.preventDefault()
                  openAt(index, true)
                }
              }}
            >
              {menu.label}
              {menu.badge === undefined ? null : (
                <span className="menu-bar-badge">{menu.badge}</span>
              )}
            </button>
            {expanded ? (
              <div
                id={menuId}
                role="menu"
                aria-label={menu.label}
                className="menu-list popover-in"
              >
                {menu.items.map((item, itemIndex) => (
                  <button
                    key={item.label}
                    ref={(node) => {
                      itemRefs.current[itemIndex] = node
                    }}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    aria-disabled={item.disabled === true || undefined}
                    data-active={open?.active === itemIndex || undefined}
                    data-tone={item.tone}
                    data-separated={item.separated || undefined}
                    className="menu-item"
                    onPointerEnter={() =>
                      setOpen({
                        index,
                        active: item.disabled === true ? -1 : itemIndex,
                      })
                    }
                    onClick={() => select(item)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      event.stopPropagation()
                      select(item)
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut === undefined ? null : (
                      <kbd className="menu-item-shortcut">{item.shortcut}</kbd>
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
