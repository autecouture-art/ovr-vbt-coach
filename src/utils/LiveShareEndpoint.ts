export function normalizeLiveShareBaseUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    url.pathname = url.pathname
      .replace(/\/api\/repvelocoach\/(events|sync)\/?$/, "/api/repvelocoach")
      .replace(/\/(events|sync)\/?$/, "")
      .replace(/\/$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function buildLiveShareEventsUrl(rawUrl: string): string | null {
  const base = normalizeLiveShareBaseUrl(rawUrl);
  return base ? `${base}/events` : null;
}

export function buildRepVeloCoachSyncUrl(rawUrl: string): string | null {
  const base = normalizeLiveShareBaseUrl(rawUrl);
  if (!base) return null;
  return base.endsWith("/api/repvelocoach")
    ? `${base}/sync`
    : `${base}/api/repvelocoach/sync`;
}

export function buildRepVeloCoachCurrentPlanUrl(rawUrl: string): string | null {
  const base = normalizeLiveShareBaseUrl(rawUrl);
  if (!base) return null;
  return base.endsWith("/api/repvelocoach")
    ? `${base}/plan/current`
    : `${base}/api/repvelocoach/plan/current`;
}

export function buildRepVeloCoachIssuesUrl(rawUrl: string): string | null {
  const base = normalizeLiveShareBaseUrl(rawUrl);
  if (!base) return null;
  return base.endsWith("/api/repvelocoach")
    ? `${base}/issues`
    : `${base}/api/repvelocoach/issues`;
}

export function buildRepVeloCoachFeedbackBatchesUrl(rawUrl: string): string | null {
  const base = normalizeLiveShareBaseUrl(rawUrl);
  if (!base) return null;
  return base.endsWith("/api/repvelocoach")
    ? `${base}/session-feedback-batches`
    : `${base}/api/repvelocoach/session-feedback-batches`;
}

export function buildRepVeloCoachIssueReceiptsUrl(rawUrl: string): string | null {
  const base = normalizeLiveShareBaseUrl(rawUrl);
  if (!base) return null;
  return base.endsWith("/api/repvelocoach")
    ? `${base}/issues/receipts`
    : `${base}/api/repvelocoach/issues/receipts`;
}

export function buildRepVeloCoachCrashHandoffsUrl(rawUrl: string): string | null {
  const base = normalizeLiveShareBaseUrl(rawUrl);
  if (!base) return null;
  return base.endsWith("/api/repvelocoach")
    ? `${base}/crash-handoffs`
    : `${base}/api/repvelocoach/crash-handoffs`;
}
