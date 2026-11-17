import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      await login(email, senha);
      navigate('/', { replace: true });
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-[#1e3a5f] to-slate-800 p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-lexius-600 text-white">
            <Wallet className="h-6 w-6" />
          </div>
          <CardTitle>Lexius Financeiro</CardTitle>
          <CardDescription>Entre com suas credenciais da API NestJS</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2 text-left">
              <label className="text-sm font-medium" htmlFor="email">
                E-mail
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="master@lexius.local"
                required
              />
            </div>
            <div className="space-y-2 text-left">
              <label className="text-sm font-medium" htmlFor="senha">
                Senha
              </label>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
            {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}