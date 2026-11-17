import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ModuleShellProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  endpoints: string[];
};

export function ModuleShell({ title, description, icon: Icon, endpoints }: ModuleShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lexius-100 text-lexius-700">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 max-w-2xl text-slate-600">{description}</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integração preparada</CardTitle>
          <CardDescription>
            Esta tela será conectada aos endpoints abaixo. O layout e a navegação já estão prontos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {endpoints.map((ep) => (
            <EndpointRow key={ep} ep={ep} />
          ))}
        </CardContent>
      </Card>
      <Badge variant="secondary">Módulo em evolução · dados virão da API em produção</Badge>
    </div>
  );
}

function EndpointRow({ ep }: { ep: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-xs">
      <code className="text-sm text-slate-800">{ep}</code>
    </div>
  );
}