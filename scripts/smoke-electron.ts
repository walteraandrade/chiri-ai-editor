import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { findAppPage, isRendered } from './smoke.ts'

const HOST = '127.0.0.1'
const PORT = 9333
const TIMEOUT_MS = 30_000
const POLL_MS = 500

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const targets = async () => {
  try {
    const response = await fetch(`http://${HOST}:${PORT}/json`)
    return response.ok ? await response.json() : []
  } catch {
    return []
  }
}

const waitForPage = async (deadline: number) => {
  const page = findAppPage(await targets())
  if (page !== undefined) return page
  if (Date.now() > deadline) throw new Error('No app:// window within 30 s')
  await sleep(POLL_MS)
  return waitForPage(deadline)
}

const isLocalDebuggerUrl = (value: string): boolean => {
  const url = URL.canParse(value) ? new URL(value) : null
  return (
    url !== null &&
    url.protocol === 'ws:' &&
    url.hostname === HOST &&
    url.port === String(PORT)
  )
}

const evaluate = (url: string, expression: string) =>
  new Promise<unknown>((resolve, reject) => {
    if (!isLocalDebuggerUrl(url)) {
      reject(new Error(`Refusing non-local debugger URL: ${url}`))
      return
    }
    const socket = new WebSocket(url)
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true },
        }),
      )
    socket.onmessage = (event) => {
      socket.close()
      resolve(JSON.parse(String(event.data)).result?.result?.value)
    }
    socket.onerror = () => reject(new Error('CDP connection failed'))
  })

const electronBinary = resolve('node_modules', '.bin', 'electron')

const child = spawn(
  electronBinary,
  ['.', '--no-sandbox', `--remote-debugging-port=${PORT}`],
  { stdio: 'inherit', env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' } },
)

const waitForRender = async (url: string, deadline: number): Promise<void> => {
  const rendered = await evaluate(
    url,
    "document.querySelector('#root')?.childElementCount > 0",
  ).catch(() => false)
  if (isRendered(rendered)) return
  if (Date.now() > deadline) throw new Error('The window is blank')
  await sleep(POLL_MS)
  return waitForRender(url, deadline)
}

const run = async () => {
  const deadline = Date.now() + TIMEOUT_MS
  const page = await waitForPage(deadline)
  await waitForRender(page.webSocketDebuggerUrl, deadline)
  console.log('The built app opened a window with content.')
}

run()
  .then(() => child.kill())
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    child.kill()
    process.exitCode = 1
  })
