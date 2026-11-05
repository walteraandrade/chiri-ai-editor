import { createLazyModelClient } from './lazy-client'
import { MODEL_CHANGED_EVENT } from './model-choice'

export const appClient = createLazyModelClient(() =>
  import('./browser-client').then((module) =>
    module.createBrowserModelClient(),
  ),
)

window.addEventListener(MODEL_CHANGED_EVENT, () => appClient.reset())
