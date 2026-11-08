import { useEffect, useState } from 'react'

export const useViewportWidth = (): number => {
  const [width, setWidth] = useState(() => document.documentElement.clientWidth)
  useEffect(() => {
    const onResize = (): void => setWidth(document.documentElement.clientWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}
