import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DEMO_LABEL, getDashboardDemo } from '@/lib/demo/dashboard-mock';

function formatBrl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function DashboardView() {
  const d = getDashboardDemo();
  const maxChart = Math.max(...d.salesChart.map((x) => x.value));

  return (
    <div className="space-y-6">
      <p className="text-sm text-fornatto-brown/70">
        Métricas abaixo são <strong>{DEMO_LABEL.toLowerCase()}</strong> — não conectadas ao banco
        nesta fase.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi title="Vendas do dia" value={formatBrl(d.dailySales)} />
        <Kpi title="A receber" value={formatBrl(d.receivables)} />
        <Kpi title="Resultado gerencial" value={formatBrl(d.managerialResult)} />
        <Kpi title="Pedidos" value={String(d.orderCount)} />
        <Kpi title="Produção do dia (un.)" value={String(d.dailyProduction)} />
        <Kpi title="Alertas de estoque" value={String(d.stockAlerts)} highlight />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas da semana ({DEMO_LABEL})</CardTitle>
          </CardHeader>
          <CardContent>
            <EntryChart data={d.salesChart} max={maxChart} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top produtos ({DEMO_LABEL})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {d.topProducts.map((p) => (
                <li key={p.name} className="flex justify-between border-b border-fornatto-cream py-2">
                  <span>{p.name}</span>
                  <span className="text-fornatto-brown/80">
                    {p.qty} un. · {formatBrl(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Resumo financeiro ({DEMO_LABEL})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {d.financialSummary.map((row) => (
              <div key={row.label} className="flex justify-between">
                <span>{row.label}</span>
                <span className={row.value < 0 ? 'text-red-700' : ''}>{formatBrl(row.value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Produção agendada ({DEMO_LABEL})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {d.productionSchedule.map((s) => (
                <li key={s.time + s.item}>
                  <span className="font-medium text-fornatto-gold">{s.time}</span> — {s.item}
                  <span className="block text-xs text-fornatto-brown/60">{s.status}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Atividades recentes ({DEMO_LABEL})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {d.recentActivities.map((a, i) => (
                <li key={i}>
                  <span className="text-fornatto-gold">{a.at}</span> — {a.text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ title, value, highlight }: { title: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-amber-300 bg-amber-50/50' : undefined}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-fornatto-brown">{value}</p>
      </CardContent>
    </Card>
  );
}

function EntryChart({ data, max }: { data: { day: string; value: number }[]; max: number }) {
  return (
    <div className="flex h-40 items-end justify-between gap-2">
      {data.map((bar) => (
        <div key={bar.day} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full max-w-[2rem] rounded-t bg-fornatto-gold"
            style={{ height: `${Math.round((bar.value / max) * 100)}%`, minHeight: '8%' }}
            title={formatBrl(bar.value)}
          />
          <span className="text-xs text-fornatto-brown/70">{bar.day}</span>
        </div>
      ))}
    </div>
  );
}