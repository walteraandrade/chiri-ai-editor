export const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export const play = (
  element: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): void => {
  if (!prefersReducedMotion()) element.animate?.(keyframes, options)
}
