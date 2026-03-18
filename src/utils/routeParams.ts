export function serializeRouteParams(params: Record<string, unknown> = {}) {
  const entries = Object.entries(params).flatMap(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return [];
    }

    if (typeof value === 'object') {
      return [[key, JSON.stringify(value)] as const];
    }

    return [[key, String(value)] as const];
  });

  return Object.fromEntries(entries);
}

export function firstRouteParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function numberRouteParam(value: string | string[] | undefined): number | null {
  const raw = firstRouteParam(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
