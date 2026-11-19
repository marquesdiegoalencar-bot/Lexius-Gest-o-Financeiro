import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import { AuthGuard } from '@/components/auth-guard';
import { AppLayout } from '@/components/layout/app-layout';
import { LoginPage } from '@/pages/login-page';
import { DashboardPage } from '@/pages/dashboard-page';
import {
  BancosPage,
  CategoriasPage,
  CentrosCustoPage,
  ContasPagarPage,
  ContasReceberPage,
  EmpresasPage,
  PessoasPage,
} from '@/pages/modules';
import { RelatoriosPage } from '@/pages/relatorios-page';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
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
          { path: 'relatorios', element: <RelatoriosPage />, handle: { title: 'Relatórios' } },
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