import { createLazyModelClient } from './lazy-client'
import { MODEL_CHANGED_EVENT } from './model-choice'

export const appClient = createLazyModelClient(() =>
  import.meta.env.DEV
    ? import('./wada-prototype-client').then(
        (module) => module.wadaPrototypeClient,
      )
    : import('./browser-client').then((module) =>
        module.createBrowserModelClient(),
      ),
)

window.addEventListener(MODEL_CHANGED_EVENT, () => appClient.reset())
