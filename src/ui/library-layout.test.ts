import { describe, expect, it } from 'vitest'
import {
  LIBRARY_WIDTH_PX,
  libraryPlacement,
  RAIL_WIDTH_PX,
  TEXT_COLUMN_PX,
} from './library-layout'

const fits = RAIL_WIDTH_PX + LIBRARY_WIDTH_PX + TEXT_COLUMN_PX

describe('libraryPlacement', () => {
  it('measures the text column as 48rem plus its 1.5rem gutters', () => {
    expect(TEXT_COLUMN_PX).toBe(768 + 48)
  })

  it('takes its own column when the rail, the Library and the text fit', () => {
    expect(libraryPlacement(fits)).toBe('column')
    expect(libraryPlacement(1440)).toBe('column')
  })

  it('lies over the page one pixel short of that', () => {
    expect(libraryPlacement(fits - 1)).toBe('overlay')
    expect(libraryPlacement(900)).toBe('overlay')
  })
})
