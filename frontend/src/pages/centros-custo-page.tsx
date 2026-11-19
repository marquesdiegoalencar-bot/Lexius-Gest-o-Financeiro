import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FolderTree, Loader2, Pencil, Plus, RefreshCw } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type TipoTab = 'ENTRADA' | 'SAIDA';
type TipoNo = 'GRUPO' | 'SUBGRUPO' | 'ANALITICO';

type CentroRow = {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  tipo: TipoTab;
  tipo_no: TipoNo;
  pai_id: string | null;
  ativo: boolean;
};

type CentroNo = CentroRow & { filhos: CentroNo[]; profundidade: number };

const emptyForm = () => ({
  codigo: '',
  nome: '',
  descricao: '',
  tipo_no: 'ANALITICO' as TipoNo,
  pai_id: '',
});

function buildTree(rows: CentroRow[]): CentroNo[] {
  const byId = new Map<string, CentroNo>();
  for (const r of rows) {
    byId.set(r.id, { ...r, filhos: [], profundidade: 1 });
  }
  const raizes: CentroNo[] = [];
  for (const n of byId.values()) {
    if (n.pai_id && byId.has(n.pai_id)) {
      const pai = byId.get(n.pai_id)!;
      n.profundidade = pai.profundidade + 1;
      pai.filhos.push(n);
    } else {
      raizes.push(n);
    }
  }
  const sortRec = (list: CentroNo[]) => {
    list.sort((a, b) => (a.codigo ?? a.nome).localeCompare(b.codigo ?? b.nome));
    for (const x of list) sortRec(x.filhos);
  };
  sortRec(raizes);
  return raizes;
}

function flattenTree(nodes: CentroNo[], collapsed: Record<string, boolean>): CentroNo[] {
  const out: CentroNo[] = [];
  const walk = (list: CentroNo[]) => {
    for (const n of list) {
      out.push(n);
      if (!collapsed[n.id]) walk(n.filhos);
    }
  };
  walk(nodes);
  return out;
}

export function CentrosCustoPage() {
  const { request, empresaId } = useApi();
  const [tab, setTab] = useState<TipoTab>('ENTRADA');
  const [rows, setRows] = useState<CentroRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const arvore = useMemo(() => buildTree(rows), [rows]);
  const paisOpcoes = useMemo(
    () => rows.filter((r) => r.tipo_no !== 'ANALITICO' && r.ativo),
    [rows],
  );

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

  const openNew = (paiId?: string, tipoNo?: TipoNo) => {
    setEditingId(null);
    setForm({ ...emptyForm(), pai_id: paiId ?? '', tipo_no: tipoNo ?? 'ANALITICO' });
    setFormOpen(true);
  };

  const openEdit = (row: CentroRow) => {
    setEditingId(row.id);
    setForm({
      codigo: row.codigo ?? '',
      nome: row.nome,
      descricao: row.descricao ?? '',
      tipo_no: row.tipo_no,
      pai_id: row.pai_id ?? '',
    });
    setFormOpen(true);
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
      setErro('Informe o centro de custo (nome).');
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const body: Record<string, string | boolean | null> = {
        nome: form.nome.trim(),
        tipo_no: form.tipo_no,
      };
      const codigo = form.codigo.trim();
      if (codigo) body.codigo = codigo;
      const descricao = form.descricao.trim();
      if (descricao) body.descricao = descricao;
      if (form.pai_id.trim()) body.pai_id = form.pai_id.trim();
      else if (editingId) body.pai_id = null;
      if (!editingId) body.tipo = tab;

      if (editingId) {
        await request(`/v1/centros-custo/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setSucesso('Alterações salvas com sucesso.');
      } else {
        await request('/v1/centros-custo', { method: 'POST', body: JSON.stringify(body) });
        setSucesso('Centro de custo cadastrado com sucesso.');
      }
      cancelForm();
      await load(true);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao salvar';
      setErro(
        msg.includes('column') || msg.includes('tipo_no')
          ? `${msg} — execute npm run db:migrate no servidor da API.`
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleInativar = async (row: CentroRow) => {
    setErro(null);
    try {
      await request(`/v1/centros-custo/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: !row.ativo }),
      });
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
            <FolderTree className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Centros de Custo</h2>
            <p className="mt-1 text-slate-600">
              Hierarquia em até 3 níveis: <strong>grupo</strong>, <strong>subgrupo</strong> e{' '}
              <strong>analítico</strong> (entrada e saída).
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
            <Button type="button" size="sm" className="gap-2" onClick={() => openNew()}>
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
                {editingId ? 'Editar registro' : `Novo — ${tab === 'ENTRADA' ? 'Entrada' : 'Saída'}`}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Tipo de nó">
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={form.tipo_no}
                    disabled={!!editingId}
                    onChange={(e) => setForm((f) => ({ ...f, tipo_no: e.target.value as TipoNo }))}
                  >
                    <option value="GRUPO">Grupo</option>
                    <option value="SUBGRUPO">Subgrupo</option>
                    <option value="ANALITICO">Analítico</option>
                  </select>
                </Field>
                <Field label="Pai (opcional)">
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={form.pai_id}
                    onChange={(e) => setForm((f) => ({ ...f, pai_id: e.target.value }))}
                  >
                    <option value="">— Raiz —</option>
                    {paisOpcoes
                      .filter((p) => p.id !== editingId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.codigo ? `${p.codigo} — ` : ''}
                          {p.nome} ({p.tipo_no})
                        </option>
                      ))}
                  </select>
                </Field>
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
            <p className="py-16 text-center text-sm text-slate-500">
              Nenhum centro de custo de {tab === 'ENTRADA' ? 'entrada' : 'saída'}. Clique em Novo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 font-semibold text-slate-600">Hierarquia</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Tipo</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {flattenTree(arvore, collapsed).map((row) => (
                    <TreeRow
                      key={row.id}
                      row={row}
                      collapsed={collapsed[row.id] ?? false}
                      onToggleCollapse={() =>
                        setCollapsed((c) => ({ ...c, [row.id]: !(c[row.id] ?? false) }))
                      }
                      onEdit={() => openEdit(row)}
                      onAddChild={() =>
                        openNew(
                          row.id,
                          row.tipo_no === 'GRUPO' ? 'SUBGRUPO' : 'ANALITICO',
                        )
                      }
                      onToggleAtivo={() => void toggleInativar(row)}
                      hasChildren={row.filhos.length > 0}
                    />
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

function TreeRow({
  row,
  collapsed,
  onToggleCollapse,
  onEdit,
  onAddChild,
  onToggleAtivo,
  hasChildren,
}: {
  row: CentroNo;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onEdit: () => void;
  onAddChild: () => void;
  onToggleAtivo: () => void;
  hasChildren: boolean;
}) {
  const indent = (row.profundidade - 1) * 20;
  const tipoLabel =
    row.tipo_no === 'GRUPO' ? 'Grupo' : row.tipo_no === 'SUBGRUPO' ? 'Subgrupo' : 'Analítico';
  return (
    <tr className={`border-b border-slate-100 hover:bg-lexius-50/40 ${!row.ativo ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1" style={{ paddingLeft: indent }}>
          {hasChildren ? (
            <button type="button" className="rounded p-0.5 text-slate-500 hover:bg-slate-100" onClick={onToggleCollapse}>
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : (
            <span className="inline-block w-5" />
          )}
          <div>
            <span className="font-mono text-xs text-slate-500">{row.codigo ?? '—'}</span>
            <span className="ml-2 font-medium text-slate-900">{row.nome}</span>
            {row.descricao ? <p className="text-xs text-slate-500">{row.descricao}</p> : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-600">{tipoLabel}</td>
      <td className="px-4 py-3 text-slate-600">{row.ativo ? 'Ativo' : 'Inativo'}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-1">
          {row.tipo_no !== 'ANALITICO' ? (
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onAddChild}>
              <Plus className="h-3.5 w-3.5" />
              Filho
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onToggleAtivo}>
            {row.ativo ? 'Inativar' : 'Reativar'}
          </Button>
        </div>
      </td>
    </tr>
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