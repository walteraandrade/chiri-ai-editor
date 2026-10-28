import {
  createModelClient,
  type ModelClient,
  type ModelClientConfig,
} from './client'
import { resolveModel } from './default-model'
import { type AiCallLogTarget, appendAiCall } from './dev-log'

export const BROWSER_PLACEHOLDER_KEY = 'browser-placeholder-key'

export const browserClientConfig = ({
  origin,
  configuredModel,
  dev,
  logTarget,
}: {
  readonly origin: string
  readonly configuredModel: string | undefined
  readonly dev: boolean
  readonly logTarget: AiCallLogTarget
}): ModelClientConfig => ({
  baseURL: `${origin}/api/openrouter`,
  apiKey: BROWSER_PLACEHOLDER_KEY,
  model: resolveModel(configuredModel),
  ...(dev ? { onRecord: (record) => appendAiCall(logTarget, record) } : {}),
})

export const createBrowserModelClient = (): ModelClient =>
  createModelClient(
    browserClientConfig({
      origin: window.location.origin,
      configuredModel: __OPENROUTER_MODEL__,
      dev: import.meta.env.DEV,
      logTarget: window,
    }),
  )
