import { Compartment, type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'

const modeCompartment = new Compartment()

const documentIsDark = (): boolean =>
  document.documentElement.dataset.themeMode !== 'light'

const followDocumentMode = ViewPlugin.define((view) => {
  const sync = (): void => {
    const dark = documentIsDark()
    if (view.state.facet(EditorView.darkTheme) !== dark)
      view.dispatch({
        effects: modeCompartment.reconfigure(EditorView.darkTheme.of(dark)),
      })
  }
  const observer = new MutationObserver(sync)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme-mode'],
  })
  return { destroy: () => observer.disconnect() }
})

export const themeMode = (): Extension => [
  modeCompartment.of(EditorView.darkTheme.of(documentIsDark())),
  followDocumentMode,
]
