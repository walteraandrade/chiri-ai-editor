// PROTOTYPE, throwaway: Vol. 1 pairs painted only with exact book codes, named after Duke Ellington compositions, switchable via ?variant=.
import type { ThemeTokens } from './tokens'

export type WadaColor = {
  readonly name: string
  readonly hex: string
}

type Roles = {
  readonly canvas: string
  readonly raised: string
  readonly ink: string
  readonly ai: string
  readonly danger: string
  readonly accent?: string
  readonly selection?: string
  readonly fill?: string
  readonly hairline?: string
  readonly marker?: string
}

type Palette = {
  readonly key: string
  readonly title: string
  readonly source: string
  readonly mode: 'light' | 'dark'
  readonly colors: readonly WadaColor[]
  readonly roles: Roles
}

export type WadaVariant = Palette & {
  readonly theme: ThemeTokens
}

export const BASE_VARIANT = 'base'

const PALETTES: readonly Palette[] = [
  {
    key: 'solitude',
    title: 'Solitude',
    source: '#166 + #303',
    mode: 'dark',
    colors: [
      {
        name: 'Deep Slate Green',
        hex: '#112f2c',
      },
      {
        name: 'Deep Slate Olive',
        hex: '#253122',
      },
      {
        name: 'Grenadine Pink',
        hex: '#f48067',
      },
      {
        name: 'Naples Yellow',
        hex: '#fbe6a0',
      },
      {
        name: 'Neutral Gray',
        hex: '#b6bfc1',
      },
      {
        name: 'Peach Red',
        hex: '#f15a30',
      },
    ],
    roles: {
      canvas: '#112f2c',
      raised: '#253122',
      ink: '#b6bfc1',
      ai: '#fbe6a0',
      danger: '#f48067',
      hairline: '#f15a30',
    },
  },
  {
    key: 'in-a-sentimental-mood',
    title: 'In a Sentimental Mood',
    source: '#166 + #341',
    mode: 'dark',
    colors: [
      {
        name: 'Cossack Green',
        hex: '#437742',
      },
      {
        name: 'Deep Slate Green',
        hex: '#112f2c',
      },
      {
        name: 'Deep Slate Olive',
        hex: '#253122',
      },
      {
        name: 'Grenadine Pink',
        hex: '#f48067',
      },
      {
        name: 'Light Glaucous Blue',
        hex: '#a5c8d1',
      },
      {
        name: 'Naples Yellow',
        hex: '#fbe6a0',
      },
    ],
    roles: {
      canvas: '#112f2c',
      raised: '#253122',
      ink: '#a5c8d1',
      ai: '#fbe6a0',
      danger: '#f48067',
      hairline: '#437742',
    },
  },
  {
    key: 'black-and-tan-fantasy',
    title: 'Black and Tan Fantasy',
    source: '#182 + #298',
    mode: 'dark',
    colors: [
      {
        name: 'Black',
        hex: '#111314',
      },
      {
        name: 'Deep Indigo',
        hex: '#051230',
      },
      {
        name: 'Lemon Yellow',
        hex: '#f8ed43',
      },
      {
        name: 'Peach Red',
        hex: '#f15a30',
      },
      {
        name: 'Raw Sienna',
        hex: '#bb7125',
      },
      {
        name: 'Vandyke Brown',
        hex: '#4b3317',
      },
    ],
    roles: {
      canvas: '#111314',
      raised: '#051230',
      ink: '#f8ed43',
      ai: '#bb7125',
      danger: '#f15a30',
      fill: '#4b3317',
    },
  },
  {
    key: 'mood-indigo',
    title: 'Mood Indigo',
    source: '#265 + #211',
    mode: 'dark',
    colors: [
      {
        name: 'Apricot Orange',
        hex: '#f68c50',
      },
      {
        name: 'Apricot Yellow',
        hex: '#ffdd00',
      },
      {
        name: 'Deep Indigo',
        hex: '#051230',
      },
      {
        name: 'Dull Violet Black',
        hex: '#1e0e3f',
      },
      {
        name: 'Old Rose',
        hex: '#d46d7a',
      },
      {
        name: 'Olive Yellow',
        hex: '#a6a159',
      },
    ],
    roles: {
      canvas: '#051230',
      raised: '#1e0e3f',
      ink: '#ffdd00',
      ai: '#f68c50',
      danger: '#d46d7a',
      accent: '#a6a159',
    },
  },
  {
    key: 'sophisticated-lady',
    title: 'Sophisticated Lady',
    source: '#276 + #141',
    mode: 'dark',
    colors: [
      {
        name: 'Black',
        hex: '#111314',
      },
      {
        name: 'Dark Tyrian Blue',
        hex: '#12354e',
      },
      {
        name: 'Eosine Pink',
        hex: '#f37f94',
      },
      {
        name: 'Orange',
        hex: '#f37420',
      },
      {
        name: 'Seashell Pink',
        hex: '#fdd4bd',
      },
      {
        name: 'Yellow Green',
        hex: '#afd472',
      },
    ],
    roles: {
      canvas: '#111314',
      raised: '#12354e',
      ink: '#fdd4bd',
      ai: '#afd472',
      danger: '#f37f94',
      hairline: '#f37420',
    },
  },
  {
    key: 'prelude-to-a-kiss',
    title: 'Prelude to a Kiss',
    source: '#277 + #310',
    mode: 'dark',
    colors: [
      {
        name: 'Deep Slate Olive',
        hex: '#253122',
      },
      {
        name: 'Dull Violet Black',
        hex: '#1e0e3f',
      },
      {
        name: 'Olive',
        hex: '#837e31',
      },
      {
        name: 'Pinkish Cinnamon',
        hex: '#eeb480',
      },
      {
        name: 'Rosolanc Purple',
        hex: '#b73f74',
      },
      {
        name: 'Spinel Red',
        hex: '#f27291',
      },
      {
        name: 'Sulpher Yellow',
        hex: '#f5ecc2',
      },
    ],
    roles: {
      canvas: '#253122',
      raised: '#1e0e3f',
      ink: '#f5ecc2',
      ai: '#eeb480',
      danger: '#f27291',
      hairline: '#837e31',
      marker: '#b73f74',
    },
  },
  {
    key: 'harlem-air-shaft',
    title: 'Harlem Air Shaft',
    source: '#298 + #289',
    mode: 'dark',
    colors: [
      {
        name: 'Black',
        hex: '#111314',
      },
      {
        name: 'Dull Violet Black',
        hex: '#1e0e3f',
      },
      {
        name: 'Lemon Yellow',
        hex: '#f8ed43',
      },
      {
        name: 'Light Green Yellow',
        hex: '#c7d14f',
      },
      {
        name: 'Peach Red',
        hex: '#f15a30',
      },
      {
        name: 'Raw Sienna',
        hex: '#bb7125',
      },
      {
        name: 'Violet Blue',
        hex: '#40456a',
      },
    ],
    roles: {
      canvas: '#111314',
      raised: '#1e0e3f',
      ink: '#f8ed43',
      ai: '#bb7125',
      danger: '#f15a30',
      accent: '#c7d14f',
      fill: '#40456a',
    },
  },
  {
    key: 'the-mooche',
    title: 'The Mooche',
    source: '#340 + #139',
    mode: 'dark',
    colors: [
      {
        name: 'Black',
        hex: '#111314',
      },
      {
        name: 'Deep Indigo',
        hex: '#051230',
      },
      {
        name: 'Neutral Gray',
        hex: '#b6bfc1',
      },
      {
        name: 'Peach Red',
        hex: '#f15a30',
      },
      {
        name: 'Salvia Blue',
        hex: '#97acc8',
      },
      {
        name: 'Sea Green',
        hex: '#00b49b',
      },
    ],
    roles: {
      canvas: '#111314',
      raised: '#051230',
      ink: '#b6bfc1',
      ai: '#00b49b',
      danger: '#f15a30',
      accent: '#97acc8',
    },
  },
  {
    key: 'creole-love-call',
    title: 'Creole Love Call',
    source: '#341 + #348',
    mode: 'dark',
    colors: [
      {
        name: 'Cossack Green',
        hex: '#437742',
      },
      {
        name: 'Cotinga Purple',
        hex: '#501345',
      },
      {
        name: 'Deep Slate Olive',
        hex: '#253122',
      },
      {
        name: 'Grenadine Pink',
        hex: '#f48067',
      },
      {
        name: 'Light Glaucous Blue',
        hex: '#a5c8d1',
      },
      {
        name: 'Olive Buff',
        hex: '#c1c494',
      },
    ],
    roles: {
      canvas: '#501345',
      raised: '#253122',
      ink: '#a5c8d1',
      ai: '#c1c494',
      danger: '#f48067',
      hairline: '#437742',
    },
  },
  {
    key: 'black-brown-and-beige',
    title: 'Black, Brown and Beige',
    source: '#145 + #323',
    mode: 'light',
    colors: [
      {
        name: 'Black',
        hex: '#111314',
      },
      {
        name: 'Brown',
        hex: '#7c4226',
      },
      {
        name: 'Cinnamon Buff',
        hex: '#fdc57e',
      },
      {
        name: 'Citron Yellow',
        hex: '#b2b73e',
      },
      {
        name: 'Dull Violet Black',
        hex: '#1e0e3f',
      },
      {
        name: 'Madder Brown',
        hex: '#762c19',
      },
    ],
    roles: {
      canvas: '#fdc57e',
      raised: '#b2b73e',
      ink: '#111314',
      ai: '#1e0e3f',
      danger: '#762c19',
      hairline: '#7c4226',
    },
  },
  {
    key: 'rockin-in-rhythm',
    title: "Rockin' in Rhythm",
    source: '#173 + #253',
    mode: 'light',
    colors: [
      {
        name: 'Apricot Orange',
        hex: '#f68c50',
      },
      {
        name: 'Cotinga Purple',
        hex: '#501345',
      },
      {
        name: 'Lemon Yellow',
        hex: '#f8ed43',
      },
      {
        name: 'Madder Brown',
        hex: '#762c19',
      },
      {
        name: 'Slate Color',
        hex: '#34454c',
      },
      {
        name: 'Turquoise Green',
        hex: '#b5decc',
      },
    ],
    roles: {
      canvas: '#f8ed43',
      raised: '#b5decc',
      ink: '#34454c',
      ai: '#501345',
      danger: '#762c19',
      hairline: '#f68c50',
    },
  },
  {
    key: 'i-m-beginning-to-see-the-light',
    title: "I'm Beginning to See the Light",
    source: '#173 + #289',
    mode: 'light',
    colors: [
      {
        name: 'Dull Violet Black',
        hex: '#1e0e3f',
      },
      {
        name: 'Lemon Yellow',
        hex: '#f8ed43',
      },
      {
        name: 'Light Green Yellow',
        hex: '#c7d14f',
      },
      {
        name: 'Madder Brown',
        hex: '#762c19',
      },
      {
        name: 'Turquoise Green',
        hex: '#b5decc',
      },
      {
        name: 'Violet Blue',
        hex: '#40456a',
      },
    ],
    roles: {
      canvas: '#f8ed43',
      raised: '#b5decc',
      ink: '#1e0e3f',
      ai: '#40456a',
      danger: '#762c19',
      selection: '#c7d14f',
    },
  },
  {
    key: 'east-st-louis-toodle-oo',
    title: 'East St. Louis Toodle-Oo',
    source: '#210 + #323',
    mode: 'light',
    colors: [
      {
        name: 'Black',
        hex: '#111314',
      },
      {
        name: 'Cinnamon Buff',
        hex: '#fdc57e',
      },
      {
        name: 'Citron Yellow',
        hex: '#b2b73e',
      },
      {
        name: 'Lemon Yellow',
        hex: '#f8ed43',
      },
      {
        name: 'Lincoln Green',
        hex: '#555832',
      },
      {
        name: 'Madder Brown',
        hex: '#762c19',
      },
    ],
    roles: {
      canvas: '#fdc57e',
      raised: '#f8ed43',
      ink: '#111314',
      ai: '#555832',
      danger: '#762c19',
      fill: '#b2b73e',
    },
  },
  {
    key: 'it-don-t-mean-a-thing',
    title: "It Don't Mean a Thing",
    source: '#251 + #253',
    mode: 'light',
    colors: [
      {
        name: 'Apricot Orange',
        hex: '#f68c50',
      },
      {
        name: 'Cotinga Purple',
        hex: '#501345',
      },
      {
        name: 'Diamine Green',
        hex: '#1a7444',
      },
      {
        name: 'Lemon Yellow',
        hex: '#f8ed43',
      },
      {
        name: 'Red',
        hex: '#a72144',
      },
      {
        name: 'Slate Color',
        hex: '#34454c',
      },
      {
        name: 'Yellow',
        hex: '#fff200',
      },
    ],
    roles: {
      canvas: '#f8ed43',
      raised: '#fff200',
      ink: '#501345',
      ai: '#1a7444',
      danger: '#a72144',
      accent: '#34454c',
      fill: '#f68c50',
    },
  },
  {
    key: 'satin-doll',
    title: 'Satin Doll',
    source: '#251 + #261',
    mode: 'light',
    colors: [
      {
        name: 'Calamine BLue',
        hex: '#78cdd0',
      },
      {
        name: 'Diamine Green',
        hex: '#1a7444',
      },
      {
        name: 'Pale Lemon Yellow',
        hex: '#ffefae',
      },
      {
        name: 'Red',
        hex: '#a72144',
      },
      {
        name: 'Slate Color',
        hex: '#34454c',
      },
      {
        name: 'Warm Gray',
        hex: '#a1a39a',
      },
      {
        name: 'Yellow',
        hex: '#fff200',
      },
    ],
    roles: {
      canvas: '#ffefae',
      raised: '#fff200',
      ink: '#34454c',
      ai: '#1a7444',
      danger: '#a72144',
      fill: '#78cdd0',
      hairline: '#a1a39a',
    },
  },
  {
    key: 'i-got-it-bad',
    title: 'I Got It Bad',
    source: '#251 + #296',
    mode: 'light',
    colors: [
      {
        name: 'Diamine Green',
        hex: '#1a7444',
      },
      {
        name: 'Ochraceous Salmon',
        hex: '#d8a37b',
      },
      {
        name: 'Pale Raw Umber',
        hex: '#71502f',
      },
      {
        name: 'Red',
        hex: '#a72144',
      },
      {
        name: 'Slate Color',
        hex: '#34454c',
      },
      {
        name: 'Sulpher Yellow',
        hex: '#f5ecc2',
      },
      {
        name: 'Yellow',
        hex: '#fff200',
      },
    ],
    roles: {
      canvas: '#f5ecc2',
      raised: '#fff200',
      ink: '#34454c',
      ai: '#1a7444',
      danger: '#a72144',
      accent: '#71502f',
      hairline: '#d8a37b',
    },
  },
  {
    key: 'caravan',
    title: 'Caravan',
    source: '#263 + #335',
    mode: 'light',
    colors: [
      {
        name: 'Burnt Sienna',
        hex: '#ae5224',
      },
      {
        name: 'Pinkish Cinnamon',
        hex: '#eeb480',
      },
      {
        name: 'Slate Color',
        hex: '#34454c',
      },
      {
        name: 'Turquoise Green',
        hex: '#b5decc',
      },
      {
        name: 'Vandyke Red',
        hex: '#82241f',
      },
      {
        name: 'Violet',
        hex: '#4f4086',
      },
      {
        name: 'Yellow Orange',
        hex: '#f99d1b',
      },
    ],
    roles: {
      canvas: '#eeb480',
      raised: '#b5decc',
      ink: '#34454c',
      ai: '#4f4086',
      danger: '#82241f',
      fill: '#f99d1b',
      hairline: '#ae5224',
    },
  },
  {
    key: 'cotton-tail',
    title: 'Cotton Tail',
    source: '#276 + #314',
    mode: 'light',
    colors: [
      {
        name: 'Black',
        hex: '#111314',
      },
      {
        name: 'Deep Lyons Blue',
        hex: '#1c4286',
      },
      {
        name: 'Dusky Madder Violet',
        hex: '#4e1d4c',
      },
      {
        name: 'Eosine Pink',
        hex: '#f37f94',
      },
      {
        name: "Hay's Russet",
        hex: '#793327',
      },
      {
        name: 'Seashell Pink',
        hex: '#fdd4bd',
      },
      {
        name: 'Yellow Green',
        hex: '#afd472',
      },
    ],
    roles: {
      canvas: '#fdd4bd',
      raised: '#afd472',
      ink: '#111314',
      ai: '#1c4286',
      danger: '#793327',
      accent: '#4e1d4c',
      fill: '#f37f94',
    },
  },
  {
    key: 'don-t-get-around-much-anymore',
    title: "Don't Get Around Much Anymore",
    source: '#287 + #314',
    mode: 'light',
    colors: [
      {
        name: 'Calamine BLue',
        hex: '#78cdd0',
      },
      {
        name: 'Deep Lyons Blue',
        hex: '#1c4286',
      },
      {
        name: 'Dusky Madder Violet',
        hex: '#4e1d4c',
      },
      {
        name: 'Eosine Pink',
        hex: '#f37f94',
      },
      {
        name: "Hay's Russet",
        hex: '#793327',
      },
      {
        name: "Pale King's Blue",
        hex: '#a7d4e4',
      },
      {
        name: 'Pyrite Yellow',
        hex: '#cab356',
      },
    ],
    roles: {
      canvas: '#78cdd0',
      raised: '#a7d4e4',
      ink: '#4e1d4c',
      ai: '#1c4286',
      danger: '#793327',
      selection: '#cab356',
      fill: '#f37f94',
    },
  },
  {
    key: 'concerto-for-cootie',
    title: 'Concerto for Cootie',
    source: '#298 + #313',
    mode: 'light',
    colors: [
      {
        name: 'Black',
        hex: '#111314',
      },
      {
        name: 'Carmine',
        hex: '#cc1236',
      },
      {
        name: 'Diamine Green',
        hex: '#1a7444',
      },
      {
        name: 'Lemon Yellow',
        hex: '#f8ed43',
      },
      {
        name: 'Peach Red',
        hex: '#f15a30',
      },
      {
        name: 'Raw Sienna',
        hex: '#bb7125',
      },
      {
        name: 'Yellow',
        hex: '#fff200',
      },
    ],
    roles: {
      canvas: '#f8ed43',
      raised: '#fff200',
      ink: '#111314',
      ai: '#1a7444',
      danger: '#cc1236',
      fill: '#bb7125',
      hairline: '#f15a30',
    },
  },
  {
    key: 'harlem',
    title: 'Harlem',
    source: '#314 + #126',
    mode: 'light',
    colors: [
      {
        name: 'Deep Lyons Blue',
        hex: '#1c4286',
      },
      {
        name: 'Dusky Madder Violet',
        hex: '#4e1d4c',
      },
      {
        name: 'Eosine Pink',
        hex: '#f37f94',
      },
      {
        name: "Hay's Russet",
        hex: '#793327',
      },
      {
        name: 'Ivory Buff',
        hex: '#ebd3a2',
      },
      {
        name: 'Yellow Ocher',
        hex: '#e2b540',
      },
    ],
    roles: {
      canvas: '#ebd3a2',
      raised: '#e2b540',
      ink: '#4e1d4c',
      ai: '#1c4286',
      danger: '#793327',
      fill: '#f37f94',
    },
  },
  {
    key: 'ko-ko',
    title: 'Ko-Ko',
    source: '#335 + #202',
    mode: 'light',
    colors: [
      {
        name: 'Cobalt Green',
        hex: '#96d1aa',
      },
      {
        name: 'Slate Color',
        hex: '#34454c',
      },
      {
        name: 'Turquoise Green',
        hex: '#b5decc',
      },
      {
        name: 'Vandyke Red',
        hex: '#82241f',
      },
      {
        name: 'Violet',
        hex: '#4f4086',
      },
      {
        name: 'Yellow Orange',
        hex: '#f99d1b',
      },
    ],
    roles: {
      canvas: '#96d1aa',
      raised: '#b5decc',
      ink: '#34454c',
      ai: '#4f4086',
      danger: '#82241f',
      fill: '#f99d1b',
    },
  },
  {
    key: 'azure',
    title: 'Azure',
    source: '#336 + #345',
    mode: 'light',
    colors: [
      {
        name: 'Blackish Olive',
        hex: '#42533e',
      },
      {
        name: 'Blue Violet',
        hex: '#6450a1',
      },
      {
        name: 'Eosine Pink',
        hex: '#f37f94',
      },
      {
        name: "Hay's Russet",
        hex: '#793327',
      },
      {
        name: 'Nile Blue',
        hex: '#bce4e5',
      },
      {
        name: 'Pale Lemon Yellow',
        hex: '#ffefae',
      },
      {
        name: 'Venice Green',
        hex: '#62c6bf',
      },
    ],
    roles: {
      canvas: '#bce4e5',
      raised: '#ffefae',
      ink: '#42533e',
      ai: '#6450a1',
      danger: '#793327',
      hairline: '#f37f94',
      marker: '#62c6bf',
    },
  },
  {
    key: 'c-jam-blues',
    title: 'C Jam Blues',
    source: '#345 + #189',
    mode: 'light',
    colors: [
      {
        name: 'Blue Violet',
        hex: '#6450a1',
      },
      {
        name: 'Deep Slate Olive',
        hex: '#253122',
      },
      {
        name: "Hay's Russet",
        hex: '#793327',
      },
      {
        name: 'Lemon Yellow',
        hex: '#f8ed43',
      },
      {
        name: 'Nile Blue',
        hex: '#bce4e5',
      },
      {
        name: 'Venice Green',
        hex: '#62c6bf',
      },
    ],
    roles: {
      canvas: '#f8ed43',
      raised: '#bce4e5',
      ink: '#253122',
      ai: '#6450a1',
      danger: '#793327',
      fill: '#62c6bf',
    },
  },
]

const solidTokens = (r: Roles): Readonly<Record<string, string>> => {
  const hairline = r.hairline ?? r.marker ?? r.accent ?? r.fill ?? r.ink
  const accent = r.accent ?? r.ink
  const soft = r.selection ?? r.raised
  return {
    '--color-canvas': r.canvas,
    '--color-surface': r.raised,
    '--color-raised': r.raised,
    '--color-ink-strong': r.ink,
    '--color-ink': r.ink,
    '--color-ink-muted': r.ink,
    '--color-ink-faint': r.accent ?? r.ink,
    '--color-accent': accent,
    '--color-accent-soft': accent,
    '--color-accent-tint': r.raised,
    '--color-danger': r.danger,
    '--color-danger-tint': r.raised,
    '--color-shadow': r.canvas,
    '--color-fill': r.fill ?? r.raised,
    '--color-fill-hover': r.fill ? r.raised : r.canvas,
    '--color-hairline': hairline,
    '--color-code-bg': soft,
    '--color-scrollbar': r.marker ?? hairline,
    '--color-scrollbar-hover': r.ink,
    '--color-selection': soft,
    '--color-ai': r.ai,
    '--color-ai-text': r.ai,
    '--color-ai-tint': r.raised,
    '--color-ai-wash': 'transparent',
    '--color-ai-glow': r.ai,
    '--color-ai-ink': r.canvas,
  }
}

export const SOLID_TOKEN_NAMES: readonly string[] = Object.keys(
  solidTokens({ canvas: '', raised: '', ink: '', ai: '', danger: '' }),
)

export const WADA_VARIANTS: readonly WadaVariant[] = PALETTES.map(
  (palette) => ({
    ...palette,
    theme: {
      name: palette.key,
      mode: palette.mode,
      bg: palette.roles.canvas,
      raised: palette.roles.raised,
      ink: palette.roles.ink,
      inkStrong: palette.roles.ink,
      accent: palette.roles.accent ?? palette.roles.ink,
      ai: palette.roles.ai,
      danger: palette.roles.danger,
      selection: palette.roles.selection ?? palette.roles.raised,
      solid: solidTokens(palette.roles),
    },
  }),
)

const isDev = (): boolean => import.meta.env.DEV

export const currentVariantKey = (): string =>
  isDev()
    ? (new URLSearchParams(window.location.search).get('variant') ??
      WADA_VARIANTS[0]?.key ??
      BASE_VARIANT)
    : BASE_VARIANT

export const variantByKey = (key: string): WadaVariant | null =>
  WADA_VARIANTS.find((variant) => variant.key === key) ?? null
