import type { ThemeMode } from './tokens'

export type PaletteColor = {
  readonly name: string
  readonly hex: string
}

export type PaletteJobs = {
  readonly canvas: string
  readonly raised: string
  readonly ink: string
  readonly ai: string
  readonly danger: string
  readonly accent?: string
  readonly selection?: string
  readonly fill?: string
  readonly hairline?: string
  readonly scrollbar?: string
}

export type Palette = {
  readonly id: string
  readonly title: string
  readonly source: readonly [number, number]
  readonly mode: ThemeMode
  readonly colors: readonly PaletteColor[]
  readonly jobs: PaletteJobs
}

export const BOOK_PALETTES: readonly Palette[] = [
  {
    id: 'solitude',
    title: 'Solitude',
    source: [166, 303],
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
    jobs: {
      canvas: 'Deep Slate Green',
      raised: 'Deep Slate Olive',
      ink: 'Neutral Gray',
      ai: 'Naples Yellow',
      danger: 'Grenadine Pink',
      hairline: 'Peach Red',
    },
  },
  {
    id: 'in-a-sentimental-mood',
    title: 'In a Sentimental Mood',
    source: [166, 341],
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
    jobs: {
      canvas: 'Deep Slate Green',
      raised: 'Deep Slate Olive',
      ink: 'Light Glaucous Blue',
      ai: 'Naples Yellow',
      danger: 'Grenadine Pink',
      hairline: 'Cossack Green',
    },
  },
  {
    id: 'black-and-tan-fantasy',
    title: 'Black and Tan Fantasy',
    source: [182, 298],
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
    jobs: {
      canvas: 'Black',
      raised: 'Deep Indigo',
      ink: 'Lemon Yellow',
      ai: 'Raw Sienna',
      danger: 'Peach Red',
      fill: 'Vandyke Brown',
    },
  },
  {
    id: 'mood-indigo',
    title: 'Mood Indigo',
    source: [265, 211],
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
    jobs: {
      canvas: 'Deep Indigo',
      raised: 'Dull Violet Black',
      ink: 'Apricot Yellow',
      ai: 'Apricot Orange',
      danger: 'Old Rose',
      accent: 'Olive Yellow',
    },
  },
  {
    id: 'sophisticated-lady',
    title: 'Sophisticated Lady',
    source: [276, 141],
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
    jobs: {
      canvas: 'Black',
      raised: 'Dark Tyrian Blue',
      ink: 'Seashell Pink',
      ai: 'Yellow Green',
      danger: 'Eosine Pink',
      hairline: 'Orange',
    },
  },
  {
    id: 'prelude-to-a-kiss',
    title: 'Prelude to a Kiss',
    source: [277, 310],
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
    jobs: {
      canvas: 'Deep Slate Olive',
      raised: 'Dull Violet Black',
      ink: 'Sulpher Yellow',
      ai: 'Pinkish Cinnamon',
      danger: 'Spinel Red',
      hairline: 'Olive',
      scrollbar: 'Rosolanc Purple',
    },
  },
  {
    id: 'harlem-air-shaft',
    title: 'Harlem Air Shaft',
    source: [298, 289],
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
    jobs: {
      canvas: 'Black',
      raised: 'Dull Violet Black',
      ink: 'Lemon Yellow',
      ai: 'Raw Sienna',
      danger: 'Peach Red',
      accent: 'Light Green Yellow',
      fill: 'Violet Blue',
    },
  },
  {
    id: 'the-mooche',
    title: 'The Mooche',
    source: [340, 139],
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
    jobs: {
      canvas: 'Black',
      raised: 'Deep Indigo',
      ink: 'Neutral Gray',
      ai: 'Sea Green',
      danger: 'Peach Red',
      accent: 'Salvia Blue',
    },
  },
  {
    id: 'creole-love-call',
    title: 'Creole Love Call',
    source: [341, 348],
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
    jobs: {
      canvas: 'Cotinga Purple',
      raised: 'Deep Slate Olive',
      ink: 'Light Glaucous Blue',
      ai: 'Olive Buff',
      danger: 'Grenadine Pink',
      hairline: 'Cossack Green',
    },
  },
  {
    id: 'black-brown-and-beige',
    title: 'Black, Brown and Beige',
    source: [145, 323],
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
    jobs: {
      canvas: 'Cinnamon Buff',
      raised: 'Citron Yellow',
      ink: 'Black',
      ai: 'Dull Violet Black',
      danger: 'Madder Brown',
      hairline: 'Brown',
    },
  },
  {
    id: 'rockin-in-rhythm',
    title: "Rockin' in Rhythm",
    source: [173, 253],
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
    jobs: {
      canvas: 'Lemon Yellow',
      raised: 'Turquoise Green',
      ink: 'Slate Color',
      ai: 'Cotinga Purple',
      danger: 'Madder Brown',
      hairline: 'Apricot Orange',
    },
  },
  {
    id: 'im-beginning-to-see-the-light',
    title: "I'm Beginning to See the Light",
    source: [173, 289],
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
    jobs: {
      canvas: 'Lemon Yellow',
      raised: 'Turquoise Green',
      ink: 'Dull Violet Black',
      ai: 'Violet Blue',
      danger: 'Madder Brown',
      selection: 'Light Green Yellow',
    },
  },
  {
    id: 'east-st-louis-toodle-oo',
    title: 'East St. Louis Toodle-Oo',
    source: [210, 323],
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
    jobs: {
      canvas: 'Cinnamon Buff',
      raised: 'Lemon Yellow',
      ink: 'Black',
      ai: 'Lincoln Green',
      danger: 'Madder Brown',
      fill: 'Citron Yellow',
    },
  },
  {
    id: 'it-dont-mean-a-thing',
    title: "It Don't Mean a Thing",
    source: [251, 253],
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
    jobs: {
      canvas: 'Lemon Yellow',
      raised: 'Yellow',
      ink: 'Cotinga Purple',
      ai: 'Diamine Green',
      danger: 'Red',
      accent: 'Slate Color',
      fill: 'Apricot Orange',
    },
  },
  {
    id: 'satin-doll',
    title: 'Satin Doll',
    source: [251, 261],
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
    jobs: {
      canvas: 'Pale Lemon Yellow',
      raised: 'Yellow',
      ink: 'Slate Color',
      ai: 'Diamine Green',
      danger: 'Red',
      fill: 'Calamine BLue',
      hairline: 'Warm Gray',
    },
  },
  {
    id: 'i-got-it-bad',
    title: 'I Got It Bad',
    source: [251, 296],
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
    jobs: {
      canvas: 'Sulpher Yellow',
      raised: 'Yellow',
      ink: 'Slate Color',
      ai: 'Diamine Green',
      danger: 'Red',
      accent: 'Pale Raw Umber',
      hairline: 'Ochraceous Salmon',
    },
  },
  {
    id: 'caravan',
    title: 'Caravan',
    source: [263, 335],
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
    jobs: {
      canvas: 'Pinkish Cinnamon',
      raised: 'Turquoise Green',
      ink: 'Slate Color',
      ai: 'Violet',
      danger: 'Vandyke Red',
      fill: 'Yellow Orange',
      hairline: 'Burnt Sienna',
    },
  },
  {
    id: 'cotton-tail',
    title: 'Cotton Tail',
    source: [276, 314],
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
    jobs: {
      canvas: 'Seashell Pink',
      raised: 'Yellow Green',
      ink: 'Black',
      ai: 'Deep Lyons Blue',
      danger: "Hay's Russet",
      accent: 'Dusky Madder Violet',
      fill: 'Eosine Pink',
    },
  },
  {
    id: 'dont-get-around-much-anymore',
    title: "Don't Get Around Much Anymore",
    source: [287, 314],
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
    jobs: {
      canvas: 'Calamine BLue',
      raised: "Pale King's Blue",
      ink: 'Dusky Madder Violet',
      ai: 'Deep Lyons Blue',
      danger: "Hay's Russet",
      selection: 'Pyrite Yellow',
      fill: 'Eosine Pink',
    },
  },
  {
    id: 'concerto-for-cootie',
    title: 'Concerto for Cootie',
    source: [298, 313],
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
    jobs: {
      canvas: 'Lemon Yellow',
      raised: 'Yellow',
      ink: 'Black',
      ai: 'Diamine Green',
      danger: 'Carmine',
      fill: 'Raw Sienna',
      hairline: 'Peach Red',
    },
  },
  {
    id: 'harlem',
    title: 'Harlem',
    source: [314, 126],
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
    jobs: {
      canvas: 'Ivory Buff',
      raised: 'Yellow Ocher',
      ink: 'Dusky Madder Violet',
      ai: 'Deep Lyons Blue',
      danger: "Hay's Russet",
      fill: 'Eosine Pink',
    },
  },
  {
    id: 'ko-ko',
    title: 'Ko-Ko',
    source: [335, 202],
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
    jobs: {
      canvas: 'Cobalt Green',
      raised: 'Turquoise Green',
      ink: 'Slate Color',
      ai: 'Violet',
      danger: 'Vandyke Red',
      fill: 'Yellow Orange',
    },
  },
  {
    id: 'azure',
    title: 'Azure',
    source: [336, 345],
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
    jobs: {
      canvas: 'Nile Blue',
      raised: 'Pale Lemon Yellow',
      ink: 'Blackish Olive',
      ai: 'Blue Violet',
      danger: "Hay's Russet",
      hairline: 'Eosine Pink',
      scrollbar: 'Venice Green',
    },
  },
  {
    id: 'c-jam-blues',
    title: 'C Jam Blues',
    source: [345, 189],
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
    jobs: {
      canvas: 'Lemon Yellow',
      raised: 'Nile Blue',
      ink: 'Deep Slate Olive',
      ai: 'Blue Violet',
      danger: "Hay's Russet",
      fill: 'Venice Green',
    },
  },
]
