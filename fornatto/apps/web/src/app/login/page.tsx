'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiLogin, apiSelectCompany } from '@/lib/api/client';
import { saveSession } from '@/lib/auth/session';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@fornatto.app');
  const [password, setPassword] = useState('fornatto123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      let token = res.accessToken;
      let companyName = res.companies[0]?.name ?? 'Empresa';

      if (res.companies.length === 1) {
        const selected = await apiSelectCompany(token, res.companies[0].id);
        token = selected.accessToken;
        companyName = res.companies[0].name;
      } else if (res.companies.length > 1) {
        const selected = await apiSelectCompany(token, res.companies[0].id);
        token = selected.accessToken;
        companyName = res.companies[0].name;
      }

      saveSession({
        accessToken: token,
        userName: res.user.name,
        companyName,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-fornatto-brown p-4">
      <Card className="w-full max-w-md border-fornatto-gold/30">
        <CardHeader>
          <CardTitle className="text-center text-xl text-fornatto-gold">FORNATTO</CardTitle>
          <p className="text-center text-sm text-fornatto-brown/70">Acesso ao painel</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm">
              E-mail
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-fornatto-brown/20 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              Senha
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-fornatto-brown/20 px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}