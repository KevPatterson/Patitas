import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import { syncProfileFromAuth } from '../lib/supabase/profiles';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        try {
          await syncProfileFromAuth(data.session.user);
        } catch (e) {
          console.warn('Error sincronizando perfil desde auth:', e);
        }
      }
      if (mounted) setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      // Al iniciar sesión (Google o email) sincronizamos el perfil.
      if (event === 'SIGNED_IN' && nextSession) {
        void syncProfileFromAuth(nextSession.user).catch((e) => {
          console.warn('Error sincronizando perfil desde auth:', e);
        });
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isLoading: loading, // Alias para consistencia
    }),
    [loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
