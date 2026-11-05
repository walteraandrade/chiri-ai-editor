import { describe, expect, it } from 'vitest'
import { keepInBand } from './keep-in-view'

describe('keepInBand', () => {
  const band = { top: 100, bottom: 900 }
  const at = (top: number, left = 400) => ({
    left,
    right: left + 1,
    top,
    bottom: top + 20,
  })

  it('stays at its anchor while the anchor is on screen', () => {
    const anchor = at(500)
    expect(
      keepInBand({ anchor, range: { top: 0, bottom: 600 }, band, left: 80 }),
    ).toEqual(anchor)
  })

  it('moves to the bottom edge when the anchor is below the screen', () => {
    expect(
      keepInBand({
        anchor: at(7400),
        range: { top: 150, bottom: 7420 },
        band,
        left: 80,
      }),
    ).toEqual({ left: 80, right: 80, top: 892, bottom: 892 })
  })

  it('moves to the top edge when the anchor is above the screen', () => {
    expect(
      keepInBand({
        anchor: at(-3000),
        range: { top: -3000, bottom: 400 },
        band,
        left: 80,
      }),
    ).toEqual({ left: 80, right: 80, top: 108, bottom: 108 })
  })

  it('moves when the anchor line is cut by an edge', () => {
    expect(
      keepInBand({
        anchor: at(890),
        range: { top: 150, bottom: 910 },
        band,
        left: 80,
      }).top,
    ).toBe(892)
  })

  it('stays at its anchor when none of the range is on screen', () => {
    const anchor = at(7400)
    expect(
      keepInBand({
        anchor,
        range: { top: 7000, bottom: 7420 },
        band,
        left: 80,
      }),
    ).toEqual(anchor)
  })
})
