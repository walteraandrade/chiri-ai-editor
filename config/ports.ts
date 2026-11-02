const MAX_PORT = 65535

export const parsePort = (
  name: string,
  raw: string | undefined,
): number | undefined => {
  const text = raw?.trim() ?? ''
  if (text === '') return undefined
  const port = /^\d+$/.test(text) ? Number(text) : Number.NaN
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT)
    throw new Error(`${name} must be an integer from 1 to ${MAX_PORT}`)
  return port
}

export const devServerOptions = (
  env: Readonly<Record<string, string | undefined>>,
): { readonly port?: number; readonly strictPort?: boolean } => {
  const port = parsePort('CHIRI_DEV_PORT', env.CHIRI_DEV_PORT)
  return port === undefined ? {} : { port, strictPort: true }
}
