import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseDuration(input: string): number {
  const match = input.match(/^(\d+)(ms|s|m|h|d)$/)
  if (!match) throw new Error("Invalid duration")

  const value = Number(match[1])
  const unit = match[2]

  switch (unit) {
    case "ms": return value
    case "s": return value * 1000
    case "m": return value * 60_000
    case "h": return value * 3_600_000
    case "d": return value * 86_400_000
  }
  throw new Error("Invalid duration unit")
}
