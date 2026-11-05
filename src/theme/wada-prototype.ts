// PROTOTYPE, throwaway: five combinations from A Dictionary of Color Combinations as Chiri themes, switchable via ?variant=.
import type { ThemeTokens } from './tokens'

export type WadaColor = {
  readonly name: string
  readonly hex: string
}

export type WadaVariant = {
  readonly key: string
  readonly source: string
  readonly colors: readonly WadaColor[]
  readonly theme: ThemeTokens
}

export const BASE_VARIANT = 'base'

export const WADA_VARIANTS: readonly WadaVariant[] = [
  {
    key: 'vol1-62',
    source: 'Vol. 1, #62',
    colors: [
      { name: 'Yellow', hex: '#fff200' },
      { name: 'Black', hex: '#111314' },
    ],
    theme: {
      name: 'wada-vol1-62',
      mode: 'dark',
      bg: '#111314',
      raised: '#26271f',
      ink: '#f5f3e4d1',
      inkStrong: '#f5f3e4',
      accent: '#fff200',
      ai: '#fff200',
      danger: null,
      selection: '#fff20040',
    },
  },
  {
    key: 'vol1-102',
    source: 'Vol. 1, #102',
    colors: [
      { name: 'Ivory Buff', hex: '#ebd3a2' },
      { name: 'Orange Rufous', hex: '#c16b27' },
    ],
    theme: {
      name: 'wada-vol1-102',
      mode: 'dark',
      bg: '#211207',
      raised: '#3a2411',
      ink: '#ebd3a2e0',
      inkStrong: '#ebd3a2',
      accent: '#d9843e',
      ai: '#c16b27',
      danger: null,
      selection: '#c16b2750',
    },
  },
  {
    key: 'vol1-160',
    source: 'Vol. 1, #160',
    colors: [
      { name: 'Sulphine Yellow', hex: '#c19f2c' },
      { name: 'Pale Raw Umber', hex: '#71502f' },
      { name: 'Dark Medici Blue', hex: '#547076' },
    ],
    theme: {
      name: 'wada-vol1-160',
      mode: 'dark',
      bg: '#121a1c',
      raised: '#33291c',
      ink: '#eef1ead6',
      inkStrong: '#eef1ea',
      accent: '#8fb0b8',
      ai: '#c19f2c',
      danger: null,
      selection: '#54707680',
    },
  },
  {
    key: 'vol2-january',
    source: 'Vol. 2, January',
    colors: [
      { name: 'Seashell Pink', hex: '#fbdcc4' },
      { name: 'White', hex: '#ffffff' },
      { name: 'Sulphur Yellow', hex: '#f8f2c8' },
      { name: 'Glaucous Green', hex: '#bed4c7' },
      { name: 'Grayish Lavender', hex: '#c7b0b8' },
    ],
    theme: {
      name: 'wada-vol2-january',
      mode: 'light',
      bg: '#fbdcc4',
      raised: '#ffffff',
      ink: '#140a0fe6',
      inkStrong: '#140a0f',
      accent: '#35614f',
      ai: '#8a3f63',
      danger: '#a3232f',
      selection: '#bed4c7cc',
    },
  },
  {
    key: 'vol2-tapestry',
    source: 'Vol. 2, Tapestry, Carpets',
    colors: [
      { name: "Hay's Russet", hex: '#833121' },
      { name: 'Pale Raw Umber', hex: '#7a5329' },
      { name: 'Yellow Orange', hex: '#f5a100' },
      { name: 'Laelia Pink', hex: '#cf97ab' },
      { name: 'Etruscan Red', hex: '#ca503d' },
      { name: "Pale King's Blue", hex: '#b4dae9' },
    ],
    theme: {
      name: 'wada-vol2-tapestry',
      mode: 'light',
      bg: '#b4dae9',
      raised: '#d6ebf3',
      ink: '#120603e6',
      inkStrong: '#120603',
      accent: '#6b4720',
      ai: '#833121',
      danger: '#8f0f2a',
      selection: '#cf97ab99',
    },
  },
]

const isDev = (): boolean => import.meta.env.DEV

export const currentVariantKey = (): string =>
  isDev()
    ? (new URLSearchParams(window.location.search).get('variant') ??
      WADA_VARIANTS[0]?.key ??
      BASE_VARIANT)
    : BASE_VARIANT

export const variantByKey = (key: string): WadaVariant | null =>
  WADA_VARIANTS.find((variant) => variant.key === key) ?? null
