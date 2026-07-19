
export function rateLimitKeyTtlSeconds(refillPeriodSeconds: number): number {
  return Math.max(1, Math.floor(refillPeriodSeconds));
}
