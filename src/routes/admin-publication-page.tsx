import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { getPublicationById } from '../lib/supabase/publication-search';
import { PawLoader } from '../components/ui/paw-loader';
import { LinkButton } from '../components/ui/button';
import { setPageMeta } from '../lib/seo/page-meta';

/**
 * Resolutor de publicaciones por identificador (tarea 5.7).
 *
 * Las colas de administración conocen el `id` (uuid) de una publicación, no su
 * `slug`, y enlazaban a `/admin/publications/<id>`, una ruta que **no existía**:
 * el enlace caía en el 404. En lugar de duplicar la vista de publicación en el
 * panel, esta ruta resuelve el slug y redirige a la página pública, que ya está
 * preparada para mostrarla.
 *
 * Si la publicación no existe o el usuario no tiene acceso, se muestra un estado
 * con salida (volver al panel) en vez de un callejón sin salida.
 */
export function AdminPublicationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPageMeta({
      title: 'Publicación — Patitas',
      description: 'Acceso a una publicación desde el panel de administración.',
      canonicalPath: `/admin/publicaciones/${id ?? ''}`,
    });

    let cancelled = false;

    const run = async () => {
      if (!id) {
        setError('Falta el identificador de la publicación.');
        return;
      }

      try {
        const publication = await getPublicationById(id);

        if (cancelled) return;

        if (!publication) {
          setError('No encontramos esa publicación. Puede que se haya eliminado.');
          return;
        }

        navigate(`/p/${publication.slug}`, { replace: true });
      } catch {
        if (!cancelled) setError('No pudimos cargar la publicación.');
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  if (!error) {
    return (
      <section className="grid min-h-[60vh] place-items-center py-10">
        <div className="flex flex-col items-center gap-4">
          <PawLoader size="lg" />
          <p className="font-display text-lg font-semibold text-foreground">Abriendo la publicación…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid min-h-[60vh] place-items-center py-10">
      <div className="w-full max-w-md space-y-5 rounded-3xl border-2 border-foreground/10 bg-surface p-8 text-center shadow-md">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-lost/10">
          <AlertCircle className="size-7 text-lost" aria-hidden />
        </div>
        <h1 className="font-display text-xl font-extrabold text-foreground">Publicación no disponible</h1>
        <p className="text-sm text-foreground/70">{error}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <LinkButton href="/admin">Volver al panel</LinkButton>
          <Link className="text-sm font-semibold text-orange hover:text-orange-dark" to="/buscar">
            Ir a buscar
          </Link>
        </div>
      </div>
    </section>
  );
}

export default AdminPublicationPage;
