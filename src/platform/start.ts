import type { PlatformKit, PlatformKitFactory } from './kit'

export const startWith = async (
  createKit: PlatformKitFactory,
  render: (kit: PlatformKit) => void,
): Promise<void> => {
  render(await createKit())
}
