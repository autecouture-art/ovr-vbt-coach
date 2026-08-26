export const VELOCITY_LOSS_THRESHOLD_MIN = 5;
export const VELOCITY_LOSS_THRESHOLD_MAX = 40;

export const VELOCITY_LOSS_THRESHOLD_OPTIONS = Array.from(
  { length: VELOCITY_LOSS_THRESHOLD_MAX - VELOCITY_LOSS_THRESHOLD_MIN + 1 },
  (_, index) => VELOCITY_LOSS_THRESHOLD_MIN + index,
);

export function normalizeVelocityLossThreshold(
  value: number | null | undefined,
  fallback = 20,
): number {
  const candidate =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(
    VELOCITY_LOSS_THRESHOLD_MAX,
    Math.max(VELOCITY_LOSS_THRESHOLD_MIN, Math.round(candidate)),
  );
}

export function isVelocityLossThreshold(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= VELOCITY_LOSS_THRESHOLD_MIN &&
    value <= VELOCITY_LOSS_THRESHOLD_MAX
  );
}
