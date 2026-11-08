import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useMemo,
  useState,
} from 'react'
import type { LibraryListing } from '../skills/library'
import {
  type MatchRange,
  type SearchResult,
  searchLibrary,
} from '../skills/library-search'
import { searchKey } from '../skills/search-keys'
import { detectApplePlatform, formatShortcut } from './platform'

type LibrarySearchProps = {
  readonly roots: LibraryListing
  readonly inputRef: RefObject<HTMLInputElement | null>
  readonly onOpen: (path: string) => Promise<void>
  readonly onBlurTo: (next: Element | null) => void
}

const LIST_ID = 'library-search-list'

const optionId = (index: number): string => `library-search-option-${index}`

const marked = (text: string, range: MatchRange | null): ReactNode =>
  range === null ? (
    text
  ) : (
    <>
      {text.slice(0, range.start)}
      <mark>{text.slice(range.start, range.end)}</mark>
      {text.slice(range.end)}
    </>
  )

export function LibrarySearch({
  roots,
  inputRef,
  onOpen,
  onBlurTo,
}: LibrarySearchProps) {
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const [focused, setFocused] = useState(false)
  const results = useMemo(() => searchLibrary(roots, text), [roots, text])
  const searching = text.trim() !== ''
  const current = Math.min(active, Math.max(results.length - 1, 0))
  const showList = focused && results.length > 0
  const showEmpty = focused && searching && results.length === 0
  const apple = detectApplePlatform()
  const shortcut = formatShortcut('P', apple)

  const scrollTo = (index: number): void =>
    document
      .getElementById(optionId(index))
      ?.scrollIntoView({ block: 'nearest' })

  const open = (result: SearchResult | undefined): void => {
    if (result === undefined) return
    void onOpen(result.path).then(() => {
      if (document.activeElement === document.body) inputRef.current?.focus()
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) return
    const action = searchKey(event, {
      count: results.length,
      active: current,
      text,
    })
    if (action.kind === 'none') return
    if (action.kind === 'leave') return
    event.preventDefault()
    event.stopPropagation()
    if (action.kind === 'clear') {
      setText('')
      setActive(0)
    } else if (action.kind === 'move') {
      setActive(action.to)
      scrollTo(action.to)
    } else open(results[action.index])
  }

  return (
    <div className="px-3 pb-3">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search the Library"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={LIST_ID}
        aria-activedescendant={showList ? optionId(current) : undefined}
        aria-keyshortcuts={apple ? 'Meta+P' : 'Control+P'}
        title={`Search the Library (${shortcut})`}
        placeholder={`Search · ${shortcut}`}
        autoComplete="off"
        spellCheck={false}
        value={text}
        className="cm-ai-bubble-input w-full text-sm"
        onChange={(event) => {
          setText(event.target.value)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          setFocused(false)
          onBlurTo(event.relatedTarget)
        }}
      />
      <div className="mt-1 max-h-[60vh] overflow-y-auto">
        <div
          id={LIST_ID}
          role="listbox"
          aria-label="Search results"
          hidden={!showList}
          className="library-search-list"
        >
          {results.map((result, index) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input takes the keys
            <div
              key={result.id}
              id={optionId(index)}
              role="option"
              tabIndex={-1}
              aria-selected={index === current}
              className="library-search-item"
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => {
                if (index !== current) setActive(index)
              }}
              onClick={() => open(result)}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 text-sm [overflow-wrap:anywhere]">
                  {marked(result.label, result.labelMatch)}
                </span>
                {result.kind === 'skill' ? (
                  <span className="library-search-tag">Skill</span>
                ) : null}
              </span>
              {result.context === undefined ? null : (
                <span className="library-search-context">
                  in {result.context}
                </span>
              )}
              {result.detail === undefined ? null : (
                <span className="library-search-detail">
                  {marked(result.detail, result.detailMatch)}
                </span>
              )}
            </div>
          ))}
        </div>
        {showEmpty ? (
          <p role="status" className="library-search-empty">
            No Skill or file matches “{text.trim()}”
          </p>
        ) : null}
      </div>
    </div>
  )
}
