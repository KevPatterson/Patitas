import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { CatLoader } from '../../components/ui/cat-loader';
import { safeInternalPath } from '../../lib/utils/safe-url';

/**
 * Pantalla intermedia del login con Google.
 *
 * El cliente de Supabase tiene `detectSessionInUrl: true`, así que al cargar la
 * app ya canjea por su cuenta el `code` PKCE que Google añade a la URL. Hacer
 * `exchangeCodeForSession` aquí sería un segundo canje del mismo código (falla
 * con "invalid flow state" / "code already used") y, como ambas operaciones
 * compiten, el resultado depende de quién llegue primero.
 *
 * Por eso aquí no se canjea nada: se espera a que exista sesión, ya sea porque
 * el cliente terminó el canje o porque el usuario ya estaba autenticado.
 */
export function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let finished = false;

    // Los errores pueden venir en el query (PKCE) o en el hash (implicit).
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errorParam =
      searchParams.get('error_description') ??
      searchParams.get('error') ??
      searchParams.get('error_code') ??
      hashParams.get('error_description') ??
      hashParams.get('error') ??
      hashParams.get('error_code');

    if (errorParam) {
      setError(errorParam);
      return;
    }

    const finish = () => {
      if (cancelled || finished) return;
      finished = true;

      // Destino posterior al login. Se acepta SOLO una ruta interna: `next=//evil.com`
      // o `next=https://evil.com` serían open redirect, así que cualquier cosa que
      // no sea una ruta relativa simple cae al inicio.
      const storedNext = window.sessionStorage.getItem('patitas:auth-next');
      window.sessionStorage.removeItem('patitas:auth-next');
      const next = safeInternalPath(searchParams.get('next') ?? storedNext);

      navigate(next, { replace: true });
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        finish();
      }
    });

    // Si el canje automático ya terminó antes de suscribirnos, no habrá evento:
    // se comprueba la sesión existente una vez.
    void supabase.auth
      .getSession()
      .then(({ data: sessionData }) => {
        if (sessionData.session) finish();
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al completar autenticación.');
        }
      });

    // Si el canje automático falla (código caducado, reutilizado o inválido),
    // supabase-js no expone el error al consumidor. Sin sesión ni evento, se
    // muestra un mensaje genérico en lugar de dejar la pantalla cargando.
    const timeout = window.setTimeout(() => {
      if (!cancelled && !finished) {
        setError('No pudimos completar el inicio de sesión. Vuelve a intentarlo desde la página de acceso.');
      }
    }, 12000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
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
              <button
                type="button"
                onClick={() => navigate('/auth/login', { replace: true })}
                className="text-sm font-semibold text-orange hover:text-orange-dark transition-colors"
              >
                Volver al inicio de sesión
              </button>
            </div>
          </>
        ) : (
          <>
            <CatLoader size="lg" />
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
