import type { SessionData, SetData } from "../types/index";

export type SessionDataCompleteness = {
  complete: boolean;
  missing_rpe_set_count: number;
  missing_pain_review: boolean;
  warnings: string[];
};

export function assessSessionDataCompleteness(
  session: SessionData,
  sets: SetData[],
): SessionDataCompleteness {
  const missingRpe = sets.filter((set) => set.rpe == null).length;
  const painReviewed = session.readiness?.pain_reviewed === true;
  const warnings = [
    ...(missingRpe > 0 ? [`RPE未入力: ${missingRpe}セット`] : []),
    ...(!painReviewed ? ["痛みレビュー未入力"] : []),
  ];
  return {
    complete: warnings.length === 0,
    missing_rpe_set_count: missingRpe,
    missing_pain_review: !painReviewed,
    warnings,
  };
}
