import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { PawLoader } from '../../components/ui/paw-loader';
import { safeInternalPath } from '../../lib/utils/safe-url';

export function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const errorParam = params.get('error_description') ?? params.get('error');
      if (errorParam) {
        setError(errorParam);
        return;
      }
      try {
        if (code) {
          const { error: exError } = await supabase.auth.exchangeCodeForSession(code);
          if (exError) throw exError;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error('No se pudo completar el inicio de sesión.');
        }

        // Destino posterior al login. Se acepta SOLO una ruta interna: `next=//evil.com`
        // o `next=https://evil.com` serían open redirect, así que cualquier cosa que
        // no sea una ruta relativa simple cae al inicio.
        const storedNext = window.sessionStorage.getItem('patitas:auth-next');
        window.sessionStorage.removeItem('patitas:auth-next');
        const next = safeInternalPath(params.get('next') ?? storedNext);

        navigate(next, { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al completar autenticación.');
      }
    };
    run();
  }, [navigate]);

  return (
    <section className="grid min-h-[calc(100vh-8rem)] place-items-center py-10">
      <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-12 text-center max-w-md w-full shadow-md space-y-6">
        {error ? (
          <>
            <div className="size-16 rounded-2xl bg-lost/10 flex items-center justify-center mx-auto animate-shake">
              <PawPrint className="size-8 text-lost" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-xl font-extrabold text-foreground">
                Error en la autenticación
              </h2>
              <p className="text-sm text-foreground/70">{error}</p>
            </div>
          </>
        ) : (
          <>
            <PawLoader size="lg" />
            <div className="space-y-2">
              <h2 className="font-display text-xl font-extrabold text-foreground">
                Completando inicio de sesión...
              </h2>
              <p className="text-sm text-foreground/70">
                Serás redirigido en un momento
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default CallbackPage;
