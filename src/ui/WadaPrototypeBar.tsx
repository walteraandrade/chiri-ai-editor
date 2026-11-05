import { useEffect } from 'react'
import {
  BASE_VARIANT,
  variantByKey,
  WADA_VARIANTS,
} from '../theme/wada-prototype'

type WadaPrototypeBarProps = {
  readonly current: string
  readonly onChange: (key: string) => void
}

const KEYS = [...WADA_VARIANTS.map((variant) => variant.key), BASE_VARIANT]

const typingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  target.closest('input, textarea, [contenteditable="true"]') !== null

const step = (current: string, by: number): string => {
  const index = Math.max(KEYS.indexOf(current), 0)
  return KEYS[(index + by + KEYS.length) % KEYS.length] ?? BASE_VARIANT
}

const arrowClass =
  'cursor-pointer border-0 bg-transparent px-2 py-1 text-[#f5f5f5] hover:bg-[#333]'

export function WadaPrototypeBar({ current, onChange }: WadaPrototypeBarProps) {
  const variant = variantByKey(current)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (typingTarget(event.target)) return
      if (event.key === 'ArrowLeft') onChange(step(current, -1))
      if (event.key === 'ArrowRight') onChange(step(current, 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, onChange])

  return (
    <div
      data-testid="wada-prototype-bar"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border border-[#555] bg-[#0a0a0a] px-1 py-1 text-xs text-[#f5f5f5] shadow-float"
    >
      <button
        type="button"
        className={arrowClass}
        aria-label="Previous combination"
        onClick={() => onChange(step(current, -1))}
      >
        ←
      </button>
      <span className="whitespace-nowrap">
        {KEYS.indexOf(current) + 1}/{KEYS.length}{' '}
        {variant
          ? `${variant.title} · ${variant.source} · ${variant.mode}`
          : 'Current theme'}
      </span>
      {variant ? (
        <span className="flex">
          {variant.colors.map((color) => (
            <span
              key={color.name}
              title={`${color.name} ${color.hex}`}
              className="h-4 w-4"
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </span>
      ) : null}
      <button
        type="button"
        className={arrowClass}
        aria-label="Next combination"
        onClick={() => onChange(step(current, 1))}
      >
        →
      </button>
    </div>
  )
}
