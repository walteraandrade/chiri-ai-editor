export const attempt = async <T>(
  run: () => Promise<T>,
): Promise<T | undefined> => {
  try {
    return await run()
  } catch {
    return undefined
  }
}
