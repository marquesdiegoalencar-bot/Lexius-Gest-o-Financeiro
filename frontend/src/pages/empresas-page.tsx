import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type EmpresaRow = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  tipo: string;
  ativa: boolean;
  fusoNegocio: string;
};

const TIPOS = [
  { value: 'COBRANCA', label: 'Cobrança' },
  { value: 'SISTEMAS', label: 'Sistemas' },
  { value: 'ADVOCACIA', label: 'Advocacia' },
  { value: 'OUTRA', label: 'Outra' },
] as const;

const FUSOS = [
  { value: 'America/Manaus', label: 'America/Manaus (UTC−4)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (UTC−3)' },
  { value: 'America/Cuiaba', label: 'America/Cuiaba (UTC−4)' },
  { value: 'America/Belem', label: 'America/Belem (UTC−3)' },
  { value: 'America/Fortaleza', label: 'America/Fortaleza (UTC−3)' },
];

function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}

function formatCnpjDisplay(cnpj: string) {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

const emptyForm = () => ({
  razao_social: '',
  nome_fantasia: '',
  cnpj: '',
  tipo: 'OUTRA',
  fuso_negocio: 'America/Manaus',
  ativa: 'true',
});

export function EmpresasPage() {
  const { request } = useApi();
  const { empresaAtiva, upsertEmpresaVinculo, removeEmpresaVinculo } = useAuth();
  const papel = empresaAtiva?.papel ?? '';
  const podeEditar = papel === 'MASTER' || papel === 'ADMIN';
  const podeCriarExcluir = papel === 'MASTER';

  const [rows, setRows] = useState<EmpresaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (silent?: boolean) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await request<EmpresaRow[]>('/v1/empresas');
        setRows(data);
        setErro(null);
      } catch (e) {
        setErro(e instanceof ApiError ? e.message : 'Erro ao carregar empresas');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request],
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

  const openEdit = (row: EmpresaRow) => {
    setEditingId(row.id);
    setForm({
      razao_social: row.razaoSocial,
      nome_fantasia: row.nomeFantasia ?? '',
      cnpj: row.cnpj,
      tipo: row.tipo,
      fuso_negocio: row.fusoNegocio,
      ativa: row.ativa ? 'true' : 'false',
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
    const cnpj = onlyDigits(form.cnpj);
    if (!form.razao_social.trim()) {
      setErro('Informe a razão social.');
      return;
    }
    if (cnpj.length !== 14) {
      setErro('CNPJ deve ter 14 dígitos numéricos.');
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const nomeFantasia = form.nome_fantasia.trim();
      if (editingId) {
        const body: Record<string, unknown> = {
          razao_social: form.razao_social.trim(),
          nome_fantasia: nomeFantasia || null,
          tipo: form.tipo,
          fuso_negocio: form.fuso_negocio,
          ativa: form.ativa === 'true',
        };
        if (podeCriarExcluir) body.cnpj = cnpj;
        const updated = await request<EmpresaRow>(`/v1/empresas/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        upsertEmpresaVinculo({
          empresa_id: updated.id,
          papel,
          razao_social: updated.razaoSocial,
        });
        setSucesso('Empresa atualizada.');
      } else {
        const created = await request<EmpresaRow>('/v1/empresas', {
          method: 'POST',
          body: JSON.stringify({
            razao_social: form.razao_social.trim(),
            nome_fantasia: nomeFantasia || undefined,
            cnpj,
            tipo: form.tipo,
            fuso_negocio: form.fuso_negocio,
          }),
        });
        upsertEmpresaVinculo({
          empresa_id: created.id,
          papel: 'MASTER',
          razao_social: created.razaoSocial,
        });
        setSucesso('Empresa cadastrada. Ela já aparece no seletor do cabeçalho.');
      }
      cancelForm();
      await load(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const inativarOuReativar = async (row: EmpresaRow) => {
    setErro(null);
    setSucesso(null);
    try {
      const updated = await request<EmpresaRow>(`/v1/empresas/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ativa: !row.ativa }),
      });
      upsertEmpresaVinculo({
        empresa_id: updated.id,
        papel,
        razao_social: updated.razaoSocial,
      });
      setSucesso(updated.ativa ? 'Empresa reativada.' : 'Empresa inativada.');
      await load(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao alterar status');
    }
  };

  const excluir = async (row: EmpresaRow) => {
    if (!window.confirm(`Excluir permanentemente "${row.razaoSocial}"? Só é possível se não houver lançamentos vinculados.`)) {
      return;
    }
    setErro(null);
    setSucesso(null);
    try {
      await request(`/v1/empresas/${row.id}`, { method: 'DELETE' });
      removeEmpresaVinculo(row.id);
      setSucesso('Empresa excluída.');
      await load(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao excluir');
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
            <h2 className="text-2xl font-semibold text-slate-900">Empresas</h2>
            <p className="mt-1 max-w-2xl text-slate-600">
              Cadastro completo do grupo multi-empresa: razão social, CNPJ, tipo, fuso de negócio e situação.
            </p>
          </div>
        </div>
        <Badge variant="secondary">{rows.length} cadastrada(s)</Badge>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
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
          {podeCriarExcluir ? (
            <Button type="button" size="sm" className="gap-2" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Nova empresa
            </Button>
          ) : null}
          {!podeEditar ? (
            <span className="ml-auto text-xs text-slate-500">Somente leitura (perfil atual)</span>
          ) : null}
        </div>
      </div>

      {sucesso ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{sucesso}</p>
      ) : null}
      {erro ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{erro}</p>
      ) : null}

      {formOpen && podeEditar ? (
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
                {editingId ? 'Editar empresa' : 'Nova empresa'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">Razão social *</span>
                  <Input
                    value={form.razao_social}
                    onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">Nome fantasia</span>
                  <Input
                    value={form.nome_fantasia}
                    onChange={(e) => setForm((f) => ({ ...f, nome_fantasia: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700">CNPJ *</span>
                  <Input
                    value={form.cnpj}
                    placeholder="Somente números ou formatado"
                    disabled={Boolean(editingId) && !podeCriarExcluir}
                    onChange={(e) => setForm((f) => ({ ...f, cnpj: onlyDigits(e.target.value).slice(0, 14) }))}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Tipo *</span>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    value={form.tipo}
                    onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                  >
                    {TIPOS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Fuso de negócio</span>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    value={form.fuso_negocio}
                    onChange={(e) => setForm((f) => ({ ...f, fuso_negocio: e.target.value }))}
                  >
                    {FUSOS.map((z) => (
                      <option key={z.value} value={z.value}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                </label>
                {editingId ? (
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Situação</span>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                      value={form.ativa}
                      onChange={(e) => setForm((f) => ({ ...f, ativa: e.target.value }))}
                    >
                      <option value="true">Ativa</option>
                      <option value="false">Inativa</option>
                    </select>
                  </label>
                ) : null}
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
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-lexius-600" />
              Carregando…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">Nenhuma empresa cadastrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 font-semibold text-slate-600">Razão social</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">CNPJ</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Tipo</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Fuso</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                    {podeEditar ? (
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-lexius-50/40">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {row.razaoSocial}
                        {row.nomeFantasia ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">{row.nomeFantasia}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatCnpjDisplay(row.cnpj)}</td>
                      <td className="px-4 py-3 text-slate-700">{row.tipo}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.fusoNegocio}</td>
                      <td className="px-4 py-3">
                        <Badge variant={row.ativa ? 'success' : 'secondary'}>
                          {row.ativa ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </td>
                      {podeEditar ? (
                        <td className="px-4 py-3 text-right">
                          <hgroup className="inline-flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void inativarOuReativar(row)}
                            >
                              {row.ativa ? 'Inativar' : 'Reativar'}
                            </Button>
                            {podeCriarExcluir ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1 text-red-700 hover:bg-red-50"
                                onClick={() => void excluir(row)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Excluir
                              </Button>
                            ) : null}
                          </hgroup>
                        </td>
                      ) : null}
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