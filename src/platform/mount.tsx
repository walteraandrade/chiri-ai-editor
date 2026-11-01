import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { App } from '../ui/App'
import type { PlatformKit, PlatformKitFactory } from './kit'
import { startWith } from './start'

const render = (kit: PlatformKit): void => {
  const root = document.getElementById('root')
  if (!root) throw new Error('Root element not found')
  createRoot(root).render(
    <StrictMode>
      <App kit={kit} />
    </StrictMode>,
  )
}

export const mountApp = (createKit: PlatformKitFactory): Promise<void> =>
  startWith(createKit, render)
