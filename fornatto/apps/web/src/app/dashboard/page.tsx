'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminShell } from '@/components/layout/admin-shell';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { clearSession, loadSession } from '@/lib/auth/session';

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof loadSession>>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s?.accessToken) {
      router.replace('/login');
      return;
    }
    setSession(s);
  }, [router]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-fornatto-brown">
        Carregando…
      </div>
    );
  }

  return (
    <AdminShell
      userName={session.userName}
      companyName={session.companyName}
      onLogout={() => {
        clearSession();
        router.push('/login');
      }}
    >
      <DashboardView />
    </AdminShell>
  );
}