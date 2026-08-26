const LOAD_DECIMAL_PLACES = 2;
const LOAD_SCALE = 10 ** LOAD_DECIMAL_PLACES;

/** Normalizes a recorded load to the precision available on cable stacks. */
export const normalizeLoadKg = (value: number): number => {
  if (!Number.isFinite(value)) return 0;

  const sign = value < 0 ? -1 : 1;
  const rounded =
    Math.round((Math.abs(value) + Number.EPSILON) * LOAD_SCALE) / LOAD_SCALE;

  return sign * rounded;
};

/** Formats a load consistently for UI and export-facing display. */
export const formatLoadKgTwoDecimals = (value: number): string =>
  normalizeLoadKg(value).toFixed(LOAD_DECIMAL_PLACES);

/**
 * Compares recorded loads at the storage precision instead of treating nearby
 * cable-stack values as the same load.
 */
export const isSameRecordedLoadKg = (left: number, right: number): boolean =>
  Number.isFinite(left) &&
  Number.isFinite(right) &&
  normalizeLoadKg(left) === normalizeLoadKg(right);

/**
 * Parses a non-negative decimal load typed into a text input.
 * A single comma is accepted as a decimal separator for convenience.
 */
export const parseLoadKgInput = (value: string): number | null => {
  const normalizedText = value.trim().replace(",", ".");
  if (!normalizedText || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizedText)) {
    return null;
  }

  const parsed = Number(normalizedText);
  return Number.isFinite(parsed) ? normalizeLoadKg(parsed) : null;
};
