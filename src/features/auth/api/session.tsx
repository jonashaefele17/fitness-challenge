import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/shared/lib/supabase';

export type SessionState = { status: 'loading' } | { status: 'ready'; session: Session | null };

const SessionContext = createContext<SessionState | null>(null);

/** Removes OAuth leftovers (?code=…) from the address bar once the session is known. */
function cleanAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('code')) return;
  url.searchParams.delete('code');
  window.history.replaceState(window.history.state, '', url.toString());
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({ status: 'ready', session: data.session });
      cleanAuthParamsFromUrl();
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState({ status: 'ready', session });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const state = useContext(SessionContext);
  if (!state) throw new Error('useSession must be used inside <SessionProvider>.');
  return state;
}

/** The signed-in user's id. Only call below a gate that guarantees a session. */
export function useUserId(): string {
  const state = useSession();
  if (state.status !== 'ready' || !state.session) {
    throw new Error('useUserId requires a signed-in session.');
  }
  return state.session.user.id;
}
