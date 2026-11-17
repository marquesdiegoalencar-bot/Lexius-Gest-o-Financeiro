import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, Banknote, TrendingDown, TrendingUp } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { formatBRL } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type TituloResumo = {
  valorOriginal: string;
  valorRecebido?: string;
  valorPago?: string;
};

type Vencidos = {
  referencia?: string;
  titulos_receber?: TituloResumo[];
  titulos_pagar?: TituloResumo[];
};

function totalSaldoTitulosReceber(titulos: TituloResumo[]) {
  return titulos.reduce(
    (s, t) => s + (Number(t.valorOriginal) - Number(t.valorRecebido ?? 0)),
    0,
  );
}

function totalSaldoTitulosPagar(titulos: TituloResumo[]) {
  return titulos.reduce((s, t) => s + (Number(t.valorOriginal) - Number(t.valorPago ?? 0)), 0);
}

type ContaBancaria = {
  id: string;
  apelido: string;
  saldoInicial?: string;
  saldoBanco?: string | null;
};

export function DashboardPage() {
  const { request } = useApi();
  const [vencidos, setVencidos] = useState<Vencidos | null>(null);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, c] = await Promise.all([
          request<Vencidos>('/v1/relatorios/vencidos'),
          request<ContaBancaria[]>('/v1/contas-bancarias'),
        ]);
        if (!cancelled) {
          setVencidos(v);
          setContas(c);
          setErro(null);
        }
      } catch (e) {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Erro ao carregar dados');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request]);

  const saldoContas = useMemo(
    () =>
      contas.reduce((s, c) => s + Number(c.saldoBanco ?? c.saldoInicial ?? 0), 0),
    [contas],
  );

  const totalReceberVencido = useMemo(
    () => totalSaldoTitulosReceber(vencidos?.titulos_receber ?? []),
    [vencidos],
  );
  const totalPagarVencido = useMemo(
    () => totalSaldoTitulosPagar(vencidos?.titulos_pagar ?? []),
    [vencidos],
  );

  const chartData = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() - (6 - i));
      const fator = 0.85 + i * 0.04;
      return {
        dia: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
        entradas: Math.round((totalReceberVencido || 12000) * fator * 0.35),
        saidas: Math.round((totalPagarVencido || 8000) * fator * 0.28),
      };
    });
  }, [totalPagarVencido, totalReceberVencido]);

  const movimentos = useMemo(() => {
    return contas.slice(0, 5).map((c, i) => ({
      id: c.id,
      descricao: `Conta ${c.apelido}`,
      valor: Number(c.saldoBanco ?? c.saldoInicial ?? 0),
      tipo: i % 2 === 0 ? ('entrada' as const) : ('saida' as const),
    }));
  }, [contas]);

  return (
    <div className="space-y-6">
      {erro ? (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4" />
          {erro} — verifique se a API NestJS está em execução (proxy <code className="text-xs">/v1</code>).
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <IndicatorCard
          title="Saldo em contas"
          value={formatBRL(saldoContas)}
          icon={Banknote}
          hint={`${contas.length} conta(s) ativa(s)`}
        />
        <IndicatorCard
          title="A receber vencido"
          value={formatBRL(totalReceberVencido)}
          icon={TrendingUp}
          hint={`${vencidos?.titulos_receber?.length ?? 0} título(s)`}
          variant="success"
        />
        <IndicatorCard
          title="A pagar vencido"
          value={formatBRL(totalPagarVencido)}
          icon={TrendingDown}
          hint={`${vencidos?.titulos_pagar?.length ?? 0} título(s)`}
          variant="warning"
        />
        <IndicatorCard
          title="Posição líquida"
          value={formatBRL(totalReceberVencido - totalPagarVencido)}
          icon={Banknote}
          hint="Receber − pagar (vencidos)"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Fluxo da semana</CardTitle>
            <CardDescription>Entradas e saídas previstas (visualização; detalhe virá do extrato)</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Area type="monotone" dataKey="entradas" stroke="#2563eb" fill="#dbeafe" name="Entradas" />
                <Area type="monotone" dataKey="saidas" stroke="#f59e0b" fill="#fef3c7" name="Saídas" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Movimentações</CardTitle>
            <CardDescription>Últimas posições por conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {movimentos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma conta carregada.</p>
            ) : (
              movimentos.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{m.descricao}</p>
                    <Badge variant={m.tipo === 'entrada' ? 'success' : 'secondary'} className="mt-1">
                      {m.tipo === 'entrada' ? 'Posição' : 'Conta'}
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{formatBRL(m.valor)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IndicatorCard({
  title,
  value,
  hint,
  icon: Icon,
  variant,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  variant?: 'success' | 'warning';
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <div
          className={
            variant === 'success'
              ? 'text-emerald-600'
              : variant === 'warning'
                ? 'text-amber-600'
                : 'text-lexius-600'
          }
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  );
}