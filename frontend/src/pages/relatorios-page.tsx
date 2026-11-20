import { useEffect, useState } from 'react';
import { LineChart, Loader2, RefreshCw } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { ApiError } from '@/lib/api';
import { formatBRL } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type TituloLinha = {
  id?: string;
  descricao?: string;
  valorOriginal?: string;
  valorRecebido?: string;
  valorPago?: string;
  dataVencimento?: string;
  status?: string;
};

type RelatorioTitulos = {
  titulos?: TituloLinha[];
  quantidade?: number;
  saldo?: number;
};

export function RelatoriosPage() {
  const { request } = useApi();
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [de, setDe] = useState(primeiroDia);
  const [ate, setAte] = useState(ultimoDia);
  const [vencidos, setVencidos] = useState<{ titulos_receber?: TituloLinha[]; titulos_pagar?: TituloLinha[] } | null>(
    null,
  );
  const [receber, setReceber] = useState<RelatorioTitulos | null>(null);
  const [pagar, setPagar] = useState<RelatorioTitulos | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [dre, setDre] = useState<{
    modalidade: string;
    totais: { receitas: number; despesas: number; resultado: number };
    linhas: { categoria_nome: string; natureza: string; valor: number }[];
    avisos?: { titulos_sem_classificacao_temporal: { quantidade: number; valor_excluido: number } };
  } | null>(null);
  const [dreModalidade, setDreModalidade] = useState<'competencia' | 'caixa'>('competencia');
  const [filtroNatureza, setFiltroNatureza] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroCentro, setFiltroCentro] = useState('');
  const [filtroDept, setFiltroDept] = useState('');
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [centros, setCentros] = useState<{ id: string; nome: string }[]>([]);
  const [departamentos, setDepartamentos] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [c, cc, d] = await Promise.all([
          request<{ id: string; nome: string }[]>('/v1/categorias'),
          request<{ id: string; nome: string }[]>('/v1/centros-custo?ativo=true'),
          request<{ id: string; nome: string }[]>('/v1/departamentos?ativo=true'),
        ]);
        setCategorias(c);
        setCentros(cc);
        setDepartamentos(d);
      } catch {
        /* filtros opcionais */
      }
    })();
  }, [request]);

  const dreQuery = () => {
    const q = new URLSearchParams({ de, ate });
    if (filtroNatureza) q.set('natureza', filtroNatureza);
    if (filtroCategoria) q.set('categoria_id', filtroCategoria);
    if (filtroCentro) q.set('centro_custo_id', filtroCentro);
    if (filtroDept) q.set('departamento_id', filtroDept);
    return q;
  };

  const run = async (tipo: 'vencidos' | 'receber' | 'pagar') => {
    setLoading(tipo);
    setErro(null);
    try {
      if (tipo === 'vencidos') {
        const v = await request<typeof vencidos>('/v1/relatorios/vencidos');
        setVencidos(v);
      } else if (tipo === 'receber') {
        const q = new URLSearchParams({ de, ate });
        const r = await request<RelatorioTitulos>(`/v1/relatorios/titulos-receber?${q}`);
        setReceber(r);
      } else {
        const q = new URLSearchParams({ de, ate });
        const p = await request<RelatorioTitulos>(`/v1/relatorios/titulos-pagar?${q}`);
        setPagar(p);
      }
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao gerar relatório');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lexius-600 to-lexius-800 text-white">
          <LineChart className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Relatórios</h2>
          <p className="mt-1 text-slate-600">
            Inadimplência, títulos e DRE. Competência: data de competência ou emissão (ver{' '}
            <code className="text-xs">docs/DRE-COMPETENCIA.md</code>).
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">De</span>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Até</span>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">DRE</span>
            <select
              className="block rounded-md border border-slate-200 px-2 py-2 text-sm"
              value={dreModalidade}
              onChange={(e) => setDreModalidade(e.target.value as 'competencia' | 'caixa')}
            >
              <option value="competencia">Competência</option>
              <option value="caixa">Caixa</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Natureza</span>
            <select
              className="block rounded-md border border-slate-200 px-2 py-2 text-sm"
              value={filtroNatureza}
              onChange={(e) => setFiltroNatureza(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="RECEITA">Receita</option>
              <option value="DESPESA">Despesa</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Categoria</span>
            <select
              className="block max-w-[10rem] rounded-md border border-slate-200 px-2 py-2 text-sm"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Centro de custo</span>
            <select
              className="block max-w-[10rem] rounded-md border border-slate-200 px-2 py-2 text-sm"
              value={filtroCentro}
              onChange={(e) => setFiltroCentro(e.target.value)}
            >
              <option value="">Todos</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Departamento</span>
            <select
              className="block max-w-[10rem] rounded-md border border-slate-200 px-2 py-2 text-sm"
              value={filtroDept}
              onChange={(e) => setFiltroDept(e.target.value)}
            >
              <option value="">Todos</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={loading !== null}
            onClick={() => void run('vencidos')}
          >
            {loading === 'vencidos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Vencidos
          </Button>
          <Button type="button" size="sm" disabled={loading !== null} onClick={() => void run('receber')}>
            Títulos a receber
          </Button>
          <Button type="button" size="sm" disabled={loading !== null} onClick={() => void run('pagar')}>
            Títulos a pagar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading !== null}
            onClick={async () => {
              setLoading('dre');
              setErro(null);
              try {
                const r = await request<typeof dre>(`/v1/dre/${dreModalidade}?${dreQuery()}`);
                setDre(r);
              } catch (e) {
                setErro(e instanceof ApiError ? e.message : 'Falha DRE');
              } finally {
                setLoading(null);
              }
            }}
          >
            {loading === 'dre' ? 'DRE…' : 'Gerar DRE'}
          </Button>
        </div>
      </div>

      {erro ? <p className="text-sm text-amber-800">{erro}</p> : null}

      {vencidos ? (
        <ReportBlock
          title="Vencidos"
          receber={vencidos.titulos_receber ?? []}
          pagar={vencidos.titulos_pagar ?? []}
        />
      ) : null}
      {receber ? (
        <ReportBlock
          title={`Títulos a receber (${receber.quantidade ?? 0}) · saldo ${formatBRL(receber.saldo ?? 0)}`}
          receber={receber.titulos ?? []}
        />
      ) : null}
      {pagar ? (
        <ReportBlock
          title={`Títulos a pagar (${pagar.quantidade ?? 0}) · saldo ${formatBRL(pagar.saldo ?? 0)}`}
          pagar={pagar.titulos ?? []}
        />
      ) : null}

      {dre ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              DRE · {dre.modalidade === 'caixa' ? 'Caixa' : 'Competência'}
            </CardTitle>
            <CardDescription>
              Receitas {formatBRL(dre.totais.receitas)} · Despesas {formatBRL(dre.totais.despesas)} · Resultado{' '}
              {formatBRL(dre.totais.resultado)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dre.avisos?.titulos_sem_classificacao_temporal?.quantidade ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {dre.avisos.titulos_sem_classificacao_temporal.quantidade} título(s) sem competência nem emissão —{' '}
                {formatBRL(dre.avisos.titulos_sem_classificacao_temporal.valor_excluido)} excluídos do demonstrativo.
              </p>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Categoria</th>
                    <th className="px-3 py-2">Natureza</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {dre.linhas.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-slate-500">
                        Sem linhas no período.
                      </td>
                    </tr>
                  ) : (
                    dre.linhas.map((l, i) => (
                      <tr key={`${l.categoria_nome}-${i}`} className="border-t border-slate-100">
                        <td className="px-3 py-2">{l.categoria_nome}</td>
                        <td className="px-3 py-2">{l.natureza}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatBRL(l.valor)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ReportBlock({
  title,
  receber = [],
  pagar = [],
}: {
  title: string;
  receber?: TituloLinha[];
  pagar?: TituloLinha[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {receber.length} a receber · {pagar.length} a pagar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {receber.length > 0 ? (
          <MiniTable tipo="receber" rows={receber} />
        ) : pagar.length > 0 ? (
          <MiniTable tipo="pagar" rows={pagar} />
        ) : (
          <p className="text-sm text-slate-500">Sem títulos no relatório.</p>
        )}
      </CardContent>
    </Card>
  );
}

function MiniTable({ rows, tipo }: { rows: TituloLinha[]; tipo: 'receber' | 'pagar' }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-3 py-2">Descrição</th>
            <th className="px-3 py-2">Vencimento</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((r) => (
            <tr key={r.id ?? r.descricao} className="border-t border-slate-100">
              <td className="px-3 py-2">{r.descricao ?? '—'}</td>
              <td className="px-3 py-2">{r.dataVencimento?.slice(0, 10) ?? '—'}</td>
              <td className="px-3 py-2">{r.status ?? '—'}</td>
              <td className="px-3 py-2 text-right font-medium">
                {formatBRL(
                  tipo === 'receber'
                    ? Number(r.valorOriginal ?? 0) - Number(r.valorRecebido ?? 0)
                    : Number(r.valorOriginal ?? 0) - Number(r.valorPago ?? 0),
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}