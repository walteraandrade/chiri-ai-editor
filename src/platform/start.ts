import type { PlatformKit, PlatformKitFactory } from './kit'

export const startWith = async <Ref>(
  createKit: PlatformKitFactory<Ref>,
  render: (kit: PlatformKit<Ref>) => void,
): Promise<void> => {
  render(await createKit())
}
