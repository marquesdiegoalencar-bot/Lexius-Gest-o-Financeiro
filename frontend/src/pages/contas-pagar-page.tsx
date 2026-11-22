import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpCircle, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { StatusBadge } from '@/components/api-resource-page';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatBRL } from '@/lib/utils';

type TituloRow = {
  id: string;
  descricao: string;
  valorOriginal: string;
  dataVencimento: string;
  status: string;
};

type SelectOpt = { id: string; nome: string; codigo?: string | null; apelido?: string };

const PAPEIS_LANCAR = new Set(['MASTER', 'ADMIN', 'FINANCEIRO', 'OPERADOR']);

const emptyForm = () => ({
  descricao: '',
  valor_original: '',
  data_vencimento: new Date().toISOString().slice(0, 10),
  data_competencia: '',
  categoria_id: '',
  fornecedor_id: '',
  centro_custo_id: '',
  departamento_id: '',
  conta_bancaria_id: '',
  observacao: '',
});

export function ContasPagarPage() {
  const { request, empresaId } = useApi();
  const { empresaAtiva } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const podeLancar = PAPEIS_LANCAR.has(empresaAtiva?.papel ?? '');

  const [rows, setRows] = useState<TituloRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState<SelectOpt[]>([]);
  const [cc, setCc] = useState<SelectOpt[]>([]);
  const [dept, setDept] = useState<SelectOpt[]>([]);
  const [pessoas, setPessoas] = useState<SelectOpt[]>([]);
  const [contas, setContas] = useState<SelectOpt[]>([]);
  const [optsLoading, setOptsLoading] = useState(false);

  const loadList = useCallback(
    async (silent?: boolean) => {
      if (!empresaId) {
        setRows([]);
        setLoading(false);
        return;
      }
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await request<TituloRow[]>('/v1/titulos-pagar');
        setRows(data);
        setErro(null);
      } catch (e) {
        setErro(e instanceof ApiError ? e.message : 'Erro ao carregar títulos');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request, empresaId],
  );

  const loadFormOptions = useCallback(async () => {
    setOptsLoading(true);
    try {
      const [c, centros, departamentos, pes, cts] = await Promise.all([
        request<SelectOpt[]>('/v1/categorias?natureza=DESPESA'),
        request<SelectOpt[]>('/v1/centros-custo?tipo=SAIDA').catch(() => [] as SelectOpt[]),
        request<SelectOpt[]>('/v1/departamentos?ativo=true').catch(() => [] as SelectOpt[]),
        request<SelectOpt[]>('/v1/pessoas').catch(() => [] as SelectOpt[]),
        request<SelectOpt[]>('/v1/contas-bancarias').catch(() => [] as SelectOpt[]),
      ]);
      setCats(c);
      setCc(centros);
      setDept(departamentos);
      setPessoas(pes);
      setContas(cts);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao carregar opções do formulário');
    } finally {
      setOptsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const abrirNovo = useCallback(async () => {
    if (!podeLancar) return;
    setForm(emptyForm());
    setFormOpen(true);
    setSucesso(null);
    setErro(null);
    await loadFormOptions();
  }, [loadFormOptions, podeLancar]);

  useEffect(() => {
    if (searchParams.get('novo') === '1' && podeLancar && empresaId) {
      void abrirNovo();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, abrirNovo, podeLancar, empresaId]);

  const cancelForm = () => {
    setFormOpen(false);
    setForm(emptyForm());
  };

  const save = async () => {
    if (!empresaId) {
      setErro('Selecione uma empresa no cabeçalho.');
      return;
    }
    if (!form.descricao.trim()) {
      setErro('Informe a descrição.');
      return;
    }
    const valor = Number(form.valor_original);
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe um valor válido.');
      return;
    }
    if (!form.categoria_id) {
      setErro('Selecione uma categoria.');
      return;
    }
    setSaving(true);
    setErro(null);
    setSucesso(null);
    try {
      const body: Record<string, unknown> = {
        descricao: form.descricao.trim(),
        valor_original: valor,
        data_vencimento: form.data_vencimento,
        categoria_id: form.categoria_id,
      };
      if (form.fornecedor_id) body.fornecedor_id = form.fornecedor_id;
      if (form.centro_custo_id) body.centro_custo_id = form.centro_custo_id;
      if (form.departamento_id) body.departamento_id = form.departamento_id;
      if (form.conta_bancaria_id) body.conta_bancaria_id = form.conta_bancaria_id;
      if (form.data_competencia) body.data_competencia = form.data_competencia;
      if (form.observacao.trim()) body.observacao = form.observacao.trim();

      await request('/v1/titulos-pagar', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSucesso('Título a pagar lançado (aguarda aprovação se exigido pelo fluxo).');
      cancelForm();
      await loadList(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const count = useMemo(() => rows.length, [rows]);

  return (
    <div className="space-y-6">
      <PageHero
        title="Contas a Pagar"
        description="Lançamento de despesas, aprovação e pagamento."
        icon={ArrowUpCircle}
        count={count}
      />

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={loading || refreshing}
            onClick={() => void loadList(true)}
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
          {podeLancar ? (
            <Button type="button" size="sm" className="gap-2" onClick={() => void abrirNovo()}>
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          ) : (
            <span className="text-xs text-slate-500">Perfil só leitura — lançamento indisponível</span>
          )}
        </div>
      </div>

      {sucesso ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{sucesso}</p>
      ) : null}
      {erro ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{erro}</p>
      ) : null}

      {formOpen && podeLancar ? (
        <Card className="border-lexius-200 shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <p className="text-sm font-medium text-slate-800">Novo título a pagar</p>
              {optsLoading ? (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando categorias e cadastros…
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">Descrição *</span>
                  <Input
                    value={form.descricao}
                    onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Valor *</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.valor_original}
                    onChange={(e) => setForm((f) => ({ ...f, valor_original: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Vencimento *</span>
                  <Input
                    type="date"
                    value={form.data_vencimento}
                    onChange={(e) => setForm((f) => ({ ...f, data_vencimento: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Competência</span>
                  <Input
                    type="date"
                    value={form.data_competencia}
                    onChange={(e) => setForm((f) => ({ ...f, data_competencia: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">Categoria *</span>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    value={form.categoria_id}
                    onChange={(e) => setForm((f) => ({ ...f, categoria_id: e.target.value }))}
                  >
                    <option value="">Selecione…</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo ? `${c.codigo} — ` : ''}
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">Fornecedor (pessoa)</span>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    value={form.fornecedor_id}
                    onChange={(e) => setForm((f) => ({ ...f, fornecedor_id: e.target.value }))}
                  >
                    <option value="">—</option>
                    {pessoas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Centro de custo</span>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    value={form.centro_custo_id}
                    onChange={(e) => setForm((f) => ({ ...f, centro_custo_id: e.target.value }))}
                  >
                    <option value="">—</option>
                    {cc.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Departamento</span>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    value={form.departamento_id}
                    onChange={(e) => setForm((f) => ({ ...f, departamento_id: e.target.value }))}
                  >
                    <option value="">—</option>
                    {dept.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">Conta bancária prevista</span>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    value={form.conta_bancaria_id}
                    onChange={(e) => setForm((f) => ({ ...f, conta_bancaria_id: e.target.value }))}
                  >
                    <option value="">—</option>
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.apelido ?? c.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm sm:col-span-3">
                  <span className="font-medium text-slate-700">Observação</span>
                  <Input
                    value={form.observacao}
                    onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving || optsLoading}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salvar
                </Button>
                <Button type="button" variant="outline" onClick={cancelForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden shadow-sm">
        <CardContent className="p-0">
          {!empresaId ? (
            <p className="py-16 text-center text-sm text-slate-500">Selecione uma empresa no cabeçalho.</p>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-lexius-600" />
              Carregando…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">
              Nenhum título a pagar. {podeLancar ? 'Clique em Novo para lançar.' : ''}
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3 font-semibold text-slate-600">Descrição</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Vencimento</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Valor</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-lexius-50/40">
                    <td className="px-4 py-3 text-slate-800">{row.descricao}</td>
                    <td className="px-4 py-3 text-slate-700">{String(row.dataVencimento).slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{formatBRL(row.valorOriginal)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PageHero({
  title,
  description,
  icon: Icon,
  count,
}: {
  title: string;
  description: string;
  icon: typeof ArrowUpCircle;
  count: number;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lexius-600 to-lexius-800 text-white shadow-md">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 max-w-2xl text-slate-600">{description}</p>
        </div>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        {count} na listagem
      </span>
    </div>
  );
}