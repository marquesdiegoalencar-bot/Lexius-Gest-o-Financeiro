import {
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  Landmark,
  Tag,
  Users,
} from 'lucide-react';
import { ApiResourcePage, StatusBadge, truncateId, type ColumnDef, type CreateField } from '@/components/api-resource-page';
import { useApi } from '@/hooks/use-api';
import { formatBRL } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useState } from 'react';

type TituloRow = Record<string, unknown> & {
  id: string;
  descricao: string;
  valorOriginal: string;
  dataVencimento: string;
  status: string;
};

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

type EmpresaRow = Record<string, unknown> & {
  id: string;
  razaoSocial: string;
  cnpj: string;
  tipo: string;
};

const tituloColumns: ColumnDef<TituloRow>[] = [
  { id: 'desc', header: 'Descrição', cell: (r) => r.descricao },
  {
    id: 'venc',
    header: 'Vencimento',
    cell: (r) => (r.dataVencimento ? String(r.dataVencimento).slice(0, 10) : '—'),
  },
  { id: 'valor', header: 'Valor', cell: (r) => formatBRL(r.valorOriginal), className: 'text-right' },
  { id: 'status', header: 'Status', cell: (r) => <StatusBadge status={String(r.status)} /> },
];

async function categoriaFields(
  request: ReturnType<typeof useApi>['request'],
  natureza: 'RECEITA' | 'DESPESA',
): Promise<CreateField[]> {
  const cats = await request<{ id: string; nome: string }[]>(`/v1/categorias?natureza=${natureza}`);
  return [
    { key: 'descricao', label: 'Descrição', type: 'text', required: true },
    { key: 'valor_original', label: 'Valor', type: 'number', required: true },
    {
      key: 'data_vencimento',
      label: 'Vencimento',
      type: 'date',
      required: true,
      defaultValue: new Date().toISOString().slice(0, 10),
    },
    {
      key: 'categoria_id',
      label: 'Categoria',
      type: 'select',
      required: true,
      options: cats.map((c) => ({ value: c.id, label: c.nome })),
    },
  ];
}

export function ContasReceberPage() {
  return (
    <ApiResourcePage<TituloRow>
      title="Contas a Receber"
      description="Listagem de títulos, baixas e cobrança integrados ao Lexius COB."
      icon={ArrowDownCircle}
      listPath="/v1/titulos-receber"
      columns={tituloColumns}
      create={{
        path: '/v1/titulos-receber',
        submitLabel: 'Novo título a receber',
        fields: (req) => categoriaFields(req, 'RECEITA'),
        buildBody: (v) => ({
          descricao: v.descricao,
          valor_original: Number(v.valor_original),
          data_vencimento: v.data_vencimento,
          categoria_id: v.categoria_id,
        }),
      }}
    />
  );
}

export function ContasPagarPage() {
  return (
    <ApiResourcePage<TituloRow>
      title="Contas a Pagar"
      description="Lançamentos, aprovação e pagamento de despesas."
      icon={ArrowUpCircle}
      listPath="/v1/titulos-pagar"
      columns={tituloColumns}
      create={{
        path: '/v1/titulos-pagar',
        submitLabel: 'Novo título a pagar',
        fields: (req) => categoriaFields(req, 'DESPESA'),
        buildBody: (v) => ({
          descricao: v.descricao,
          valor_original: Number(v.valor_original),
          data_vencimento: v.data_vencimento,
          categoria_id: v.categoria_id,
        }),
      }}
    />
  );
}

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

const empresaColumns: ColumnDef<EmpresaRow>[] = [
  { id: 'razao', header: 'Razão social', cell: (r) => r.razaoSocial },
  { id: 'cnpj', header: 'CNPJ', cell: (r) => r.cnpj },
  { id: 'tipo', header: 'Tipo', cell: (r) => r.tipo },
  { id: 'id', header: 'ID', cell: (r) => <code className="text-xs">{truncateId(r.id)}</code> },
];

export function EmpresasPage() {
  return (
    <ApiResourcePage<EmpresaRow>
      title="Empresas"
      description="Multi-empresa do grupo Lexius."
      icon={Building2}
      listPath="/v1/empresas"
      columns={empresaColumns}
      create={{
        path: '/v1/empresas',
        submitLabel: 'Nova empresa (MASTER)',
        fields: [
          { key: 'razao_social', label: 'Razão social', type: 'text', required: true },
          { key: 'cnpj', label: 'CNPJ (14 dígitos)', type: 'text', required: true },
          {
            key: 'tipo',
            label: 'Tipo',
            type: 'select',
            required: true,
            defaultValue: 'OUTRA',
            options: [
              { value: 'COBRANCA', label: 'Cobrança' },
              { value: 'SISTEMAS', label: 'Sistemas' },
              { value: 'ADVOCACIA', label: 'Advocacia' },
              { value: 'OUTRA', label: 'Outra' },
            ],
          },
        ],
        buildBody: (v) => ({
          razao_social: v.razao_social,
          cnpj: v.cnpj.replace(/\D/g, ''),
          tipo: v.tipo,
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

