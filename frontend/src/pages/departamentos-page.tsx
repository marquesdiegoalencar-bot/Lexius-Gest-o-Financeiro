import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, RefreshCw } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type DepartamentoRow = {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  ativo: boolean;
};

const emptyForm = () => ({ codigo: '', nome: '', descricao: '' });

export function DepartamentosPage() {
  const { request, empresaId } = useApi();
  const [rows, setRows] = useState<DepartamentoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const listPath = useMemo(() => {
    const p = new URLSearchParams();
    if (busca.trim()) p.set('q', busca.trim());
    if (filtroAtivo === 'ativos') p.set('ativo', 'true');
    if (filtroAtivo === 'inativos') p.set('ativo', 'false');
    const q = p.toString();
    return q ? `/v1/departamentos?${q}` : '/v1/departamentos';
  }, [busca, filtroAtivo]);

  const load = useCallback(
    async (silent?: boolean) => {
      if (!empresaId) {
        setRows([]);
        setLoading(false);
        return;
      }
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await request<DepartamentoRow[]>(listPath);
        setRows(data);
        setErro(null);
      } catch (e) {
        setErro(e instanceof ApiError ? e.message : 'Erro ao carregar departamentos');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request, listPath, empresaId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
    setSucesso(null);
  };

  const openEdit = (row: DepartamentoRow) => {
    setEditingId(row.id);
    setForm({
      codigo: row.codigo ?? '',
      nome: row.nome,
      descricao: row.descricao ?? '',
    });
    setFormOpen(true);
    setSucesso(null);
  };

  const cancelForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const save = async () => {
    setSucesso(null);
    if (!empresaId) {
      setErro('Selecione uma empresa no cabeçalho antes de salvar.');
      return;
    }
    if (!form.nome.trim()) {
      setErro('Informe o nome do departamento.');
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const body: Record<string, string | boolean | null> = { nome: form.nome.trim() };
      const codigo = form.codigo.trim();
      body.codigo = codigo || null;
      const descricao = form.descricao.trim();
      body.descricao = descricao || null;

      if (editingId) {
        await request(`/v1/departamentos/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setSucesso('Alterações salvas com sucesso.');
      } else {
        await request('/v1/departamentos', { method: 'POST', body: JSON.stringify(body) });
        setSucesso('Departamento cadastrado com sucesso.');
      }
      cancelForm();
      await load(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (row: DepartamentoRow) => {
    setErro(null);
    setSucesso(null);
    try {
      await request(`/v1/departamentos/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: !row.ativo }),
      });
      setSucesso(row.ativo ? 'Departamento inativado.' : 'Departamento reativado.');
      await load(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao alterar status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lexius-600 to-lexius-800 text-white shadow-md">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Departamentos</h2>
            <p className="mt-1 text-slate-600">
              Cadastro gerencial por empresa. Inativação preserva o histórico para consultas futuras.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Pesquisar</span>
            <Input
              placeholder="Nome ou código…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:w-40">
            <span className="font-medium text-slate-700">Status</span>
            <select
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={filtroAtivo}
              onChange={(e) => setFiltroAtivo(e.target.value as typeof filtroAtivo)}
            >
              <option value="todos">Todos</option>
              <option value="ativos">Somente ativos</option>
              <option value="inativos">Somente inativos</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={loading || refreshing}
              onClick={() => void load(true)}
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </Button>
            <Button type="button" size="sm" className="gap-2" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          </div>
        </div>
      </div>

      {sucesso ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          {sucesso}
        </p>
      ) : null}
      {erro ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{erro}</p>
      ) : null}

      {formOpen ? (
        <Card className="border-lexius-200 shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <p className="text-sm font-medium text-slate-800">
                {editingId ? 'Editar departamento' : 'Novo departamento'}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1 text-sm sm:col-span-1">
                  <span className="font-medium text-slate-700">Código</span>
                  <Input
                    value={form.codigo}
                    placeholder="Ex.: DEP-01"
                    onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">Nome *</span>
                  <Input
                    value={form.nome}
                    placeholder="Nome do departamento"
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1 text-sm sm:col-span-3">
                  <span className="font-medium text-slate-700">Descrição</span>
                  <Input
                    value={form.descricao}
                    placeholder="Descrição opcional"
                    onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
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
            <p className="py-16 text-center text-sm text-slate-500">
              Selecione uma empresa no cabeçalho para listar departamentos.
            </p>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-lexius-600" />
              Carregando…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">Nenhum departamento encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 font-semibold text-slate-600">Código</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Nome</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-lexius-50/40">
                      <td className="px-4 py-3 text-slate-600">{row.codigo ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {row.nome}
                        {row.descricao ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">{row.descricao}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={row.ativo ? 'success' : 'secondary'}>
                          {row.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <hgroup className="inline-flex gap-2">
                          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => openEdit(row)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void toggleAtivo(row)}
                          >
                            {row.ativo ? 'Inativar' : 'Reativar'}
                          </Button>
                        </hgroup>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}