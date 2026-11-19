import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function RedefinirSenhaPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);

  if (!tokenFromUrl.trim()) {
    return <Navigate to="/login/esqueci-senha" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch<{ message: string }>('/v1/auth/redefinir-senha', {
        method: 'POST',
        body: JSON.stringify({ token: tokenFromUrl, nova_senha: novaSenha }),
      });
      setConcluido(true);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível redefinir a senha');
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
          <CardTitle>Nova senha</CardTitle>
          <CardDescription>Escolha uma senha com no mínimo 8 caracteres.</CardDescription>
        </CardHeader>
        <CardContent>
          {concluido ? (
            <div className="space-y-3 text-sm">
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                Senha redefinida com sucesso. Faça login com a nova senha.
              </p>
              <Link to="/login" className="text-lexius-600 hover:underline">
                Ir para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-sm font-medium" htmlFor="nova">
                  Nova senha
                </label>
                <Input
                  id="nova"
                  type="password"
                  autoComplete="new-password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-2 text-left">
                <label className="text-sm font-medium" htmlFor="confirmar">
                  Confirmar senha
                </label>
                <Input
                  id="confirmar"
                  type="password"
                  autoComplete="new-password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Salvando…' : 'Redefinir senha'}
              </Button>
              <p className="text-center text-sm">
                <Link to="/login" className="text-lexius-600 hover:underline">
                  Voltar ao login
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}