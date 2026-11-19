import { notifyUnauthorizedFromApi } from './session-events';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

export type ApiFetchOptions = RequestInit & {
  token?: string | null;
  empresaId?: string | null;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, empresaId, headers, ...init } = options;
  const h = new Headers(headers);
  if (token) h.set('Authorization', `Bearer ${token}`);
  if (empresaId) h.set('X-Empresa-Id', empresaId);
  if (!h.has('Content-Type') && init.body && typeof init.body === 'string') {
    h.set('Content-Type', 'application/json');
  }

  const res = await fetch(apiUrl(path), { ...init, headers: h });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    let msg = res.statusText;
    if (data && typeof data === 'object' && 'message' in data) {
      const m = (data as { message: string | string[] }).message;
      msg = Array.isArray(m) ? (m[0] ?? msg) : String(m);
    }
    if (res.status === 401) {
      if (token && path !== '/v1/auth/login') {
        notifyUnauthorizedFromApi();
      }
      if (msg === 'Unauthorized' || !msg) {
        msg = 'Sessão expirada ou token inválido. Faça login novamente.';
      }
    } else if (res.status === 403 && (msg === 'Forbidden' || !msg)) {
      msg = 'Sem permissão para esta operação ou empresa.';
    }
    throw new ApiError(msg, res.status, data);
  }

  return data as T;
}