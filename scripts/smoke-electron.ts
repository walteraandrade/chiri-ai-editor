import { spawn } from 'node:child_process'
import { findAppPage, isRendered } from './smoke.ts'

const PORT = 9333
const TIMEOUT_MS = 30_000
const POLL_MS = 500

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const targets = async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/json`)
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

const evaluate = (url: string, expression: string) =>
  new Promise<unknown>((resolve, reject) => {
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

const child = spawn(
  'electron',
  ['.', '--no-sandbox', `--remote-debugging-port=${PORT}`],
  { stdio: 'inherit', env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' } },
)

const run = async () => {
  const page = await waitForPage(Date.now() + TIMEOUT_MS)
  const rendered = await evaluate(
    page.webSocketDebuggerUrl,
    "document.querySelector('#root')?.childElementCount > 0",
  )
  if (!isRendered(rendered)) throw new Error('The window is blank')
  console.log('The built app opened a window with content.')
}

run()
  .then(() => child.kill())
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    child.kill()
    process.exitCode = 1
  })
