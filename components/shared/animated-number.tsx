"use client"

/**
 * Animated Number Component
 * @description Shared animated number counter with spring physics.
 * Used across analytics summary bar, analytics cards, and dashboard.
 * @module components/shared/animated-number
 */

import { useEffect } from "react"
import { motion, useSpring, useTransform } from "framer-motion"

/**
 * Props for the AnimatedNumber component
 */
interface AnimatedNumberProps {
  /** Target value to animate to */
  value: number
  /** Number of decimal places (default: 0) */
  decimals?: number
  /** Suffix to append (e.g., "%") */
  suffix?: string
  /** Prefix to prepend (e.g., "$") */
  prefix?: string
}

/**
 * Animated number counter component with spring physics.
 * Shows value immediately when 0, animates only for non-zero values.
 * @param props - Component props
 * @param props.value - Target value to animate to
 * @param props.decimals - Number of decimal places
 * @param props.suffix - Suffix to append (e.g., "%")
 * @param props.prefix - Prefix to prepend (e.g., "$")
 * @returns Animated number span
 * @example
 * <AnimatedNumber value={1234} />
 * <AnimatedNumber value={3.14} decimals={2} suffix="%" />
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
}: AnimatedNumberProps) {
  const spring = useSpring(0, { stiffness: 50, damping: 20 })
  const display = useTransform(spring, (current) => {
    if (decimals > 0) {
      return `${prefix}${current.toFixed(decimals)}${suffix}`
    }
    return `${prefix}${Math.round(current).toLocaleString()}${suffix}`
  })

  useEffect(() => {
    if (value === 0) {
      spring.jump(0)
    } else {
      spring.set(value)
    }
  }, [spring, value])

  return <motion.span>{display}</motion.span>
}
