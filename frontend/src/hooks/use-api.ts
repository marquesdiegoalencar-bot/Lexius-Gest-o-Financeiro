import { useCallback } from 'react';
import { apiFetch, type ApiFetchOptions } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function useApi() {
  const { token, empresaId } = useAuth();

  const request = useCallback(
    <T,>(path: string, options?: Omit<ApiFetchOptions, 'token' | 'empresaId'>) =>
      apiFetch<T>(path, { ...options, token, empresaId }),
    [token, empresaId],
  );

  return { request, token, empresaId };
}