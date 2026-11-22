import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from './api';
import { clearUnauthorizedHandler, registerUnauthorizedHandler } from './session-events';

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
  logout: (redirectToLogin?: boolean) => void;
  setEmpresaId: (id: string) => void;
  empresaAtiva: EmpresaVinculo | null;
  isAuthenticated: boolean;
  upsertEmpresaVinculo: (v: EmpresaVinculo) => void;
  removeEmpresaVinculo: (empresaId: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeAuthState(raw: AuthState): AuthState {
  if (!raw.token || !raw.usuario) {
    return { token: null, usuario: null, empresaId: null };
  }
  const empresas = raw.usuario.empresas ?? [];
  let empresaId = raw.empresaId;
  if (!empresaId || !empresas.some((e) => e.empresa_id === empresaId)) {
    empresaId = empresas[0]?.empresa_id ?? null;
  }
  return { token: raw.token, usuario: raw.usuario, empresaId };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => normalizeAuthState(loadStored()));

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

  const logout = useCallback(
    (redirectToLogin = false) => {
      persist({ token: null, usuario: null, empresaId: null });
      if (redirectToLogin && typeof window !== 'undefined') {
        const base = window.location.pathname.startsWith('/login') ? '' : '/login?reason=session_expired';
        if (base) window.location.assign(base);
      }
    },
    [persist],
  );

  useEffect(() => {
    registerUnauthorizedHandler(() => logout(true));
    return () => clearUnauthorizedHandler();
  }, [logout]);

  const setEmpresaId = useCallback(
    (id: string) => {
      persist({ ...state, empresaId: id });
    },
    [persist, state],
  );

  const upsertEmpresaVinculo = useCallback(
    (v: EmpresaVinculo) => {
      if (!state.usuario) return;
      const empresas = [...state.usuario.empresas];
      const ix = empresas.findIndex((e) => e.empresa_id === v.empresa_id);
      if (ix >= 0) empresas[ix] = { ...empresas[ix], ...v };
      else empresas.push(v);
      persist({
        ...state,
        usuario: { ...state.usuario, empresas },
        empresaId: state.empresaId ?? v.empresa_id,
      });
    },
    [persist, state],
  );

  const removeEmpresaVinculo = useCallback(
    (removedId: string) => {
      if (!state.usuario) return;
      const empresas = state.usuario.empresas.filter((e) => e.empresa_id !== removedId);
      const nextEmpresaId =
        state.empresaId === removedId ? (empresas[0]?.empresa_id ?? null) : state.empresaId;
      persist({
        ...state,
        usuario: { ...state.usuario, empresas },
        empresaId: nextEmpresaId,
      });
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
      upsertEmpresaVinculo,
      removeEmpresaVinculo,
    }),
    [state, login, logout, setEmpresaId, empresaAtiva, upsertEmpresaVinculo, removeEmpresaVinculo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve estar dentro de AuthProvider');
  return ctx;
}