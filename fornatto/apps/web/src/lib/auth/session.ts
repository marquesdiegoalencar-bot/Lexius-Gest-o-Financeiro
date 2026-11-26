const STORAGE_KEY = 'fornatto_session';

export type FornattoSession = {
  accessToken: string;
  userName: string;
  companyName: string;
};

export function saveSession(data: FornattoSession) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export function loadSession(): FornattoSession | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FornattoSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}