export const RAIL_WIDTH_PX = 40
export const LIBRARY_WIDTH_PX = 288
export const TEXT_COLUMN_PX = 768 + 48

export type LibraryPlacement = 'column' | 'overlay'

export const libraryPlacement = (viewportWidth: number): LibraryPlacement =>
  viewportWidth >= RAIL_WIDTH_PX + LIBRARY_WIDTH_PX + TEXT_COLUMN_PX
    ? 'column'
    : 'overlay'
