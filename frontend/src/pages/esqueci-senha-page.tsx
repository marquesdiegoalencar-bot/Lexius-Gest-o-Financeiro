import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type EsqueciResposta = {
  message: string;
  reset_token?: string;
  reset_path?: string;
};

export function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<EsqueciResposta | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setLoading(true);
    try {
      const data = await apiFetch<EsqueciResposta>('/v1/auth/esqueci-senha', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSucesso(data);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido');
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
          <CardTitle>Esqueci minha senha</CardTitle>
          <CardDescription>
            Informe o e-mail da sua conta. Em produção, enviaremos um link por e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sucesso ? (
            <div className="space-y-3 text-left text-sm">
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                {sucesso.message}
              </p>
              {sucesso.reset_token ? (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
                  <p className="font-medium text-amber-900">Modo desenvolvimento</p>
                  <p className="text-amber-800">
                    O servidor expôs o token porque o ambiente não é produção (ou{' '}
                    <code className="text-xs">PASSWORD_RESET_EXPOSE_TOKEN=true</code>).
                  </p>
                  <Link
                    to={
                      sucesso.reset_path ??
                      `/login/redefinir-senha?token=${encodeURIComponent(sucesso.reset_token)}`
                    }
                    className="inline-block font-medium text-lexius-700 hover:underline"
                  >
                    Abrir página de redefinição
                  </Link>
                </div>
              ) : null}
              <Link to="/login" className="text-lexius-600 hover:underline">
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-sm font-medium" htmlFor="email">
                  E-mail
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando…' : 'Enviar instruções'}
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