import { useEffect, useRef } from 'react'
import { omarchyOption, type ThemeOption, themesOfMode } from '../theme/catalog'
import { OMARCHY_CHOICE, selectedOption } from '../theme/preference'
import { QuickActionsSettings } from './QuickActionsSettings'
import type { QuickActionsState } from './use-quick-actions'
import type { ThemeState } from './use-theme'

type PreferencesDialogProps = {
  readonly theme: ThemeState
  readonly quickActions: QuickActionsState
  readonly onClose: () => void
}

type ThemeRowProps = {
  readonly option: ThemeOption
  readonly checked: boolean
  readonly onChoose: (id: string) => void
}

function ThemeRow({ option, checked, onChoose }: ThemeRowProps) {
  return (
    <label className="theme-option">
      <input
        type="radio"
        name="theme"
        className="theme-option-mark"
        value={option.id}
        checked={checked}
        onChange={() => onChoose(option.id)}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ink-strong text-sm">
          {option.title}
        </span>
        <span className="block truncate text-ink-muted text-xs">
          {option.origin}
        </span>
      </span>
      <span className="flex shrink-0" aria-hidden="true">
        {option.colors.map((color) => (
          <span
            key={color.name}
            title={`${color.name} ${color.hex}`}
            className="h-5 w-3"
            style={{ backgroundColor: color.hex }}
          />
        ))}
      </span>
    </label>
  )
}

type ThemeGroupProps = {
  readonly label: string
  readonly options: readonly ThemeOption[]
  readonly selected: string
  readonly onChoose: (id: string) => void
}

function ThemeGroup({ label, options, selected, onChoose }: ThemeGroupProps) {
  return (
    <div>
      <h3 className="mt-4 mb-1 text-ink-muted text-xs uppercase tracking-widest">
        {label}
      </h3>
      {options.map((option) => (
        <ThemeRow
          key={option.id}
          option={option}
          checked={option.id === selected}
          onChoose={onChoose}
        />
      ))}
    </div>
  )
}

export function PreferencesDialog({
  theme,
  quickActions,
  onClose,
}: PreferencesDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const selected = selectedOption(theme.choice, theme.omarchy)

  useEffect(() => {
    const element = dialog.current
    if (element === null || element.open) return
    element.showModal()
    element.querySelector<HTMLInputElement>('input:checked')?.focus()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby="preferences-title"
      className="fixed top-0 right-0 bottom-0 left-auto m-0 flex h-full max-h-none w-[min(26rem,100vw)] flex-col border-hairline border-l bg-surface text-ink backdrop:bg-transparent"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <header className="flex items-center justify-between gap-2 border-hairline border-b px-5 py-4">
        <h2
          id="preferences-title"
          className="font-semibold text-base text-ink-strong"
        >
          Preferences
        </h2>
        <button type="button" className="cm-ai-button" onClick={onClose}>
          Done
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <fieldset>
          <legend className="pt-4 font-semibold text-ink-strong text-sm">
            Theme
          </legend>
          {theme.omarchy ? (
            <ThemeGroup
              label="This machine"
              options={[omarchyOption(OMARCHY_CHOICE, theme.omarchy)]}
              selected={selected}
              onChoose={theme.choose}
            />
          ) : null}
          <ThemeGroup
            label="Dark"
            options={themesOfMode('dark')}
            selected={selected}
            onChoose={theme.choose}
          />
          <ThemeGroup
            label="Light"
            options={themesOfMode('light')}
            selected={selected}
            onChoose={theme.choose}
          />
        </fieldset>
        <p className="mt-5 text-ink-muted text-xs">
          Colors come from A Dictionary of Color Combinations by Sanzo Wada
          (Seigensha), with data by Matt DesLauriers. Each palette joins two of
          the book's combinations, so the pairing is ours, not Wada's. Names are
          Duke Ellington compositions.
        </p>
        <QuickActionsSettings quickActions={quickActions} />
      </div>
    </dialog>
  )
}
