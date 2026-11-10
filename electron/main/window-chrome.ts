import type { BrowserWindowConstructorOptions } from 'electron'
import type { TitleBarColors } from '../api'

export const TITLE_BAR_HEIGHT = 36

const HEX_COLOR = /^#[0-9a-f]{6}$/i

const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && HEX_COLOR.test(value)

export const windowChrome = (
  platform: NodeJS.Platform,
  colors: TitleBarColors,
): BrowserWindowConstructorOptions =>
  platform === 'darwin'
    ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 12, y: 11 } }
    : {
        titleBarStyle: 'hidden',
        titleBarOverlay: { ...colors, height: TITLE_BAR_HEIGHT },
      }

export const parseTitleBarColors = (input: unknown): TitleBarColors | null => {
  if (typeof input !== 'object' || input === null) return null
  const { color, symbolColor } = input as Record<string, unknown>
  return isHexColor(color) && isHexColor(symbolColor)
    ? { color, symbolColor }
    : null
}
