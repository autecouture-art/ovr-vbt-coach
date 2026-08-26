import { normalizeLoadKg } from "./LoadPrecision";

/**
 * A supervisor plan can make automated suggestions conservative, but it must
 * never revoke the athlete's ability to select a session load.
 */
export function resolveUserSelectedSessionLoad(requestedLoad: number): number {
  return normalizeLoadKg(Math.max(0, requestedLoad));
}
