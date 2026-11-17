import {
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  FolderTree,
  Landmark,
  LineChart,
  Tag,
  Users,
} from 'lucide-react';
import { ModuleShell } from './module-shell';

export function ContasReceberPage() {
  return (
    <ModuleShell
      title="Contas a Receber"
      description="Gestão de títulos, baixas, boletos e integração com cobrança."
      icon={ArrowDownCircle}
      endpoints={[
        'GET /v1/titulos-receber',
        'POST /v1/titulos-receber',
        'POST /v1/titulos-receber/:id/baixar',
      ]}
    />
  );
}

export function ContasPagarPage() {
  return (
    <ModuleShell
      title="Contas a Pagar"
      description="Lançamentos, aprovação e pagamento de despesas."
      icon={ArrowUpCircle}
      endpoints={['GET /v1/titulos-pagar', 'POST /v1/titulos-pagar', 'POST /v1/titulos-pagar/:id/aprovar']}
    />
  );
}

export function BancosPage() {
  return (
    <ModuleShell
      title="Contas Bancárias"
      description="Saldos, extrato, sincronização Inter e tarifas de cobrança."
      icon={Landmark}
      endpoints={[
        'GET /v1/contas-bancarias',
        'GET /v1/contas-bancarias/:id/saldo',
        'GET /v1/contas-bancarias/:id/extrato',
      ]}
    />
  );
}

export function PessoasPage() {
  return (
    <ModuleShell
      title="Pessoas"
      description="Clientes, credores e dados bancários para repasses."
      icon={Users}
      endpoints={['GET /v1/pessoas', 'POST /v1/pessoas', 'PATCH /v1/pessoas/:id']}
    />
  );
}

export function EmpresasPage() {
  return (
    <ModuleShell
      title="Empresas"
      description="Multi-empresa do grupo Lexius."
      icon={Building2}
      endpoints={['GET /v1/empresas', 'POST /v1/empresas']}
    />
  );
}

export function CategoriasPage() {
  return (
    <ModuleShell
      title="Categorias"
      description="Plano de contas gerencial (receitas e despesas)."
      icon={Tag}
      endpoints={['GET /v1/categorias', 'POST /v1/categorias']}
    />
  );
}

export function CentrosCustoPage() {
  return (
    <ModuleShell
      title="Centros de Custo"
      description="Rateio e DRE por centro."
      icon={FolderTree}
      endpoints={['GET /v1/centros-custo', 'POST /v1/centros-custo']}
    />
  );
}

export function RelatoriosPage() {
  return (
    <ModuleShell
      title="Relatórios"
      description="Inadimplência, títulos e indicadores financeiros."
      icon={LineChart}
      endpoints={[
        'GET /v1/relatorios/vencidos',
        'GET /v1/relatorios/titulos-receber',
        'GET /v1/relatorios/titulos-pagar',
      ]}
    />
  );
}