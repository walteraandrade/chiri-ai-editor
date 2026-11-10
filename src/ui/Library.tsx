import {
  type KeyboardEvent,
  type ReactNode,
  type Ref as ReactRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { LibraryKit } from '../platform/kit'
import {
  ancestorIds,
  buildLibraryTree,
  openFileId,
  type TreeItem,
  type TreeNode,
  visibleItems,
} from '../skills/library-tree'
import { skillCount } from '../skills/library-view'
import { type TreeAction, treeKey } from '../skills/tree-keys'
import { LibrarySearch } from './LibrarySearch'
import type { LibraryPlacement } from './library-layout'
import type { LibraryControls } from './use-library'

export type LibraryHandle = {
  readonly focusTree: () => void
  readonly focusSearch: () => void
  readonly holdsFocus: () => boolean
}

type LibraryProps<Ref> = {
  readonly open: boolean
  readonly placement: LibraryPlacement
  readonly handleRef: ReactRef<LibraryHandle>
  readonly library: LibraryKit<Ref>
  readonly controls: LibraryControls
  readonly activeRef: Ref | null
  readonly onOpen: (ref: Ref, focusText: boolean) => Promise<void>
  readonly onOpenResult: (ref: Ref) => Promise<void>
  readonly onNewSkill: () => void
  readonly onEscape: () => void
  readonly onSearchBlur: (next: Element | null) => void
}

type Choices = Readonly<Record<string, boolean>>

const TYPE_AHEAD_MS = 700
const INDENT_PX = 12

const labelId = (id: string): string =>
  `library-label-${encodeURIComponent(id)}`

const detailId = (id: string): string =>
  `library-detail-${encodeURIComponent(id)}`

const noteId = (id: string): string => `library-note-${encodeURIComponent(id)}`

const caret = (item: TreeItem): string =>
  !item.expandable ? '' : item.expanded ? '▾' : '▸'

type RowProps = {
  readonly item: TreeItem
  readonly isActive: boolean
  readonly focused: boolean
  readonly noteOpen: boolean
  readonly holdsOpenFile: boolean
  readonly onRemove: (node: TreeNode) => void
}

function Row({
  item,
  isActive,
  focused,
  noteOpen,
  holdsOpenFile,
  onRemove,
}: RowProps) {
  const { node, level } = item
  const faint = node.kind === 'file' && node.openable !== true
  return (
    <div
      className={`group/row flex flex-col gap-0.5 py-1 pr-3 text-left ${
        focused
          ? 'bg-canvas outline outline-1 outline-accent -outline-offset-1'
          : isActive
            ? 'bg-canvas'
            : 'hover:bg-canvas'
      }`}
      style={{ paddingLeft: `${(level - 1) * INDENT_PX + 12}px` }}
      title={node.kind === 'file' ? node.path : undefined}
    >
      <span className="flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className={`w-2 shrink-0 text-xs ${holdsOpenFile ? 'text-accent' : 'text-ink-faint'}`}
        >
          {node.kind === 'file' ? (
            <span className={`block size-1.5 ${isActive ? 'bg-accent' : ''}`} />
          ) : (
            caret(item)
          )}
        </span>
        <span
          id={labelId(node.id)}
          className={`min-w-0 truncate ${
            node.kind === 'root'
              ? 'font-medium text-ink-muted text-xs'
              : node.kind === 'skill'
                ? `${node.problem === undefined ? 'text-ink-strong' : 'text-danger'} text-sm`
                : faint
                  ? 'text-ink-faint text-xs'
                  : `text-xs ${isActive ? 'font-medium text-ink-strong' : 'text-ink'}`
          }`}
        >
          {node.name}
        </span>
        {node.detail === undefined ? null : (
          <span
            id={detailId(node.id)}
            className="shrink-0 text-ink-faint text-xs"
          >
            · {node.detail}
          </span>
        )}
        {node.kind === 'root' && node.removable === true ? (
          <button
            type="button"
            tabIndex={-1}
            className="cm-ai-button cm-ai-button-sm cm-ai-button-icon ml-auto"
            aria-label={`Remove ${node.name} from the Library`}
            title="Remove from the Library. The folder stays on disk."
            onClick={(event) => {
              event.stopPropagation()
              onRemove(node)
            }}
          >
            ×
          </button>
        ) : null}
      </span>
      {node.kind === 'skill' ? (
        <span
          id={noteId(node.id)}
          className="skill-note pl-4"
          data-open={noteOpen || undefined}
        >
          <span className="min-h-0 overflow-hidden">
            {node.description === undefined ? null : (
              <span
                className="skill-note-text text-ink-muted text-xs"
                title={node.description}
              >
                {node.description}
              </span>
            )}
            {node.problem === undefined ? null : (
              <span className="block text-danger text-xs">
                Frontmatter: {node.problem.message}
              </span>
            )}
          </span>
        </span>
      ) : null}
    </div>
  )
}

export function Library<Ref>({
  open,
  placement,
  handleRef,
  library,
  controls: { state, refresh, addRoot, removeRoot },
  activeRef,
  onOpen,
  onOpenResult,
  onNewSkill,
  onEscape,
  onSearchBlur,
}: LibraryProps<Ref>) {
  const [choices, setChoices] = useState<Choices>({})
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [hotId, setHotId] = useState<string | null>(null)
  const [keyboardHot, setKeyboardHot] = useState(false)
  const lastItems = useRef<readonly TreeItem[]>([])
  const inTree = useRef(false)
  const typed = useRef('')
  const typedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const treeRef = useRef<HTMLDivElement>(null)
  const asideRef = useRef<HTMLElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const isActiveFile = (path: string): boolean =>
    activeRef !== null && library.toRef(path) === activeRef
  const roots = state.status === 'ready' ? state.roots : []
  const tree = useMemo(() => buildLibraryTree(roots), [roots])
  const holding = new Set(ancestorIds(tree, isActiveFile))
  const isExpanded = (node: TreeNode): boolean =>
    choices[node.id] ?? (node.kind === 'root' || holding.has(node.id))
  const items = visibleItems(tree, isExpanded)
  const itemsById = new Map(items.map((item) => [item.node.id, item]))
  const activeId = openFileId(tree, isActiveFile)
  const hasItem = (id: string | null | undefined): id is string =>
    id != null && items.some(({ node }) => node.id === id)
  const tabbableId = hasItem(focusedId)
    ? focusedId
    : hasItem(activeId)
      ? activeId
      : (items[0]?.node.id ?? null)

  useEffect(() => {
    if (activeId !== undefined) setFocusedId(null)
  }, [activeId])

  useEffect(() => {
    const previous = lastItems.current
    lastItems.current = items
    if (focusedId === null || itemsById.has(focusedId)) return
    const parents = new Map(
      previous.map(({ node, parentId }) => [node.id, parentId]),
    )
    const survivor = (id: string | null | undefined): string | undefined =>
      id == null
        ? undefined
        : itemsById.has(id)
          ? id
          : survivor(parents.get(id))
    const next = survivor(focusedId) ?? items[0]?.node.id
    if (next === undefined) return setFocusedId(null)
    if (inTree.current || document.activeElement === document.body)
      focusItem(next)
    else setFocusedId(next)
  })

  useImperativeHandle(handleRef, () => ({
    focusTree: () => {
      if (tabbableId !== null) focusItem(tabbableId)
      else addRef.current?.focus()
    },
    focusSearch: () => {
      searchRef.current?.focus()
      searchRef.current?.select()
    },
    holdsFocus: () =>
      asideRef.current?.contains(document.activeElement) ?? false,
  }))

  const focusItem = (id: string): void => {
    setFocusedId(id)
    treeRef.current
      ?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`)
      ?.focus()
  }

  const setExpanded = (id: string, expand: boolean): void =>
    setChoices((previous) => ({ ...previous, [id]: expand }))

  const openFile = (node: TreeNode, focusText: boolean): void => {
    if (node.path === undefined || node.openable !== true) return
    const opening = onOpen(library.toRef(node.path), focusText)
    void opening.then(() => {
      if (!focusText || document.activeElement === document.body)
        focusItem(node.id)
    })
  }

  const removeNode = (node: TreeNode): void => {
    if (node.path === undefined) return
    const at = tree.findIndex(({ id }) => id === node.id)
    const neighbor = (tree[at - 1] ?? tree[at + 1])?.id
    void removeRoot(node.path, node.name).then((removed) => {
      if (removed && neighbor !== undefined) focusItem(neighbor)
    })
  }

  const run = (action: TreeAction): void => {
    const node =
      action.kind === 'open' || action.kind === 'remove'
        ? itemsById.get(action.id)?.node
        : undefined
    if (action.kind === 'focus') focusItem(action.id)
    else if (action.kind === 'toggle') setExpanded(action.id, action.expand)
    else if (action.kind === 'open' && node !== undefined)
      openFile(node, action.focusText)
    else if (action.kind === 'remove' && node !== undefined) removeNode(node)
  }

  const onItemKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    id: string,
  ): void => {
    if (event.target !== event.currentTarget) return
    const result = treeKey(items, id, event, typed.current)
    typed.current = result.typed
    clearTimeout(typedTimer.current)
    typedTimer.current = setTimeout(() => {
      typed.current = ''
    }, TYPE_AHEAD_MS)
    if (result.handled) event.preventDefault()
    run(result.action)
  }

  const renderNodes = (nodes: readonly TreeNode[]): ReactNode =>
    nodes.map((node) => {
      const item = itemsById.get(node.id)
      if (item === undefined) return null
      const isActive = node.kind === 'file' && node.id === activeId
      return (
        <div
          key={node.id}
          role="treeitem"
          data-tree-id={node.id}
          tabIndex={node.id === tabbableId ? 0 : -1}
          aria-level={item.level}
          aria-expanded={item.expandable ? item.expanded : undefined}
          aria-current={isActive ? 'true' : undefined}
          aria-labelledby={
            node.detail === undefined
              ? labelId(node.id)
              : `${labelId(node.id)} ${detailId(node.id)}`
          }
          aria-describedby={
            node.kind === 'skill' &&
            (node.description !== undefined || node.problem !== undefined)
              ? noteId(node.id)
              : undefined
          }
          className="group/item cursor-default focus:outline-none"
          onKeyDown={(event) => onItemKeyDown(event, node.id)}
          onFocus={(event) => {
            if (event.target !== event.currentTarget) return
            inTree.current = true
            setFocusedId(node.id)
            setHotId(node.id)
            setKeyboardHot(event.currentTarget.matches(':focus-visible'))
          }}
          onBlur={(event) => {
            if (event.target !== event.currentTarget) return
            setHotId(null)
            if (!treeRef.current?.contains(event.relatedTarget))
              inTree.current = false
          }}
          onClick={(event) => {
            event.stopPropagation()
            const group = event.currentTarget.querySelector(
              ':scope > [role="group"]',
            )
            if (group?.contains(event.target as Node)) return
            if (node.kind === 'file') openFile(node, true)
            else if (item.expandable) setExpanded(node.id, !item.expanded)
          }}
        >
          <Row
            item={item}
            isActive={isActive}
            focused={hotId === node.id}
            noteOpen={item.expanded || (hotId === node.id && keyboardHot)}
            holdsOpenFile={holding.has(node.id) && node.kind === 'skill'}
            onRemove={removeNode}
          />
          {node.note !== undefined ? (
            <p className="px-3 py-1 text-ink-faint text-xs">{node.note}</p>
          ) : null}
          {item.expanded ? (
            // biome-ignore lint/a11y/useSemanticElements: a tree group is not a form fieldset
            <div role="group" className="tree-unfold">
              <div>{renderNodes(node.children)}</div>
            </div>
          ) : null}
        </div>
      )
    })

  return (
    <aside
      id="library-panel"
      ref={asideRef}
      tabIndex={-1}
      hidden={!open}
      aria-label="Library"
      className={`library-in flex h-(--app-height) w-72 shrink-0 flex-col bg-surface focus:outline-none ${
        placement === 'column'
          ? 'sticky top-(--title-bar-height)'
          : 'fixed top-(--title-bar-height) left-10 z-40 border-hairline border-r'
      }`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onEscape()
      }}
    >
      <div className="px-3 pt-6 pb-3">
        <h2 className="whitespace-nowrap font-display font-semibold text-ink-strong text-lg tracking-wide">
          Library
          {state.status === 'ready' ? (
            <span className="font-sans font-normal text-ink-faint text-xs">
              {' '}
              · {skillCount(state.roots)} skills
            </span>
          ) : null}
        </h2>
      </div>
      <LibrarySearch
        roots={roots}
        inputRef={searchRef}
        onOpen={(path) => onOpenResult(library.toRef(path))}
        onBlurTo={onSearchBlur}
      />
      <div className="flex items-center gap-1 px-3 pb-3 text-sm">
        <button
          type="button"
          className="cm-ai-button"
          title="Create a skill from a template"
          disabled={state.status !== 'ready'}
          onClick={onNewSkill}
        >
          New
        </button>
        <button
          type="button"
          className="cm-ai-button"
          title="Scan the folders again"
          onClick={() => void refresh()}
        >
          Refresh
        </button>
        <button
          ref={addRef}
          type="button"
          className="cm-ai-button"
          title="Add a project folder of skills, such as .claude/skills"
          onClick={() => void addRoot()}
        >
          Add
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {state.status === 'loading' ? (
          <p role="status" className="px-3 py-1 text-ink-faint text-xs">
            Reading the skill folders…
          </p>
        ) : null}
        {state.status === 'failed' ? (
          <p role="alert" className="px-3 py-1 text-danger text-xs">
            Could not read the skill folders.{' '}
            <button
              type="button"
              className="text-action"
              onClick={() => void refresh()}
            >
              Try again
            </button>
          </p>
        ) : null}
        {state.status === 'ready' && state.problem !== null ? (
          <p role="alert" className="px-3 py-1 text-danger text-xs">
            {state.problem}. Project folders are not listed, and Add and Remove
            are off until it is fixed or deleted in the app's user data folder.
          </p>
        ) : null}
        {tree.length === 0 ? null : (
          <div ref={treeRef} role="tree" aria-label="Skills">
            {renderNodes(tree)}
          </div>
        )}
      </div>
    </aside>
  )
}
