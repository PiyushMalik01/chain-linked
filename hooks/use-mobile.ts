/**
 * Mobile Detection Hook
 * @description Detects whether the current viewport is mobile-sized using a media query listener
 * @module hooks/use-mobile
 */

import * as React from "react"

/** Breakpoint width in pixels below which the device is considered mobile */
const MOBILE_BREAKPOINT = 768

/**
 * Hook that returns whether the current viewport width is below the mobile breakpoint
 * @returns true if the viewport is narrower than 768px
 * @example
 * const isMobile = useIsMobile()
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
