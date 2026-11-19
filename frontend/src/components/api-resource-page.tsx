import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export type ColumnDef<T extends Record<string, unknown>> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export type CreateField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'email' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
};

export type CreateConfig = {
  path: string;
  method?: 'POST';
  submitLabel?: string;
  fields: CreateField[] | ((request: ReturnType<typeof useApi>['request']) => Promise<CreateField[]>);
  buildBody: (values: Record<string, string>) => Record<string, unknown>;
};

export type ApiResourcePageProps<T extends Record<string, unknown>> = {
  title: string;
  description: string;
  icon: LucideIcon;
  listPath: string;
  columns: ColumnDef<T>[];
  create?: CreateConfig;
  rowActions?: (row: T, reload: () => void) => ReactNode;
  emptyMessage?: string;
  headerExtra?: ReactNode;
};

export function ApiResourcePage<T extends Record<string, unknown>>({
  title,
  description,
  icon: Icon,
  listPath,
  columns,
  create,
  rowActions,
  emptyMessage = 'Nenhum registro encontrado.',
  headerExtra,
}: ApiResourcePageProps<T>) {
  const { request } = useApi();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createFields, setCreateFields] = useState<CreateField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (silent?: boolean) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const data = await request<T[] | T>(listPath);
        const list = Array.isArray(data) ? data : [data];
        setRows(list as T[]);
        setErro(null);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Erro ao carregar';
        setErro(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [listPath, request],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = async () => {
    if (!create) return;
    setShowCreate(true);
    if (typeof create.fields === 'function') {
      const fields = await create.fields(request);
      setCreateFields(fields);
      const initial: Record<string, string> = {};
      for (const f of fields) {
        if (f.defaultValue) initial[f.key] = f.defaultValue;
      }
      setFormValues(initial);
    } else {
      setCreateFields(create.fields);
      const initial: Record<string, string> = {};
      for (const f of create.fields) {
        if (f.defaultValue) initial[f.key] = f.defaultValue;
      }
      setFormValues(initial);
    }
  };

  const submitCreate = async () => {
    if (!create) return;
    setSaving(true);
    try {
      const body = create.buildBody(formValues);
      await request(create.path, { method: create.method ?? 'POST', body: JSON.stringify(body) });
      setShowCreate(false);
      setFormValues({});
      await load(true);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Erro ao salvar';
      setErro(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHero title={title} description={description} icon={Icon} count={rows.length} />

      <PageToolbar className="flex flex-wrap items-center gap-2">
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
        {create ? (
          <Button type="button" size="sm" className="gap-2" onClick={() => void openCreate()}>
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        ) : null}
        {headerExtra}
        <span className="ml-auto text-xs text-slate-500">
          {loading ? 'Carregando…' : `${rows.length} registro(s)`}
        </span>
      </PageToolbar>

      {erro ? (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erro}
        </p>
      ) : null}

      {showCreate && create ? (
        <Card className="border-lexius-200 shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm font-medium text-slate-800">{create.submitLabel ?? 'Novo registro'}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {createFields.map((field) => (
                <label key={field.key} className="block space-y-1.5 text-sm">
                  <span className="font-medium text-slate-700">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </span>
                  {field.type === 'select' ? (
                    <select
                      className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                      value={formValues[field.key] ?? ''}
                      onChange={(e) => setFormValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    >
                      <option value="">Selecione…</option>
                      {(field.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      placeholder={field.placeholder}
                      value={formValues[field.key] ?? ''}
                      onChange={(e) => setFormValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={saving} onClick={() => void submitCreate()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
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
              Carregando dados da API…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">{emptyMessage}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    {columns.map((col) => (
                      <th
                        key={col.id}
                        className={`px-4 py-3 font-semibold text-slate-600 ${col.className ?? ''}`}
                      >
                        {col.header}
                      </th>
                    ))}
                    {rowActions ? <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={String(row.id ?? JSON.stringify(row).slice(0, 32))}
                      className="border-b border-slate-100 transition-colors hover:bg-lexius-50/40"
                    >
                      {columns.map((col) => (
                        <td key={col.id} className={`px-4 py-3 text-slate-800 ${col.className ?? ''}`}>
                          {col.cell(row)}
                        </td>
                      ))}
                      {rowActions ? (
                        <td className="px-4 py-3 text-right">{rowActions(row, () => void load(true))}</td>
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

function PageHero({
  title,
  description,
  icon: Icon,
  count,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  count: number;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lexius-600 to-lexius-800 text-white shadow-md">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-1 max-w-2xl text-slate-600">{description}</p>
        </div>
      </div>
      <Badge variant="secondary" className="self-start sm:mt-1">
        {count} na listagem
      </Badge>
    </div>
  );
}

function PageToolbar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const variant =
    s === 'PAGO' || s === 'RECEBIDO' || s === 'BAIXADO'
      ? 'success'
      : s === 'VENCIDO' || s === 'CANCELADO'
        ? 'warning'
        : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

export function truncateId(id: string) {
  return `${id.slice(0, 8)}…`;
}