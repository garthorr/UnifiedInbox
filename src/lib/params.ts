/** Parse a positive integer from a string param, returning `defaultVal` for
 *  missing, non-numeric, or non-positive values. Optionally capped at `max`. */
export function parsePositiveInt(
  value: string | null | undefined,
  defaultVal: number,
  max?: number
): number {
  if (!value) return defaultVal;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return max !== undefined ? Math.min(n, max) : n;
}

/** Parse an ISO date string, returning `null` for missing or invalid values. */
export function parseISODateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}
