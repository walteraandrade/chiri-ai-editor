import { type ChildProcess, spawn } from 'node:child_process'

export type EvalJob = {
  readonly executable: string
  readonly args: readonly string[]
  readonly cwd: string
}

export type EvalExit = {
  readonly exitCode: number | null
  readonly signal: string | null
}

export type EvalRunner = {
  readonly version: (executable: string) => Promise<string | null>
  readonly run: (job: EvalJob) => Promise<EvalExit>
  readonly kill: () => boolean
}

export type RunnerEnv = {
  readonly home: string
  readonly path: string | undefined
}

const VERSION_TIMEOUT_MS = 10_000
const DEFAULT_KILL_AFTER_MS = 3000
const VERSION_PATTERN = /^\d+(\.\d+)+/

export const childEnv = ({
  home,
  path,
}: RunnerEnv): Record<string, string> => ({
  HOME: home,
  ...(path === undefined ? {} : { PATH: path }),
})

export type RunnerOptions = {
  readonly killAfterMs?: number
}

const signalGroup = (pid: number, signal: NodeJS.Signals): boolean => {
  try {
    process.kill(-pid, signal)
    return true
  } catch {
    return false
  }
}

export const createSpawnRunner = (
  env: RunnerEnv,
  { killAfterMs = DEFAULT_KILL_AFTER_MS }: RunnerOptions = {},
): EvalRunner => {
  let current: ChildProcess | null = null
  let killed = false
  return {
    version: (executable) =>
      new Promise((resolve) => {
        let output = ''
        const child = spawn(executable, ['--version'], {
          env: childEnv(env),
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: VERSION_TIMEOUT_MS,
        })
        child.stdout.on('data', (chunk: Buffer) => {
          output += chunk.toString('utf8')
        })
        child.on('error', () => resolve(null))
        child.on('close', (code) => {
          const version = VERSION_PATTERN.exec(output.trim())?.[0]
          resolve(code === 0 && version !== undefined ? version : null)
        })
      }),
    run: ({ executable, args, cwd }) =>
      new Promise((resolve, reject) => {
        const child = spawn(executable, [...args], {
          cwd,
          env: childEnv(env),
          stdio: 'ignore',
          detached: true,
        })
        current = child
        killed = false
        child.on('error', reject)
        child.on('close', (exitCode, signal) => {
          if (current === child) current = null
          if (killed && child.pid !== undefined)
            signalGroup(child.pid, 'SIGKILL')
          resolve({ exitCode, signal })
        })
      }),
    kill: () => {
      const pid = current?.pid
      if (pid === undefined) return false
      killed = true
      const sent = signalGroup(pid, 'SIGTERM')
      setTimeout(() => signalGroup(pid, 'SIGKILL'), killAfterMs).unref()
      return sent
    },
  }
}
