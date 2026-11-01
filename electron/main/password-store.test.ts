import { describe, expect, it } from 'vitest'
import { applyPasswordStore, PASSWORD_STORE_BACKEND } from './password-store'

const fakeCommandLine = (present: readonly string[] = []) => {
  const switches: [string, string][] = []
  return {
    switches,
    hasSwitch: (name: string) => present.includes(name),
    appendSwitch: (name: string, value: string) => {
      switches.push([name, value])
    },
  }
}

describe('applyPasswordStore', () => {
  it('pins gnome-libsecret on Linux', () => {
    const commandLine = fakeCommandLine()
    applyPasswordStore(commandLine, 'linux')
    expect(commandLine.switches).toEqual([
      ['password-store', PASSWORD_STORE_BACKEND],
    ])
    expect(PASSWORD_STORE_BACKEND).toBe('gnome-libsecret')
  })

  it('keeps a password-store the command line already sets', () => {
    const commandLine = fakeCommandLine(['password-store'])
    applyPasswordStore(commandLine, 'linux')
    expect(commandLine.switches).toEqual([])
  })

  it('does nothing outside Linux', () => {
    const commandLine = fakeCommandLine()
    applyPasswordStore(commandLine, 'darwin')
    applyPasswordStore(commandLine, 'win32')
    expect(commandLine.switches).toEqual([])
  })
})
