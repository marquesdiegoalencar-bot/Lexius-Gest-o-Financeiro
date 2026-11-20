import { useCallback, useEffect, useState } from 'react';
import { Loader2, PieChart, Wallet } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { ApiError } from '@/lib/api';
import { formatBRL } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Titulo = { id: string; descricao: string; valorOriginal: string; dataVencimento: string };

type RateioLinha = {
  linha: number;
  centro_custo_id?: string;
  departamento_id?: string;
  percentual?: number;
  valor?: number;
};

type Versao = { id: string; ano: number; mes: number; nome: string | null; status: string };

export function FinanceiroDgPage() {
  const { request } = useApi();
  const [tab, setTab] = useState<'rateio' | 'orcamento'>('rateio');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [lado, setLado] = useState<'receber' | 'pagar'>('receber');
  const [modo, setModo] = useState<'PERCENTUAL' | 'VALOR_FIXO'>('PERCENTUAL');
  const [titulosRec, setTitulosRec] = useState<Titulo[]>([]);
  const [titulosPag, setTitulosPag] = useState<Titulo[]>([]);
  const [tituloId, setTituloId] = useState('');
  const [definicaoId, setDefinicaoId] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<RateioLinha[]>([{ linha: 1, percentual: 100 }]);
  const [vigenteDesde, setVigenteDesde] = useState(new Date().toISOString().slice(0, 10));
  const [cc, setCc] = useState<{ id: string; nome: string }[]>([]);
  const [dept, setDept] = useState<{ id: string; nome: string }[]>([]);
  const [historico, setHistorico] = useState<{ status: string; id: string }[]>([]);

  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [versaoSel, setVersaoSel] = useState<string>('');
  const [orcAno, setOrcAno] = useState(String(new Date().getFullYear()));
  const [orcMes, setOrcMes] = useState(String(new Date().getMonth() + 1));
  const [categoriaId, setCategoriaId] = useState('');
  const [valorPrevisto, setValorPrevisto] = useState('1000');
  const [comparativo, setComparativo] = useState<{
    totais: { previsto: number; realizado: number; variacao: number };
    linhas: { valor_previsto: number; valor_realizado: number; variacao: number }[];
  } | null>(null);

  const bootstrapRateio = useCallback(async () => {
    try {
      const [trs, tps, centros, departamentos, cats] = await Promise.all([
        request<Titulo[]>('/v1/titulos-receber?status=ABERTO'),
        request<Titulo[]>('/v1/titulos-pagar?status=ABERTO'),
        request<{ id: string; nome: string }[]>('/v1/centros-custo?ativo=true'),
        request<{ id: string; nome: string }[]>('/v1/departamentos?ativo=true'),
        request<{ id: string; nome: string }[]>('/v1/categorias?natureza=RECEITA'),
      ]);
      setTitulosRec(trs);
      setTitulosPag(tps);
      setCc(centros);
      setDept(departamentos);
      if (cats[0]) setCategoriaId(cats[0].id);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao carregar dados');
    }
  }, [request]);

  const bootstrapOrcamento = useCallback(async () => {
    try {
      const v = await request<Versao[]>('/v1/orcamento/versoes');
      setVersoes(v);
      if (v[0]) setVersaoSel(v[0].id);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao listar orçamentos');
    }
  }, [request]);

  useEffect(() => {
    void (tab === 'rateio' ? bootstrapRateio() : bootstrapOrcamento());
  }, [tab, bootstrapRateio, bootstrapOrcamento]);

  const titulos = lado === 'receber' ? titulosRec : titulosPag;
  const tituloSel = titulos.find((t) => t.id === tituloId);
  const valorTitulo = tituloSel ? Number(tituloSel.valorOriginal) : 0;
  const somaPct = linhas.reduce((s, l) => s + (l.percentual ?? 0), 0);
  const somaValor = linhas.reduce((s, l) => s + (l.valor ?? 0), 0);

  const criarRascunho = async () => {
    if (!tituloId) return;
    setLoading(true);
    setErro(null);
    try {
      const path =
        lado === 'receber'
          ? `/v1/rateio/titulos-receber/${tituloId}/rascunho`
          : `/v1/rateio/titulos-pagar/${tituloId}/rascunho`;
      const r = await request<{ definicao: { id: string } }>(path, {
        method: 'POST',
        body: JSON.stringify({ modo }),
      });
      setDefinicaoId(r.definicao.id);
      setLinhas(
        modo === 'PERCENTUAL'
          ? [{ linha: 1, percentual: 100 }]
          : [{ linha: 1, valor: valorTitulo || 0 }],
      );
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao criar rascunho');
    } finally {
      setLoading(false);
    }
  };

  const salvarRateio = async () => {
    if (!definicaoId) return;
    setLoading(true);
    setErro(null);
    try {
      await request(`/v1/rateio/definicoes/${definicaoId}/itens`, {
        method: 'PUT',
        body: JSON.stringify({ itens: linhas }),
      });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao salvar itens');
    } finally {
      setLoading(false);
    }
  };

  const confirmarRateio = async () => {
    if (!definicaoId) return;
    setLoading(true);
    setErro(null);
    try {
      await request(`/v1/rateio/definicoes/${definicaoId}/confirmar`, {
        method: 'POST',
        body: JSON.stringify({ vigente_desde: vigenteDesde }),
      });
      const histPath =
        lado === 'receber'
          ? `/v1/rateio/titulos-receber/${tituloId}/historico`
          : `/v1/rateio/titulos-pagar/${tituloId}/historico`;
      const h = await request<{ status: string; id: string }[]>(histPath);
      setHistorico(h);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao confirmar');
    } finally {
      setLoading(false);
    }
  };

  const criarVersao = async () => {
    setLoading(true);
    setErro(null);
    try {
      const v = await request<Versao>('/v1/orcamento/versoes', {
        method: 'POST',
        body: JSON.stringify({ ano: Number(orcAno), mes: Number(orcMes), nome: 'Painel' }),
      });
      setVersaoSel(v.id);
      await bootstrapOrcamento();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao criar versão');
    } finally {
      setLoading(false);
    }
  };

  const salvarItemOrcamento = async () => {
    if (!versaoSel || !categoriaId) return;
    setLoading(true);
    try {
      await request(`/v1/orcamento/versoes/${versaoSel}/itens`, {
        method: 'POST',
        body: JSON.stringify({ itens: [{ categoria_id: categoriaId, valor_previsto: Number(valorPrevisto) }] }),
      });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao salvar item');
    } finally {
      setLoading(false);
    }
  };

  const aprovarVersao = async () => {
    if (!versaoSel) return;
    setLoading(true);
    try {
      await request(`/v1/orcamento/versoes/${versaoSel}/aprovar`, { method: 'PATCH' });
      await bootstrapOrcamento();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao aprovar');
    } finally {
      setLoading(false);
    }
  };

  const carregarComparativo = async () => {
    if (!versaoSel) return;
    setLoading(true);
    try {
      const c = await request<typeof comparativo>(`/v1/orcamento/versoes/${versaoSel}/realizado-vs-previsto`);
      setComparativo(c);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha comparativo');
    } finally {
      setLoading(false);
    }
  };

  const carregarHistorico = async () => {
    if (!tituloId) return;
    const histPath =
      lado === 'receber'
        ? `/v1/rateio/titulos-receber/${tituloId}/historico`
        : `/v1/rateio/titulos-pagar/${tituloId}/historico`;
    const h = await request<{ status: string; id: string }[]>(histPath);
    setHistorico(h);
  };

  const cancelarRascunho = async () => {
    if (!definicaoId) return;
    setLoading(true);
    try {
      await request(`/v1/rateio/definicoes/${definicaoId}/cancelar`, { method: 'PATCH' });
      setDefinicaoId(null);
      await carregarHistorico();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao cancelar');
    } finally {
      setLoading(false);
    }
  };

  const fecharOrcamento = async () => {
    if (!versaoSel) return;
    setLoading(true);
    try {
      await request(`/v1/orcamento/versoes/${versaoSel}/fechar`, { method: 'PATCH' });
      await bootstrapOrcamento();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao fechar');
    } finally {
      setLoading(false);
    }
  };

  const cancelarOrcamento = async () => {
    if (!versaoSel) return;
    setLoading(true);
    try {
      await request(`/v1/orcamento/versoes/${versaoSel}/cancelar`, { method: 'PATCH' });
      await bootstrapOrcamento();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao cancelar versão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lexius-600 to-lexius-800 text-white">
          <Wallet className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold text-slate-900">Rateio e Orçamento</h2>
          <p className="mt-1 text-slate-600">Distribuição dimensional e versões orçamentárias.</p>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant={tab === 'rateio' ? 'default' : 'outline'} size="sm" onClick={() => setTab('rateio')}>
              Rateio
            </Button>
            <Button type="button" variant={tab === 'orcamento' ? 'default' : 'outline'} size="sm" onClick={() => setTab('orcamento')}>
              Orçamento
            </Button>
          </div>
        </div>
      </div>

      {erro ? <p className="text-sm text-amber-800">{erro}</p> : null}

      {tab === 'rateio' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rateio dimensional</CardTitle>
            <CardDescription>
              {modo === 'PERCENTUAL'
                ? `Soma %: ${somaPct.toFixed(2)}% (meta 100%)`
                : `Soma valores: ${formatBRL(somaValor)} / ${formatBRL(valorTitulo)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={lado === 'receber' ? 'default' : 'outline'} onClick={() => setLado('receber')}>
                A receber
              </Button>
              <Button type="button" size="sm" variant={lado === 'pagar' ? 'default' : 'outline'} onClick={() => setLado('pagar')}>
                A pagar
              </Button>
              <select
                className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                value={modo}
                onChange={(e) => setModo(e.target.value as typeof modo)}
              >
                <option value="PERCENTUAL">Percentual</option>
                <option value="VALOR_FIXO">Valor fixo</option>
              </select>
            </div>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Título</span>
              <select
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={tituloId}
                onChange={(e) => setTituloId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {titulos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.descricao} · {formatBRL(t.valorOriginal)} · venc. {String(t.dataVencimento).slice(0, 10)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={!tituloId || loading} onClick={() => void criarRascunho()}>
                Criar rascunho
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!definicaoId || loading} onClick={() => void salvarRateio()}>
                Salvar linhas
              </Button>
              <Input type="date" className="w-auto" value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} />
              <Button type="button" size="sm" disabled={!definicaoId || loading} onClick={() => void confirmarRateio()}>
                Confirmar rateio
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!definicaoId || loading} onClick={() => void cancelarRascunho()}>
                Cancelar rascunho
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={!tituloId || loading} onClick={() => void carregarHistorico()}>
                Histórico
              </Button>
            </div>
            {linhas.map((l, idx) => (
              <div key={l.linha} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 p-3">
                <span className="text-xs font-medium text-slate-500">Linha {l.linha}</span>
                <select
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                  value={l.centro_custo_id ?? ''}
                  onChange={(e) => {
                    const next = [...linhas];
                    next[idx] = { ...l, centro_custo_id: e.target.value || undefined };
                    setLinhas(next);
                  }}
                >
                  <option value="">Centro —</option>
                  {cc.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                  value={l.departamento_id ?? ''}
                  onChange={(e) => {
                    const next = [...linhas];
                    next[idx] = { ...l, departamento_id: e.target.value || undefined };
                    setLinhas(next);
                  }}
                >
                  <option value="">Depto —</option>
                  {dept.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
                </select>
                {modo === 'PERCENTUAL' ? (
                  <Input
                    type="number"
                    className="w-24"
                    placeholder="%"
                    value={l.percentual ?? ''}
                    onChange={(e) => {
                      const next = [...linhas];
                      next[idx] = { ...l, percentual: Number(e.target.value) };
                      setLinhas(next);
                    }}
                  />
                ) : (
                  <Input
                    type="number"
                    className="w-28"
                    placeholder="R$"
                    value={l.valor ?? ''}
                    onChange={(e) => {
                      const next = [...linhas];
                      next[idx] = { ...l, valor: Number(e.target.value) };
                      setLinhas(next);
                    }}
                  />
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLinhas([
                  ...linhas,
                  modo === 'PERCENTUAL'
                    ? { linha: linhas.length + 1, percentual: 0 }
                    : { linha: linhas.length + 1, valor: 0 },
                ])
              }
            >
              Adicionar linha
            </Button>
            {historico.length > 0 ? (
              <ul className="text-sm text-slate-600">
                {historico.map((h) => (
                  <li key={h.id}>
                    {h.id.slice(0, 8)}… · {h.status}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-4 w-4" /> Orçamento
            </CardTitle>
            <CardDescription>Versões, aprovação e previsto × realizado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input className="w-24" value={orcAno} onChange={(e) => setOrcAno(e.target.value)} />
              <Input className="w-20" value={orcMes} onChange={(e) => setOrcMes(e.target.value)} />
              <Button type="button" size="sm" disabled={loading} onClick={() => void criarVersao()}>
                Nova versão
              </Button>
            </div>
            <select
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={versaoSel}
              onChange={(e) => setVersaoSel(e.target.value)}
            >
              {versoes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.ano}/{String(v.mes).padStart(2, '0')} · {v.status} {v.nome ?? ''}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <Input type="number" className="w-32" value={valorPrevisto} onChange={(e) => setValorPrevisto(e.target.value)} />
              <Button type="button" size="sm" variant="outline" disabled={!versaoSel || loading} onClick={() => void salvarItemOrcamento()}>
                Salvar item folha
              </Button>
              <Button type="button" size="sm" disabled={!versaoSel || loading} onClick={() => void aprovarVersao()}>
                Aprovar
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!versaoSel || loading} onClick={() => void fecharOrcamento()}>
                Fechar
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!versaoSel || loading} onClick={() => void cancelarOrcamento()}>
                Cancelar
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!versaoSel || loading} onClick={() => void carregarComparativo()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Previsto × realizado'}
              </Button>
            </div>
            {comparativo ? (
              <div className="rounded-lg border border-slate-100 p-3 text-sm">
                <p>
                  Previsto {formatBRL(comparativo.totais.previsto)} · Realizado {formatBRL(comparativo.totais.realizado)} · Variação{' '}
                  {formatBRL(comparativo.totais.variacao)}
                </p>
                <p className="mt-1 text-slate-500">{comparativo.linhas.length} linha(s)</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}