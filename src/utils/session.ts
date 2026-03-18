export function createSessionId(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

export function getSessionDate(sessionId: string) {
  const match = sessionId.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : sessionId;
}

export function getSessionTimeLabel(sessionId: string) {
  const match = sessionId.match(/_(\d{2})(\d{2})(\d{2})$/);
  if (!match) return '';

  const [, hours, minutes] = match;
  return `${hours}:${minutes}`;
}

export function formatSessionLabel(sessionId: string, fallbackDate?: string) {
  const date = fallbackDate || getSessionDate(sessionId);
  const time = getSessionTimeLabel(sessionId);
  return time ? `${date} ${time}` : date;
}
