'use client';

import { useState } from 'react';
import LoginForm from '@/components/LoginForm';
import RegisterForm from '@/components/RegisterForm';
import VaultDashboard from '@/components/VaultDashboard';
import Settings from '@/components/Settings';
import Recovery from '@/components/Recovery';
import { Shield } from 'lucide-react';
import { useAutoLock } from '@/hooks/useAutoLock';
import { clsx } from 'clsx';

type ViewState = 'login' | 'register' | 'dashboard' | 'settings' | 'recovery';

export default function Home() {
  const [view, setView] = useState<ViewState>('login');
  const [session, setSession] = useState<any>(null);

  const handleLoginSuccess = (sessionData: any) => {
    setSession(sessionData);
    setView('dashboard');
  };

  const handleLogout = () => {
    setSession(null);
    setView('login');
    // Clear decrypted keys from memory immediately
    if (window.gc) window.gc();
  };

  // 🛡️ Auto-Lock Feature
  useAutoLock(!!session && view !== 'login', handleLogout);

  const handleUpdateSession = (updates: any) => {
    setSession((prev: any) => ({ ...prev, ...updates }));
  };

  return (
    <main className={clsx(
      "flex min-h-screen flex-col items-center bg-slate-950 text-slate-200",
      view === 'dashboard' ? "p-0 md:p-8" : "p-4 md:p-24"
    )}>

      {/* Header only when not in dashboard to avoid clutter */}
      {view !== 'dashboard' && (
        <div className="mb-12 text-center">
          <div className="w-16 h-16 bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent italic">
            AXIOM
          </h1>
          <p className="text-slate-500 mt-2 font-medium tracking-wide uppercase text-[10px]">Advanced Security Control System</p>
        </div>
      )}

      {view === 'login' && (
        <div className="w-full max-w-md bg-slate-900/50 p-6 sm:p-10 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
          <LoginForm
            onSuccess={handleLoginSuccess}
            onSwitchToRegister={() => setView('register')}
            onOpenRecovery={() => setView('recovery')}
          />
        </div>
      )}

      {view === 'register' && (
        <div className="w-full max-w-md bg-slate-900/50 p-6 sm:p-10 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
          <RegisterForm
            onSuccess={() => setView('login')}
            onSwitchToLogin={() => setView('login')}
          />
        </div>
      )}

      {view === 'dashboard' && session && (
        <VaultDashboard
          session={session}
          onLogout={handleLogout}
          onOpenSettings={() => setView('settings')}
        />
      )}

      {view === 'settings' && session && (
        <Settings
          session={session}
          onBack={() => setView('dashboard')}
          onUpdateSession={handleUpdateSession}
        />
      )}

      {view === 'recovery' && (
        <div className="w-full max-w-md bg-slate-900/50 p-6 sm:p-10 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
          <Recovery
            onSuccess={() => setView('login')}
            onBack={() => setView('login')}
          />
        </div>
      )}

    </main>
  );
}
