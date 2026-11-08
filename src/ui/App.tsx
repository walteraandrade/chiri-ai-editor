import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { resolveModel } from '../ai/default-model'
import type { DocumentControls } from '../editor/document-controls'
import {
  beforeReviewChanges,
  type ReviewControls,
} from '../editor/review-controls'
import { idleReviewStatus, type ReviewStatus } from '../editor/review-field'
import type { ReviewNotice } from '../editor/review-runtime'
import type { FailureNotice } from '../editor/suggestions'
import { endedText } from '../evals/ended'
import type { EvalRunResult } from '../evals/types'
import { storedIsUnsaved } from '../evals/unsaved'
import { applyHistoryEvent, type HistoryEvent } from '../history/events'
import { formatClock } from '../history/time'
import type { VersionSummary } from '../history/types'
import type { PlatformKit } from '../platform/kit'
import { problemMessage } from '../platform/problems'
import {
  describeFrontmatterProblem,
  reportProblems,
} from '../skills/frontmatter-panel'
import type { CreateSkillRequest, CreateSkillResult } from '../skills/library'
import {
  openSkillFile,
  skillFileLabel,
  skillOfFile,
} from '../skills/library-view'
import type { NewSkillOutcome } from '../skills/new-skill'
import { SKILL_FILE_NAME } from '../skills/scan-skills'
import type { SkillField } from '../skills/skill-frontmatter'
import { noticeMessage } from '../suggestions/notice'
import type { SuggestionNotice } from '../suggestions/types'
import { EditorPane } from './EditorPane'
import { EvalsPage } from './EvalsPage'
import { ExternalChangeNotice } from './ExternalChangeNotice'
import { FileControls } from './FileControls'
import { FileName } from './FileName'
import { FrontmatterPanel } from './FrontmatterPanel'
import { FullHistory } from './FullHistory'
import { Hint } from './Hint'
import { KeyDialog } from './KeyDialog'
import { LeaveDialog } from './LeaveDialog'
import { Library, type LibraryHandle } from './Library'
import { LibraryRail } from './LibraryRail'
import { LineDiff } from './LineDiff'
import {
  isEchoOfKey,
  isLibraryShortcut,
  isModalOpen,
  libraryKeyAnswer,
  railAnswer,
} from './library-fold'
import { libraryPlacement } from './library-layout'
import { MissingKeyBanner } from './MissingKeyBanner'
import { ModelDialog } from './ModelDialog'
import { NewSkillDialog } from './NewSkillDialog'
import { PreferencesDialog } from './PreferencesDialog'
import { detectApplePlatform } from './platform'
import { isPreferencesShortcut } from './preferences-shortcut'
import { ReviewToolbar } from './ReviewToolbar'
import { Timeline } from './Timeline'
import { Toast, type ToastAction, type ToastMessage } from './Toast'
import { useDescriptionAi } from './use-description-ai'
import { type EvalSkill, useEvalPanel } from './use-eval-panel'
import { useFrontmatterReport } from './use-frontmatter-report'
import { useHistoryView } from './use-history-view'
import { useKeyState } from './use-key-state'
import { useLeavePrompt } from './use-leave-prompt'
import { useLibrary } from './use-library'
import { useMarkdownFile } from './use-markdown-file'
import { useQuickActions } from './use-quick-actions'
import type { SkillUnsaved } from './use-skill-unsaved'
import { useTheme } from './use-theme'
import { useVersionTexts } from './use-version-texts'
import { useViewportWidth } from './use-viewport-width'
import { VersionBar } from './VersionBar'

type AppProps<Ref> = {
  readonly kit: PlatformKit<Ref>
}

export function App<Ref>({ kit }: AppProps<Ref>) {
  const {
    files,
    unsavedText,
    start,
    notice,
    history,
    problems,
    library,
    evals,
    external,
    launches,
    preferencesRequests,
    libraryRequests,
  } = kit
  const key = useKeyState(kit)
  const initialDoc = unsavedText.initial
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [modelOpen, setModelOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const descriptionAi = useDescriptionAi()
  const [review, setReview] = useState<ReviewStatus>(idleReviewStatus)
  const [controls, setControls] = useState<ReviewControls | null>(null)
  const [documentControls, setDocumentControls] =
    useState<DocumentControls | null>(null)
  const theme = useTheme()
  const toastId = useRef(0)
  const headerRef = useRef<HTMLElement>(null)
  const reviewTriggerRef = useRef<HTMLButtonElement>(null)
  const getTopInset = useCallback(
    () => headerRef.current?.getBoundingClientRect().bottom ?? 0,
    [],
  )
  const dismissToast = useCallback(() => setToast(null), [])

  const showToast = useCallback(
    (text: string, actions: readonly ToastAction[] = []) =>
      setToast({ id: ++toastId.current, text, actions }),
    [],
  )
  useEffect(() => {
    if (notice !== null) showToast(notice)
  }, [notice, showToast])
  useEffect(
    () => problems.subscribe((kind) => showToast(problemMessage(kind))),
    [problems, showToast],
  )
  const onNotice = useCallback(
    (notice: SuggestionNotice) => showToast(noticeMessage(notice.kind)),
    [showToast],
  )
  const onReviewNotice = useCallback(
    (notice: ReviewNotice) =>
      showToast(
        notice.text,
        notice.retry ? [{ label: 'Retry', run: notice.retry }] : [],
      ),
    [showToast],
  )
  const onFailure = useCallback(
    (notice: FailureNotice) =>
      showToast(notice.text, [
        { label: 'Retry', run: notice.retry },
        { label: 'Show', run: notice.show },
      ]),
    [showToast],
  )
  const onHistoryEvent = useCallback(
    (event: HistoryEvent) => applyHistoryEvent(history, event),
    [history],
  )
  const focusEditor = useCallback(
    () => documentControls?.focus(),
    [documentControls],
  )
  const closeHistoryRef = useRef<() => void>(() => undefined)
  const closeHistoryLater = useCallback(() => closeHistoryRef.current(), [])
  const leavePrompt = useLeavePrompt()
  const file = useMarkdownFile({
    files,
    unsavedText,
    start,
    external,
    controls: documentControls,
    history,
    notify: showToast,
    onReplaced: closeHistoryLater,
    askLeave: leavePrompt.ask,
  })
  const openLaunched = useEffectEvent((ref: Ref) => void file.openRef(ref))
  useEffect(() => launches?.subscribe(openLaunched), [launches])
  useEffect(
    () => preferencesRequests?.(() => setPreferencesOpen(true)),
    [preferencesRequests],
  )
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isPreferencesShortcut(event)) return
      event.preventDefault()
      setPreferencesOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  const libraryControls = useLibrary(library, showToast)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const libraryHandle = useRef<LibraryHandle>(null)
  const focusTreeWhenOpen = useRef(false)
  const viewportWidth = useViewportWidth()
  const placement = libraryPlacement(viewportWidth)
  const lastLibraryKeyAt = useRef<number | null>(null)
  const applyLibraryAnswer = useCallback(
    (answer: ReturnType<typeof libraryKeyAnswer>): void => {
      if (answer === 'open-and-focus') {
        focusTreeWhenOpen.current = true
        setLibraryOpen(true)
      } else if (answer === 'focus') libraryHandle.current?.focusTree()
      else {
        setLibraryOpen(false)
        focusEditor()
      }
    },
    [focusEditor],
  )
  const toggleLibrary = useEffectEvent(() =>
    applyLibraryAnswer(
      libraryKeyAnswer({
        open: libraryOpen,
        focused: libraryHandle.current?.holdsFocus() ?? false,
      }),
    ),
  )
  const requestLibrary = useEffectEvent(() => {
    if (isModalOpen(document)) return
    if (isEchoOfKey(lastLibraryKeyAt.current, Date.now())) return
    toggleLibrary()
  })
  const toggleLibraryFromRail = useCallback(
    () => applyLibraryAnswer(railAnswer(libraryOpen)),
    [applyLibraryAnswer, libraryOpen],
  )
  const foldOverlay = useCallback(() => {
    if (placement === 'overlay') setLibraryOpen(false)
  }, [placement])
  const focusTextFromLibrary = useCallback(() => {
    focusEditor()
    foldOverlay()
  }, [focusEditor, foldOverlay])
  useEffect(() => {
    if (!libraryOpen || !focusTreeWhenOpen.current) return
    focusTreeWhenOpen.current = false
    libraryHandle.current?.focusTree()
  }, [libraryOpen])
  useEffect(() => {
    if (library === undefined) return
    const apple = detectApplePlatform()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isLibraryShortcut(event, apple) || isModalOpen(document)) return
      event.preventDefault()
      event.stopPropagation()
      if (event.repeat) return
      lastLibraryKeyAt.current = Date.now()
      toggleLibrary()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [library])
  useEffect(() => libraryRequests?.(requestLibrary), [libraryRequests])
  const openRef = file.session?.ref ?? null
  const openSkill =
    library === undefined ||
    openRef === null ||
    libraryControls.state.status !== 'ready'
      ? undefined
      : skillOfFile(
          libraryControls.state.roots,
          (path) => library.toRef(path) === openRef,
        )
  const evalsAvailable = evals != null && openSkill !== undefined
  const historyView = useHistoryView(history, focusEditor, evalsAvailable)
  const { mode, versions, close: closeHistory } = historyView
  useEffect(() => {
    closeHistoryRef.current = closeHistory
  }, [closeHistory])
  const librarySkillFile =
    library === undefined ||
    openRef === null ||
    libraryControls.state.status !== 'ready'
      ? undefined
      : {
          label: skillFileLabel(
            libraryControls.state.roots,
            (path) => library.toRef(path) === openRef,
          ),
          file: openSkillFile(
            libraryControls.state.roots,
            (path) => library.toRef(path) === openRef,
          ),
        }
  const openDirty = file.session?.dirty ?? false
  const openSkillId = openSkill && {
    path: openSkill.realPath,
    name: openSkill.name,
  }
  const openSkillPath = useRef<string | undefined>(undefined)
  useEffect(() => {
    openSkillPath.current = openSkill?.realPath
  })
  const onEvalsEnded = (ended: EvalSkill, result: EvalRunResult): void => {
    const here = openSkill?.realPath === ended.path
    if (here && mode.kind === 'evals') return
    const show = (): void => {
      if (openSkillPath.current === ended.path) historyView.openEvals()
    }
    showToast(
      endedText(ended.name, result),
      here ? [{ label: 'Show', run: show }] : [],
    )
  }
  const evalPanel = useEvalPanel(evals ?? null, openSkillId ?? null, {
    onEnded: onEvalsEnded,
  })
  const busyName =
    evalPanel.busyWith === null || libraryControls.state.status !== 'ready'
      ? null
      : (libraryControls.state.roots
          .flatMap(({ skills }) => skills)
          .find(({ realPath }) => realPath === evalPanel.busyWith)?.name ??
        null)
  const skillUnsaved = useMemo<SkillUnsaved>(
    () => ({
      isOpen: (path) =>
        library !== undefined && library.toRef(path) === openRef,
      openDirty,
      hasStored: async (path) => {
        if (library === undefined) return false
        const ref = library.toRef(path)
        const stored = await unsavedText.offered(ref)
        if (stored === null) return false
        const disk = await files.read(ref).catch(() => null)
        return storedIsUnsaved(
          disk?.kind === 'opened' ? disk.file.text : null,
          stored,
        )
      },
    }),
    [library, openRef, openDirty, unsavedText, files],
  )
  const fileLabel = librarySkillFile?.label
  const frontmatterFileName =
    librarySkillFile?.file?.fileName ?? file.session?.name ?? null
  const frontmatterFolderName =
    frontmatterFileName !== SKILL_FILE_NAME
      ? undefined
      : (librarySkillFile?.file?.folderName ??
        (library === undefined || openRef === null
          ? undefined
          : library.folderNameOf(openRef)))
  const frontmatter = useFrontmatterReport(initialDoc, documentControls, {
    fileName: frontmatterFileName,
    folderName: frontmatterFolderName,
  })
  const refreshFrontmatter = frontmatter.refresh
  const frontmatterPanel = useRef<HTMLElement>(null)
  const { edited, openCreated, restore: restoreVersion } = file
  const onChange = useCallback(
    (text: string) => {
      edited(text)
      refreshFrontmatter(text)
    },
    [edited, refreshFrontmatter],
  )
  const frontmatterProblems = reportProblems(frontmatter.report)
  const editFrontmatter = useCallback(
    (field: SkillField, value: string) => {
      const plan = documentControls?.setSkillFields({ [field]: value })
      if (plan?.kind === 'refused')
        showToast(describeFrontmatterProblem(plan.problem))
    },
    [documentControls, showToast],
  )
  const showFrontmatterProblems = useCallback(() => {
    closeHistory()
    requestAnimationFrame(() => frontmatterPanel.current?.focus())
  }, [closeHistory])
  const [newSkillOpen, setNewSkillOpen] = useState(false)
  const textFocusFor = useRef<Ref | null>(null)
  const openFromLibrary = useCallback(
    async (ref: Ref, focusText: boolean): Promise<void> => {
      textFocusFor.current = focusText ? ref : null
      if (focusText && ref === openRef) {
        textFocusFor.current = null
        focusTextFromLibrary()
        return
      }
      await file.openRef(ref)
      textFocusFor.current = null
    },
    [file, openRef, focusTextFromLibrary],
  )
  useEffect(() => {
    if (openRef === null || textFocusFor.current !== openRef) return
    textFocusFor.current = null
    focusTextFromLibrary()
  }, [openRef, focusTextFromLibrary])
  const { createSkill: createLibrarySkill } = libraryControls
  const createSkill = useCallback(
    async (request: CreateSkillRequest): Promise<NewSkillOutcome> => {
      if (library === undefined)
        return { kind: 'failed', reason: 'No Library here' }
      const outcome = await openCreated<CreateSkillResult>(async () => {
        const result = await createLibrarySkill(request)
        return result.kind === 'created'
          ? {
              ref: library.toRef(result.path),
              value: result,
              label: result.name,
            }
          : { ref: null, value: result }
      })
      if (outcome.kind === 'stayed') return { kind: 'cancelled' }
      if (outcome.value.kind === 'created') {
        setNewSkillOpen(false)
        if (outcome.opened) showToast(`Created ${outcome.value.name}`)
      }
      return outcome.value
    },
    [createLibrarySkill, library, showToast, openCreated],
  )
  const quickActions = useQuickActions(kit.quickActions, () =>
    showToast('Quick actions could not be saved.'),
  )

  const shown =
    mode.kind === 'version'
      ? versions.find((version) => version.id === mode.id)
      : undefined
  const shownTexts = useVersionTexts(history.text, shown ? [shown.id] : null)
  const shownText = shownTexts?.[0]
  const currentText = documentControls?.text() ?? ''
  const reviewControls = useMemo(
    () => controls && beforeReviewChanges(controls, closeHistory),
    [controls, closeHistory],
  )

  const restore = useCallback(
    (version: VersionSummary, text: string): void => {
      if (!restoreVersion(version.id, text)) return
      showToast(
        `Restored the Version from ${formatClock(version.at, Date.now())}`,
      )
    },
    [restoreVersion, showToast],
  )
  const onReviewEnd = useCallback((revealed: boolean) => {
    if (!revealed && document.activeElement === document.body)
      reviewTriggerRef.current?.focus()
  }, [])

  const page = (
    <div className="min-h-screen">
      <header ref={headerRef} className="sticky top-0 z-30 bg-canvas">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 pt-6 pb-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="font-display font-semibold text-2xl text-ink-strong tracking-wide">
              Chiri
            </h1>
            {file.session ? (
              <FileName
                name={fileLabel ?? file.session.name}
                dirty={file.session.dirty}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
            <Hint />
            <FileControls
              disabled={documentControls === null}
              problems={frontmatterProblems}
              onOpen={file.open}
              onSave={file.save}
              onShowProblems={showFrontmatterProblems}
            />
            {evalsAvailable ? (
              <div className="text-sm">
                <button
                  type="button"
                  className="cm-ai-button"
                  title="How this Skill performs"
                  aria-pressed={mode.kind === 'evals'}
                  aria-busy={evalPanel.going !== null || undefined}
                  onClick={historyView.toggleEvals}
                >
                  Evals
                </button>
              </div>
            ) : null}
            {key.settings ? (
              <div className="text-sm">
                <button
                  type="button"
                  className="cm-ai-button"
                  title="OpenRouter key"
                  onClick={key.openDialog}
                >
                  Key
                </button>
              </div>
            ) : null}
            <ReviewToolbar
              status={review}
              controls={reviewControls}
              triggerRef={reviewTriggerRef}
            />
          </div>
        </div>
        {file.conflict ? (
          <ExternalChangeNotice
            name={file.conflict.name}
            onReload={file.reloadFromDisk}
            onKeep={file.keepMine}
          />
        ) : null}
        <Timeline
          versions={versions}
          mode={mode}
          highlighted={historyView.hovered}
          onDot={historyView.onDot}
          onNow={historyView.close}
          onToggleFull={historyView.toggleFull}
        />
        {shown ? (
          <VersionBar
            versions={versions}
            version={shown}
            text={shownText}
            currentText={currentText}
            onStep={historyView.step}
            onRestore={restore}
            onClose={historyView.close}
          />
        ) : null}
      </header>
      <main className="mx-auto max-w-3xl px-6 pt-4 pb-40">
        {shown && typeof shownText === 'string' ? (
          <LineDiff before={currentText} after={shownText} />
        ) : null}
        {mode.kind === 'full' ? (
          <FullHistory
            versions={versions}
            flashId={historyView.flashId}
            loadText={history.text}
            onHover={historyView.setHovered}
            onView={historyView.view}
          />
        ) : null}
        {mode.kind === 'evals' && openSkill ? (
          <EvalsPage
            skill={openSkill}
            busyName={busyName}
            panel={evalPanel}
            unsaved={skillUnsaved}
          />
        ) : null}
        <div hidden={mode.kind !== 'editing'}>
          <FrontmatterPanel
            report={frontmatter.report}
            disabled={documentControls === null}
            panelRef={frontmatterPanel}
            onEdit={editFrontmatter}
            onHistory={(command) => documentControls?.[command]()}
            descriptionAi={descriptionAi}
            readSkillText={() => documentControls?.text() ?? ''}
          />
          <EditorPane
            initialDoc={initialDoc}
            onChange={onChange}
            onNotice={onNotice}
            onFailure={onFailure}
            onReviewStatus={setReview}
            onReviewNotice={onReviewNotice}
            onReviewControls={setControls}
            onReviewEnd={onReviewEnd}
            onDocumentControls={setDocumentControls}
            onHistoryEvent={onHistoryEvent}
            getTopInset={getTopInset}
            quickActions={quickActions.enabled}
          />
        </div>
      </main>
      <div className="pointer-events-none sticky bottom-0 z-30">
        <div
          className={`pointer-events-auto mb-4 flex w-fit gap-2 bg-canvas text-sm ${
            libraryOpen && placement === 'overlay' ? 'ml-76' : 'ml-4'
          }`}
        >
          <button
            type="button"
            className="cm-ai-button"
            onClick={() => setPreferencesOpen(true)}
          >
            Preferences
          </button>
          <button
            type="button"
            className="cm-ai-button"
            onClick={() => setModelOpen(true)}
          >
            Model
          </button>
        </div>
        {key.present ? null : (
          <MissingKeyBanner onSetKey={key.settings && key.openDialog} />
        )}
      </div>
      {preferencesOpen ? (
        <PreferencesDialog
          theme={theme}
          quickActions={quickActions}
          onClose={() => setPreferencesOpen(false)}
        />
      ) : null}
      {modelOpen ? (
        <ModelDialog
          defaultModel={resolveModel(__OPENROUTER_MODEL__)}
          onClose={() => setModelOpen(false)}
          onSaved={showToast}
        />
      ) : null}
      <Toast message={toast} onDismiss={dismissToast} />
      {key.settings && key.state && key.dialogOpen ? (
        <KeyDialog
          settings={key.settings}
          state={key.state}
          onState={key.setState}
          onSaved={showToast}
          onClose={key.closeDialog}
        />
      ) : null}
      {leavePrompt.prompt === null ? null : (
        <LeaveDialog
          name={leavePrompt.prompt.name}
          onAnswer={leavePrompt.answer}
        />
      )}
    </div>
  )

  return library === undefined ? (
    page
  ) : (
    <div className="flex items-start">
      <LibraryRail open={libraryOpen} onToggle={toggleLibraryFromRail} />
      <Library
        open={libraryOpen}
        placement={placement}
        handleRef={libraryHandle}
        library={library}
        controls={libraryControls}
        activeRef={openRef}
        onOpen={openFromLibrary}
        onNewSkill={() => setNewSkillOpen(true)}
        onEscape={focusTextFromLibrary}
      />
      {newSkillOpen && libraryControls.state.status === 'ready' ? (
        <NewSkillDialog
          roots={libraryControls.state.roots}
          onCreate={createSkill}
          onClose={() => setNewSkillOpen(false)}
        />
      ) : null}
      <div className="min-w-0 flex-1">{page}</div>
    </div>
  )
}
