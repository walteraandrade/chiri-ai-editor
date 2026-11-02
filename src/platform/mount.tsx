import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { App } from '../ui/App'
import { StartError } from '../ui/StartError'
import type { PlatformKit, PlatformKitFactory } from './kit'
import { startWith } from './start'
import { startErrorMessage } from './start-error'

const rootElement = (): HTMLElement => {
  const root = document.getElementById('root')
  if (!root) throw new Error('Root element not found')
  return root
}

const render = <Ref,>(kit: PlatformKit<Ref>): void => {
  createRoot(rootElement()).render(
    <StrictMode>
      <App kit={kit} />
    </StrictMode>,
  )
}

const renderStartError = (error: unknown): void => {
  console.error('Failed to start', error)
  createRoot(rootElement()).render(
    <StartError message={startErrorMessage(error)} />,
  )
}

export const mountApp = <Ref,>(
  createKit: PlatformKitFactory<Ref>,
): Promise<void> => startWith(createKit, render).catch(renderStartError)
