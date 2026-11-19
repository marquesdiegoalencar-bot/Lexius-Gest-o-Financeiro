import { useCallback, useEffect, useState } from 'react';
import { FolderTree, Loader2, Pencil, Plus, RefreshCw } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type TipoTab = 'ENTRADA' | 'SAIDA';

type CentroRow = {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  tipo: TipoTab;
  ativo: boolean;
};

const emptyForm = () => ({
  codigo: '',
  nome: '',
  descricao: '',
});

export function CentrosCustoPage() {
  const { request } = useApi();
  const [tab, setTab] = useState<TipoTab>('ENTRADA');
  const [rows, setRows] = useState<CentroRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (silent?: boolean) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await request<CentroRow[]>(`/v1/centros-custo?tipo=${tab}`);
        setRows(data);
        setErro(null);
      } catch (e) {
        setErro(e instanceof ApiError ? e.message : 'Erro ao carregar centros de custo');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request, tab],
  );

  useEffect(() => {
    setFormOpen(false);
    setEditingId(null);
    void load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (row: CentroRow) => {
    setEditingId(row.id);
    setForm({
      codigo: row.codigo ?? '',
      nome: row.nome,
      descricao: row.descricao ?? '',
    });
    setFormOpen(true);
  };

  const cancelForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const save = async () => {
    if (!form.nome.trim()) {
      setErro('Informe o centro de custo (nome).');
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const body = {
        codigo: form.codigo.trim() || undefined,
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || undefined,
        tipo: tab,
      };
      if (editingId) {
        await request(`/v1/centros-custo/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await request('/v1/centros-custo', { method: 'POST', body: JSON.stringify(body) });
      }
      cancelForm();
      await load(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lexius-600 to-lexius-800 text-white shadow-md">
            <FolderTree className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Centros de Custo</h2>
            <p className="mt-1 text-slate-600">
              Cadastre lançamentos de <strong>entrada</strong> e <strong>saída</strong> com código, nome e descrição.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <TabButton active={tab === 'ENTRADA'} onClick={() => setTab('ENTRADA')}>
            Entrada
          </TabButton>
          <TabButton active={tab === 'SAIDA'} onClick={() => setTab('SAIDA')}>
            Saída
          </TabButton>
          <div className="ml-auto flex flex-wrap gap-2">
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

      {erro ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{erro}</p>
      ) : null}

      {formOpen ? (
        <Card className="border-lexius-200 shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm font-medium text-slate-800">
              {editingId ? 'Editar registro' : `Novo — ${tab === 'ENTRADA' ? 'Entrada' : 'Saída'}`}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Cód.">
                <Input
                  value={form.codigo}
                  placeholder="Ex.: CC-001"
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                />
              </Field>
              <Field label="Centro de custo *">
                <Input
                  value={form.nome}
                  placeholder="Nome do centro"
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </Field>
              <Field label="Descrição" className="sm:col-span-3">
                <Input
                  value={form.descricao}
                  placeholder="Descrição do lançamento"
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={saving} onClick={() => void save()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
              <Button type="button" variant="outline" onClick={cancelForm}>
                Cancelar
              </Button>
            </div>
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
            <p className="py-16 text-center text-sm text-slate-500">
              Nenhum centro de custo de {tab === 'ENTRADA' ? 'entrada' : 'saída'}. Clique em Novo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 font-semibold text-slate-600">Cód.</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Centro de custo</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Descrição</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-lexius-50/40">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.codigo ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.nome}</td>
                      <td className="px-4 py-3 text-slate-600">{row.descricao ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => openEdit(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
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

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-lg bg-lexius-600 px-4 py-2 text-sm font-medium text-white shadow-sm'
          : 'rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
      }
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 text-sm ${className ?? ''}`}>
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}