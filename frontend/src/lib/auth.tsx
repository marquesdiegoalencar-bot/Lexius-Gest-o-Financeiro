import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from './api';

export type EmpresaVinculo = {
  empresa_id: string;
  papel: string;
  razao_social?: string;
};

export type UsuarioLogin = {
  id: string;
  nome: string;
  email: string;
  empresas: EmpresaVinculo[];
};

type LoginResponse = {
  access_token: string;
  usuario: UsuarioLogin;
};

type AuthState = {
  token: string | null;
  usuario: UsuarioLogin | null;
  empresaId: string | null;
};

const STORAGE_KEY = 'lexius_financeiro_auth';

function loadStored(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, usuario: null, empresaId: null };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { token: null, usuario: null, empresaId: null };
  }
}

type AuthContextValue = AuthState & {
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  setEmpresaId: (id: string) => void;
  empresaAtiva: EmpresaVinculo | null;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadStored);

  const persist = useCallback((next: AuthState) => {
    setState(next);
    if (next.token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const login = useCallback(
    async (email: string, senha: string) => {
      const data = await apiFetch<LoginResponse>('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
      });
      const empresaId = data.usuario.empresas[0]?.empresa_id ?? null;
      persist({
        token: data.access_token,
        usuario: data.usuario,
        empresaId,
      });
    },
    [persist],
  );

  const logout = useCallback(() => {
    persist({ token: null, usuario: null, empresaId: null });
  }, [persist]);

  const setEmpresaId = useCallback(
    (id: string) => {
      persist({ ...state, empresaId: id });
    },
    [persist, state],
  );

  const empresaAtiva = useMemo(() => {
    if (!state.usuario || !state.empresaId) return null;
    return state.usuario.empresas.find((e) => e.empresa_id === state.empresaId) ?? null;
  }, [state.empresaId, state.usuario]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      setEmpresaId,
      empresaAtiva,
      isAuthenticated: Boolean(state.token && state.empresaId),
    }),
    [state, login, logout, setEmpresaId, empresaAtiva],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve estar dentro de AuthProvider');
  return ctx;
}