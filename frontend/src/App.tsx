import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import { AuthGuard } from '@/components/auth-guard';
import { AppLayout } from '@/components/layout/app-layout';
import { EsqueciSenhaPage } from '@/pages/esqueci-senha-page';
import { LoginPage } from '@/pages/login-page';
import { RedefinirSenhaPage } from '@/pages/redefinir-senha-page';
import { DashboardPage } from '@/pages/dashboard-page';
import {
  BancosPage,
  CategoriasPage,
  ContasPagarPage,
  ContasReceberPage,
  PessoasPage,
} from '@/pages/modules';
import { EmpresasPage } from '@/pages/empresas-page';
import { RelatoriosPage } from '@/pages/relatorios-page';
import { FinanceiroDgPage } from '@/pages/financeiro-dg-page';
import { CentrosCustoPage } from '@/pages/centros-custo-page';
import { DepartamentosPage } from '@/pages/departamentos-page';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/login/esqueci-senha', element: <EsqueciSenhaPage /> },
  { path: '/login/redefinir-senha', element: <RedefinirSenhaPage /> },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
            handle: { title: 'Dashboard', subtitle: 'Visão financeira' },
          },
          {
            path: 'contas-a-receber',
            element: <ContasReceberPage />,
            handle: { title: 'Contas a Receber' },
          },
          {
            path: 'contas-a-pagar',
            element: <ContasPagarPage />,
            handle: { title: 'Contas a Pagar' },
          },
          { path: 'bancos', element: <BancosPage />, handle: { title: 'Contas Bancárias' } },
          { path: 'pessoas', element: <PessoasPage />, handle: { title: 'Pessoas' } },
          { path: 'empresas', element: <EmpresasPage />, handle: { title: 'Empresas' } },
          { path: 'categorias', element: <CategoriasPage />, handle: { title: 'Categorias' } },
          {
            path: 'centros-custo',
            element: <CentrosCustoPage />,
            handle: { title: 'Centros de Custo' },
          },
          {
            path: 'departamentos',
            element: <DepartamentosPage />,
            handle: { title: 'Departamentos' },
          },
          { path: 'relatorios', element: <RelatoriosPage />, handle: { title: 'Relatórios' } },
          {
            path: 'rateio-orcamento',
            element: <FinanceiroDgPage />,
            handle: { title: 'Rateio e Orçamento' },
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}