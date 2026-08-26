import type { SetData } from "../types/index";

/**
 * Keeps the manual-entry screen's visible history small while preserving the
 * newest saved set as the first item.
 */
export const getManualEntryHistoryPreview = (
  sets: SetData[],
  limit = 4,
): SetData[] => {
  const safeLimit = Math.max(0, Math.floor(limit));

  return [...sets]
    .sort((left, right) => {
      const timestampDifference =
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
      if (Number.isFinite(timestampDifference) && timestampDifference !== 0) {
        return timestampDifference;
      }

      return right.set_index - left.set_index;
    })
    .slice(0, safeLimit);
};
