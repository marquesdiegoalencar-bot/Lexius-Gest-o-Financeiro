/** Camada demonstrativa — não reflete dados reais do banco. */
export const DEMO_LABEL = 'Demonstrativo';

export type DashboardMock = {
  dailySales: number;
  receivables: number;
  managerialResult: number;
  orderCount: number;
  dailyProduction: number;
  stockAlerts: number;
  salesChart: { day: string; value: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  financialSummary: { label: string; value: number }[];
  productionSchedule: { time: string; item: string; status: string }[];
  recentActivities: { at: string; text: string }[];
};

export function getDashboardDemo(): DashboardMock {
  return {
    dailySales: 12480.5,
    receivables: 3820.0,
    managerialResult: 4180.75,
    orderCount: 186,
    dailyProduction: 1240,
    stockAlerts: 3,
    salesChart: [
      { day: 'Seg', value: 8200 },
      { day: 'Ter', value: 9100 },
      { day: 'Qua', value: 8800 },
      { day: 'Qui', value: 10200 },
      { day: 'Sex', value: 12480 },
      { day: 'Sáb', value: 14100 },
      { day: 'Dom', value: 9600 },
    ],
    topProducts: [
      { name: 'Pão francês', qty: 420, revenue: 2100 },
      { name: 'Croissant manteiga', qty: 180, revenue: 1620 },
      { name: 'Bolo de chocolate', qty: 24, revenue: 1440 },
    ],
    financialSummary: [
      { label: 'Faturamento bruto', value: 12480.5 },
      { label: 'CMV estimado', value: -4980 },
      { label: 'Despesas fixas (rateio)', value: -3320 },
      { label: 'Resultado', value: 4180.75 },
    ],
    productionSchedule: [
      { time: '05:00', item: 'Fornada pão francês', status: 'Concluído' },
      { time: '07:30', item: 'Folhados', status: 'Em andamento' },
      { time: '10:00', item: 'Bolos sob encomenda', status: 'Agendado' },
    ],
    recentActivities: [
      { at: '08:42', text: 'Pedido #1842 finalizado (demonstrativo)' },
      { at: '08:15', text: 'Alerta de estoque: fermento (demonstrativo)' },
      { at: '07:50', text: 'Fornada matinal registrada (demonstrativo)' },
    ],
  };
}