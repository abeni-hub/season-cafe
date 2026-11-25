import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { RefreshCw, ServerCrash } from 'lucide-react';
import { HAS_REMOTE_API } from '@/config/brand';
import { initializeRemoteSession } from '@/services/api/session';
import { errorMessage } from '@/services/errors';

type State = { phase: 'loading' } | { phase: 'ready' } | { phase: 'error'; message: string };

export function RemoteBootstrap({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(
    HAS_REMOTE_API ? { phase: 'loading' } : { phase: 'ready' },
  );

  const load = useCallback(async () => {
    if (!HAS_REMOTE_API) return;
    setState({ phase: 'loading' });
    try {
      await initializeRemoteSession();
      setState({ phase: 'ready' });
    } catch (error) {
      setState({ phase: 'error', message: errorMessage(error) });
    }
  }, []);

  useEffect(() => {
    if (!HAS_REMOTE_API) return;
    void load();
    const onExpired = () => {
      initializeRemoteSession().catch((error) => {
        setState({ phase: 'error', message: errorMessage(error) });
      });
    };
    window.addEventListener('seasons:auth-expired', onExpired);
    return () => window.removeEventListener('seasons:auth-expired', onExpired);
  }, [load]);

  if (!HAS_REMOTE_API || state.phase === 'ready') return <>{children}</>;

  if (state.phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="text-center">
          <img
            src="/brand/season-cake-logo.png"
            alt="Seasons Cake"
            className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-soft"
          />
          <p className="mt-5 font-display text-2xl text-forest-deep">Connecting to the bakery ledger</p>
          <p className="mt-2 text-sm text-muted">Loading authoritative data from the Django API…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="max-w-lg rounded-3xl border border-line bg-cream p-8 text-center shadow-soft">
        <ServerCrash className="mx-auto h-10 w-10 text-clay-deep" />
        <h1 className="mt-4 font-display text-2xl text-forest-deep">The API could not be reached</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{state.message}</p>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          This build is configured for the live Django API, so it will not substitute demo records. Check
          that the backend is running, that <span className="font-mono">VITE_API_BASE_URL</span> is correct,
          and that this origin is allowed by CORS.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-forest-deep px-4 py-2.5 text-sm font-semibold text-cream"
        >
          <RefreshCw className="h-4 w-4" /> Retry connection
        </button>
      </div>
    </div>
  );
}
