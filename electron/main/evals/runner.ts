import { spawn } from 'node:child_process'

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
}

export type RunnerEnv = {
  readonly home: string
  readonly path: string | undefined
}

const VERSION_TIMEOUT_MS = 10_000
const VERSION_PATTERN = /^\d+(\.\d+)+/

export const childEnv = ({
  home,
  path,
}: RunnerEnv): Record<string, string> => ({
  HOME: home,
  ...(path === undefined ? {} : { PATH: path }),
})

export const createSpawnRunner = (env: RunnerEnv): EvalRunner => ({
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
      })
      child.on('error', reject)
      child.on('close', (exitCode, signal) => resolve({ exitCode, signal }))
    }),
})
