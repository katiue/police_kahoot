// Server-authoritative scoring. Speed + accuracy (Kahoot-style).
// points = correct ? round(base * (1 - 0.5 * responseMs / timeLimitMs)) : 0
// Correct + instant ≈ full base; correct + last-second ≈ half base; wrong = 0.

export function computeScore(params: {
  correct: boolean
  basePoints: number
  responseMs: number
  timeLimitMs: number
}): number {
  const { correct, basePoints, responseMs, timeLimitMs } = params
  if (!correct) return 0
  if (timeLimitMs <= 0) return basePoints
  const clamped = Math.max(0, Math.min(responseMs, timeLimitMs))
  const factor = 1 - 0.5 * (clamped / timeLimitMs)
  return Math.round(basePoints * factor)
}
