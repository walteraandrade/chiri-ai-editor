import { EditorPane } from './EditorPane'
import { Hint } from './Hint'
import { MissingKeyBanner } from './MissingKeyBanner'

type AppProps = {
  readonly initialDoc: string
  readonly hasApiKey: boolean
  readonly onDocumentChange: (doc: string) => void
}

export function App({ initialDoc, hasApiKey, onDocumentChange }: AppProps) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 pt-8 pb-4">
        <h1 className="font-display font-semibold text-2xl text-ink-strong tracking-wide">
          Chiri
        </h1>
        <Hint />
      </header>
      <main className="mx-auto max-w-3xl px-6 pt-4 pb-40">
        <EditorPane initialDoc={initialDoc} onChange={onDocumentChange} />
      </main>
      {hasApiKey ? null : <MissingKeyBanner />}
    </div>
  )
}
