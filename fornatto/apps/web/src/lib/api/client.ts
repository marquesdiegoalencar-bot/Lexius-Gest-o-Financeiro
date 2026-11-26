const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string };
  companies: { id: string; name: string; slug: string; role: string }[];
  requiresCompanySelection: boolean;
};

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Falha no login');
  }
  return res.json();
}

export async function apiSelectCompany(accessToken: string, companyId: string) {
  const res = await fetch(`${API_URL}/auth/select-company`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ companyId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Falha ao selecionar empresa');
  }
  return res.json() as Promise<{ accessToken: string }>;
}