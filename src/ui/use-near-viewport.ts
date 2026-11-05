import { type RefObject, useEffect, useRef, useState } from 'react'

const MARGIN = '600px 0px'

export const useNearViewport = <T extends Element>(): readonly [
  RefObject<T | null>,
  boolean,
] => {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (near || element === null) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true)
      },
      { rootMargin: MARGIN },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [near])

  return [ref, near]
}
