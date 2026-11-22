import { Tag, Users } from 'lucide-react';
import { ApiResourcePage, type ColumnDef } from '@/components/api-resource-page';

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

