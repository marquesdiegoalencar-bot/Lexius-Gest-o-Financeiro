import { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark, Loader2, Pencil, Plus, RefreshCw, Trash2, Wifi } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { formatBRL } from '@/lib/utils';

type ContaRow = {
  id: string;
  apelido: string;
  bancoCodigo: string;
  agencia: string | null;
  conta: string | null;
  tipo: string;
  provedor: string;
  saldoInicial: string;
  saldoBanco: string | null;
  sincronizaExtrato: boolean;
  credencialRef: string | null;
  chavePix: string | null;
  tipoChavePix: string | null;
  ativa: boolean;
  dataSaldoInicial: string;
};

const PAPEIS_GERENCIA = new Set(['MASTER', 'ADMIN', 'FINANCEIRO']);

const PROVEDORES = [
  { value: 'MANUAL', label: 'Manual (sem API)' },
  { value: 'INTER', label: 'Banco Inter (API)' },
  { value: 'ASAAS', label: 'Asaas (API)' },
  { value: 'C6', label: 'C6 Bank (API)' },
  { value: 'OUTRO', label: 'Outro provedor' },
] as const;

const TIPOS_CONTA = [
  { value: 'CORRENTE', label: 'Corrente' },
  { value: 'POUPANCA', label: 'Poupança' },
  { value: 'PAGAMENTO', label: 'Pagamento' },
  { value: 'CAIXA', label: 'Caixa interno' },
  { value: 'CARTAO', label: 'Cartão' },
] as const;

const TIPOS_CHAVE_PIX = [
  { value: '', label: '—' },
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'TELEFONE', label: 'Telefone' },
  { value: 'EVP', label: 'Chave aleatória' },
];

const emptyNova = () => ({
  apelido: '',
  banco_codigo: '077',
  agencia: '',
  conta: '',
  tipo: 'CORRENTE',
  provedor: 'INTER',
  credencial_ref: '',
  chave_pix: '',
  tipo_chave_pix: '',
  sincroniza_extrato: true,
  saldo_inicial: '0',
  data_saldo_inicial: new Date().toISOString().slice(0, 10),
});

const emptyEdit = () => ({
  apelido: '',
  ativa: true,
  credencial_ref: '',
  chave_pix: '',
  tipo_chave_pix: '',
  sincroniza_extrato: false,
});

export function BancosPage() {
  const { request, empresaId } = useApi();
  const { empresaAtiva } = useAuth();
  const podeGerenciar = PAPEIS_GERENCIA.has(empresaAtiva?.papel ?? '');

  const [rows, setRows] = useState<ContaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);
  const [nova, setNova] = useState(emptyNova);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState(emptyEdit);
  const [editProvedor, setEditProvedor] = useState('MANUAL');
  const [saving, setSaving] = useState(false);
  const [saldoPorId, setSaldoPorId] = useState<Record<string, string>>({});
  const [saldoLoading, setSaldoLoading] = useState<string | null>(null);

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
        const data = await request<ContaRow[]>('/v1/contas-bancarias');
        setRows(data);
        setErro(null);
      } catch (e) {
        setErro(e instanceof ApiError ? e.message : 'Erro ao carregar contas');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request, empresaId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const abrirNova = () => {
    setNova(emptyNova());
    setNovaOpen(true);
    setSucesso(null);
  };

  const fecharNova = () => {
    setNovaOpen(false);
    setNova(emptyNova());
  };

  const abrirEditar = (row: ContaRow) => {
    setEditId(row.id);
    setEditProvedor(row.provedor);
    setEdit({
      apelido: row.apelido,
      ativa: row.ativa,
      credencial_ref: row.credencialRef ?? '',
      chave_pix: row.chavePix ?? '',
      tipo_chave_pix: row.tipoChavePix ?? '',
      sincroniza_extrato: row.sincronizaExtrato,
    });
    setEditOpen(true);
    setSucesso(null);
  };

  const fecharEditar = () => {
    setEditOpen(false);
    setEditId(null);
    setEdit(emptyEdit());
  };

  const salvarNova = async () => {
    if (!nova.apelido.trim()) {
      setErro('Informe o apelido da conta.');
      return;
    }
    if (nova.banco_codigo.length !== 3) {
      setErro('Código do banco deve ter 3 dígitos.');
      return;
    }
    if (nova.provedor === 'INTER') {
      if (nova.banco_codigo !== '077') {
        setErro('Conta Inter exige banco 077.');
        return;
      }
      if (!nova.credencial_ref.trim()) {
        setErro('Informe a referência de credencial para conexão API (credencial_ref).');
        return;
      }
    }
    setSaving(true);
    setErro(null);
    try {
      await request('/v1/contas-bancarias', {
        method: 'POST',
        body: JSON.stringify({
          apelido: nova.apelido.trim(),
          banco_codigo: nova.banco_codigo,
          agencia: nova.agencia.trim() || undefined,
          conta: nova.conta.trim() || undefined,
          tipo: nova.tipo,
          provedor: nova.provedor,
          credencial_ref: nova.credencial_ref.trim() || undefined,
          chave_pix: nova.chave_pix.trim() || undefined,
          tipo_chave_pix: nova.tipo_chave_pix || undefined,
          sincroniza_extrato: nova.sincroniza_extrato,
          saldo_inicial: Number(nova.saldo_inicial) || 0,
          data_saldo_inicial: nova.data_saldo_inicial,
        }),
      });
      fecharNova();
      setSucesso('Conta bancária cadastrada.');
      await load(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao cadastrar');
    } finally {
      setSaving(false);
    }
  };

  const salvarEditar = async () => {
    if (!editId) return;
    if (!edit.apelido.trim()) {
      setErro('Informe o apelido.');
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      await request(`/v1/contas-bancarias/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          apelido: edit.apelido.trim(),
          ativa: edit.ativa,
          credencial_ref: edit.credencial_ref.trim() || undefined,
          chave_pix: edit.chave_pix.trim() || undefined,
          tipo_chave_pix: edit.tipo_chave_pix || undefined,
          sincroniza_extrato: edit.sincroniza_extrato,
        }),
      });
      fecharEditar();
      setSucesso('Conta atualizada.');
      await load(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const consultarSaldo = async (id: string) => {
    setSaldoLoading(id);
    try {
      const res = await request<{ saldo_banco?: number | string }>(`/v1/contas-bancarias/${id}/saldo`);
      setSaldoPorId((s) => ({ ...s, [id]: String(res.saldo_banco ?? '—') }));
      await load(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao consultar saldo na API');
    } finally {
      setSaldoLoading(null);
    }
  };

  const excluir = async (row: ContaRow) => {
    if (
      !window.confirm(
        `Excluir a conta "${row.apelido}"? Só é possível se não houver movimentos ou títulos vinculados.`,
      )
    ) {
      return;
    }
    setErro(null);
    setSucesso(null);
    try {
      await request(`/v1/contas-bancarias/${row.id}`, { method: 'DELETE' });
      setSucesso('Conta excluída.');
      await load(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao excluir');
    }
  };

  const sincronizar = async (id: string) => {
    setSaldoLoading(id);
    try {
      await request(`/v1/contas-bancarias/${id}/sincronizar`, { method: 'POST' });
      setSucesso('Extrato sincronizado via API.');
      await load(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro na sincronização');
    } finally {
      setSaldoLoading(null);
    }
  };

  const count = useMemo(() => rows.length, [rows]);

  const novaFormBody = (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void salvarNova();
      }}
    >
      <label className="block space-y-1 text-sm sm:col-span-2">
        <span className="font-medium text-slate-700">Apelido *</span>
        <Input value={nova.apelido} onChange={(e) => setNova((n) => ({ ...n, apelido: e.target.value }))} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Provedor / API *</span>
        <select
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          value={nova.provedor}
          onChange={(e) => {
            const provedor = e.target.value;
            setNova((n) => ({
              ...n,
              provedor,
              banco_codigo: provedor === 'INTER' ? '077' : n.banco_codigo,
              sincroniza_extrato: provedor !== 'MANUAL',
            }));
          }}
        >
          {PROVEDORES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Código banco *</span>
        <Input
          maxLength={3}
          value={nova.banco_codigo}
          disabled={nova.provedor === 'INTER'}
          onChange={(e) => setNova((n) => ({ ...n, banco_codigo: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Agência</span>
        <Input value={nova.agencia} onChange={(e) => setNova((n) => ({ ...n, agencia: e.target.value }))} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Conta</span>
        <Input value={nova.conta} onChange={(e) => setNova((n) => ({ ...n, conta: e.target.value }))} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Tipo</span>
        <select
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          value={nova.tipo}
          onChange={(e) => setNova((n) => ({ ...n, tipo: e.target.value }))}
        >
          {TIPOS_CONTA.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm sm:col-span-2">
        <span className="font-medium text-slate-700">
          Referência credencial API {nova.provedor !== 'MANUAL' ? '*' : ''}
        </span>
        <Input
          placeholder="Ex.: cob-inter (variáveis BANCO_CRED_* no servidor)"
          value={nova.credencial_ref}
          onChange={(e) => setNova((n) => ({ ...n, credencial_ref: e.target.value }))}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Chave Pix</span>
        <Input value={nova.chave_pix} onChange={(e) => setNova((n) => ({ ...n, chave_pix: e.target.value }))} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Tipo chave Pix</span>
        <select
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          value={nova.tipo_chave_pix}
          onChange={(e) => setNova((n) => ({ ...n, tipo_chave_pix: e.target.value }))}
        >
          {TIPOS_CHAVE_PIX.map((t) => (
            <option key={t.value || 'none'} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={nova.sincroniza_extrato}
          onChange={(e) => setNova((n) => ({ ...n, sincroniza_extrato: e.target.checked }))}
        />
        <span>Sincronizar extrato automaticamente via API</span>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Saldo inicial</span>
        <Input
          type="number"
          step="0.01"
          value={nova.saldo_inicial}
          onChange={(e) => setNova((n) => ({ ...n, saldo_inicial: e.target.value }))}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Data saldo inicial</span>
        <Input
          type="date"
          value={nova.data_saldo_inicial}
          onChange={(e) => setNova((n) => ({ ...n, data_saldo_inicial: e.target.value }))}
        />
      </label>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lexius-600 to-lexius-800 text-white shadow-md">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Contas bancárias</h2>
            <p className="mt-1 max-w-2xl text-slate-600">
              Cadastre contas da empresa e conecte via API (Inter, Asaas, C6). Credenciais ficam no servidor —
              aqui você informa apenas a referência.
            </p>
          </div>
        </div>
        <Badge variant="secondary">{count} conta(s)</Badge>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-2" disabled={loading || refreshing} onClick={() => void load(true)}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
          {podeGerenciar ? (
            <Button type="button" size="sm" className="gap-2" onClick={abrirNova}>
              <Plus className="h-4 w-4" />
              Nova conta
            </Button>
          ) : null}
        </div>
      </div>

      {sucesso ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{sucesso}</p>
      ) : null}
      {erro ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{erro}</p>
      ) : null}

      <Modal
        open={novaOpen}
        onClose={fecharNova}
        title="Nova conta bancária"
        description="A conexão API usa credenciais configuradas no ambiente do servidor (credencial_ref)."
        footer={
          <>
            <Button type="button" variant="outline" onClick={fecharNova}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void salvarNova()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cadastrar
            </Button>
          </>
        }
      >
        {novaFormBody}
      </Modal>

      <Modal
        open={editOpen}
        onClose={fecharEditar}
        title="Editar conta"
        description={`Provedor: ${editProvedor}`}
        footer={
          <>
            <Button type="button" variant="outline" onClick={fecharEditar}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void salvarEditar()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Apelido *</span>
            <Input value={edit.apelido} onChange={(e) => setEdit((x) => ({ ...x, apelido: e.target.value }))} />
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Referência credencial API</span>
            <Input value={edit.credencial_ref} onChange={(e) => setEdit((x) => ({ ...x, credencial_ref: e.target.value }))} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Chave Pix</span>
            <Input value={edit.chave_pix} onChange={(e) => setEdit((x) => ({ ...x, chave_pix: e.target.value }))} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Tipo chave Pix</span>
            <select
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={edit.tipo_chave_pix}
              onChange={(e) => setEdit((x) => ({ ...x, tipo_chave_pix: e.target.value }))}
            >
              {TIPOS_CHAVE_PIX.map((t) => (
                <option key={t.value || 'none'} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={edit.sincroniza_extrato}
              onChange={(e) => setEdit((x) => ({ ...x, sincroniza_extrato: e.target.checked }))}
            />
            <span>Sincronizar extrato via API</span>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={edit.ativa} onChange={(e) => setEdit((x) => ({ ...x, ativa: e.target.checked }))} />
            <span>Conta ativa</span>
          </label>
        </div>
      </Modal>

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
              Nenhuma conta cadastrada. {podeGerenciar ? 'Use Nova conta para conectar via API.' : ''}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 font-semibold text-slate-600">Apelido</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Banco</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Ag / Conta</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">API</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Saldo</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-lexius-50/40">
                      <td className="px-4 py-3 font-medium text-slate-800">{row.apelido}</td>
                      <td className="px-4 py-3 text-slate-700">{row.bancoCodigo}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {[row.agencia, row.conta].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={row.provedor === 'MANUAL' ? 'secondary' : 'success'}>{row.provedor}</Badge>
                        {row.credencialRef ? (
                          <span className="mt-1 block font-mono text-xs text-slate-500">{row.credencialRef}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-800">
                        {formatBRL(saldoPorId[row.id] ?? row.saldoBanco ?? row.saldoInicial)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={row.ativa ? 'success' : 'secondary'}>{row.ativa ? 'Ativa' : 'Inativa'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <hgroup className="inline-flex flex-wrap justify-end gap-1">
                          {podeGerenciar ? (
                            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => abrirEditar(row)}>
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={saldoLoading === row.id}
                            onClick={() => void consultarSaldo(row.id)}
                          >
                            {saldoLoading === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Saldo API'}
                          </Button>
                          {row.provedor !== 'MANUAL' && podeGerenciar ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={saldoLoading === row.id}
                              onClick={() => void sincronizar(row.id)}
                            >
                              <Wifi className="h-3.5 w-3.5" />
                              Sync
                            </Button>
                          ) : null}
                          {empresaAtiva?.papel === 'MASTER' || empresaAtiva?.papel === 'ADMIN' ? (
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