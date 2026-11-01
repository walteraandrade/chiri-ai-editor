import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { App } from '../ui/App'
import type { PlatformKit } from './kit'

export const mountApp = (kit: PlatformKit): void => {
  const root = document.getElementById('root')
  if (!root) throw new Error('Root element not found')
  createRoot(root).render(
    <StrictMode>
      <App kit={kit} />
    </StrictMode>,
  )
}
