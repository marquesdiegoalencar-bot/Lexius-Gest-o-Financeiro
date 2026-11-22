import { Landmark, Tag, Users } from 'lucide-react';
import { ApiResourcePage, type ColumnDef } from '@/components/api-resource-page';
import { useApi } from '@/hooks/use-api';
import { formatBRL } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useState } from 'react';

type PessoaRow = Record<string, unknown> & {
  id: string;
  nome: string;
  tipoPessoa: string;
  documento?: string | null;
  email?: string | null;
};

type CategoriaRow = Record<string, unknown> & {
  id: string;
  nome: string;
  natureza: string;
  codigo?: string | null;
};

type ContaRow = Record<string, unknown> & {
  id: string;
  apelido: string;
  bancoCodigo: string;
  provedor: string;
  saldoInicial?: string;
  saldoBanco?: string | null;
};

function BancoSaldoButton({ id }: { id: string }) {
  const { request } = useApi();
  const [valor, setValor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const res = await request<{ saldo?: string; saldo_banco?: string }>(
              `/v1/contas-bancarias/${id}/saldo`,
            );
            setValor(res.saldo_banco ?? res.saldo ?? JSON.stringify(res));
          } catch (e) {
            setValor(e instanceof ApiError ? e.message : 'Erro');
          } finally {
            setLoading(false);
          }
        }}
      >
        Saldo
      </Button>
      {valor ? <span className="text-xs text-slate-600">{formatBRL(valor)}</span> : null}
    </div>
  );
}

const contaColumns: ColumnDef<ContaRow>[] = [
  { id: 'apelido', header: 'Apelido', cell: (r) => r.apelido },
  { id: 'banco', header: 'Banco', cell: (r) => r.bancoCodigo },
  { id: 'prov', header: 'Provedor', cell: (r) => r.provedor },
  {
    id: 'saldo',
    header: 'Saldo ref.',
    cell: (r) => formatBRL(r.saldoBanco ?? r.saldoInicial ?? 0),
    className: 'text-right',
  },
];

export function BancosPage() {
  return (
    <ApiResourcePage<ContaRow>
      title="Contas Bancárias"
      description="Saldos, extrato e sincronização Inter."
      icon={Landmark}
      listPath="/v1/contas-bancarias"
      columns={contaColumns}
      rowActions={(row) => <BancoSaldoButton id={row.id} />}
    />
  );
}

const pessoaColumns: ColumnDef<PessoaRow>[] = [
  { id: 'nome', header: 'Nome', cell: (r) => r.nome },
  { id: 'tipo', header: 'Tipo', cell: (r) => (r.tipoPessoa === 'JURIDICA' ? 'PJ' : 'PF') },
  { id: 'doc', header: 'Documento', cell: (r) => r.documento ?? '—' },
  { id: 'email', header: 'E-mail', cell: (r) => r.email ?? '—' },
];

export function PessoasPage() {
  return (
    <ApiResourcePage<PessoaRow>
      title="Pessoas"
      description="Clientes, credores e dados para repasses."
      icon={Users}
      listPath="/v1/pessoas"
      columns={pessoaColumns}
      create={{
        path: '/v1/pessoas',
        submitLabel: 'Nova pessoa',
        fields: [
          { key: 'nome', label: 'Nome', type: 'text', required: true },
          {
            key: 'tipo_pessoa',
            label: 'Tipo',
            type: 'select',
            required: true,
            defaultValue: 'FISICA',
            options: [
              { value: 'FISICA', label: 'Pessoa física' },
              { value: 'JURIDICA', label: 'Pessoa jurídica' },
            ],
          },
          { key: 'documento', label: 'CPF/CNPJ', type: 'text' },
          { key: 'email', label: 'E-mail', type: 'email' },
        ],
        buildBody: (v) => ({
          nome: v.nome,
          tipo_pessoa: v.tipo_pessoa,
          documento: v.documento || undefined,
          email: v.email || undefined,
          eh_cliente: true,
        }),
      }}
    />
  );
}

const categoriaColumns: ColumnDef<CategoriaRow>[] = [
  { id: 'nome', header: 'Nome', cell: (r) => r.nome },
  { id: 'nat', header: 'Natureza', cell: (r) => r.natureza },
  { id: 'cod', header: 'Código', cell: (r) => r.codigo ?? '—' },
];

export function CategoriasPage() {
  return (
    <ApiResourcePage<CategoriaRow>
      title="Categorias"
      description="Plano de contas gerencial (receitas e despesas)."
      icon={Tag}
      listPath="/v1/categorias"
      columns={categoriaColumns}
      create={{
        path: '/v1/categorias',
        submitLabel: 'Nova categoria',
        fields: [
          { key: 'nome', label: 'Nome', type: 'text', required: true },
          {
            key: 'natureza',
            label: 'Natureza',
            type: 'select',
            required: true,
            options: [
              { value: 'RECEITA', label: 'Receita' },
              { value: 'DESPESA', label: 'Despesa' },
            ],
          },
        ],
        buildBody: (v) => ({ nome: v.nome, natureza: v.natureza }),
      }}
    />
  );
}

