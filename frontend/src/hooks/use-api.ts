import { useCallback } from 'react';
import { apiFetch, type ApiFetchOptions } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function useApi() {
  const { token, empresaId } = useAuth();

  const request = useCallback(
    <T,>(path: string, options?: Omit<ApiFetchOptions, 'token' | 'empresaId'>) => {
      if (!token) {
        return Promise.reject(new Error('Faça login para continuar.'));
      }
      if (!empresaId && !path.startsWith('/v1/empresas') && path !== '/v1/auth/login') {
        return Promise.reject(new Error('Selecione uma empresa no cabeçalho.'));
      }
      return apiFetch<T>(path, {
        ...options,
        token,
        empresaId,
        headers: {
          Accept: 'application/json',
          ...(options?.headers as Record<string, string> | undefined),
        },
      });
    },
    [token, empresaId],
  );

  return { request, token, empresaId };
}