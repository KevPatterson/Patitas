import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, PawPrint, MapPin, CheckCircle, Eye, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { PublicationCard } from '../components/publications/publication-card';
import { CatLoader } from '../components/ui/cat-loader';
import { EmptyState } from '../components/ui/empty-state';
import { supabase } from '../lib/supabase/client';
import type { PublicationSummary } from '../lib/supabase/publication-search';
import { setPageMeta } from '../lib/seo/page-meta';

type ProfileRow = {
  id: string;
  username: string;
  full_name: string | null;
  created_at: string;
  avatar_url: string | null;
};

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [publications, setPublications] = useState<PublicationSummary[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      setError('Usuario no especificado.');
      setLoading(false);
      return;
    }

    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, created_at, avatar_url')
          .eq('username', username)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profileData) {
          if (active) {
            setError(`No encontramos el perfil @${username}.`);
            setProfile(null);
            setPublications([]);
            setStats({ total: 0, active: 0, resolved: 0 });
          }
          return;
        }

        const profileRow = profileData as ProfileRow;

        if (active) {
          setProfile(profileRow);
        }

        // Publicaciones públicas del usuario (excluye DELETED/HIDDEN). Las
        // estadísticas se piden con count real: el límite de 24 es solo para no
        // pintar listas enormes, no para calcular los totales.
        const [pubsResult, totalResult, activeResult, resolvedResult] = await Promise.all([
          supabase
            .from('publications')
            .select(`
              id, slug, title, description, type, status, species, breed, color, sex, size, age_approx, published_at, resolved_at,
              publication_images(storage_path, is_cover),
              locations(province, municipality, zone, approximate_lat, approximate_lng)
            `)
            .eq('owner_profile_id', profileRow.id)
            .neq('status', 'DELETED')
            .neq('status', 'HIDDEN')
            .order('published_at', { ascending: false })
            .limit(24),
          supabase
            .from('publications')
            .select('id', { count: 'exact', head: true })
            .eq('owner_profile_id', profileRow.id)
            .neq('status', 'DELETED')
            .neq('status', 'HIDDEN'),
          supabase
            .from('publications')
            .select('id', { count: 'exact', head: true })
            .eq('owner_profile_id', profileRow.id)
            .eq('status', 'ACTIVE'),
          supabase
            .from('publications')
            .select('id', { count: 'exact', head: true })
            .eq('owner_profile_id', profileRow.id)
            .eq('status', 'RESOLVED'),
        ]);

        const { data: pubs, error: pubsError } = pubsResult;

        if (pubsError) throw pubsError;

        if (active) {
          setStats({
            total: totalResult.count ?? 0,
            active: activeResult.count ?? 0,
            resolved: resolvedResult.count ?? 0,
          });
        }

        const mapped: PublicationSummary[] = (pubs as unknown as Array<{
          id: string;
          slug: string;
          title: string;
          description: string;
          type: PublicationSummary['type'];
          status: PublicationSummary['status'];
          species: string;
          breed: string | null;
          color: string | null;
          sex: string | null;
          size: string | null;
          age_approx: string | null;
          published_at: string;
          resolved_at: string | null;
          publication_images: Array<{ storage_path: string; is_cover: boolean | null }>;
          locations: Array<{ province: string; municipality: string; zone: string | null; approximate_lat: number | null; approximate_lng: number | null }>;
        }>).map((row) => {
          const loc = row.locations?.[0] ?? null;
          const cover = row.publication_images?.find((i) => i.is_cover) ?? row.publication_images?.[0] ?? null;
          const coverUrl = cover?.storage_path
            ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/pet-images/${cover.storage_path}`
            : null;
          return {
            id: row.id,
            slug: row.slug,
            title: row.title,
            description: row.description,
            type: row.type,
            status: row.status,
            species: row.species,
            breed: row.breed,
            color: row.color,
            sex: row.sex,
            size: row.size,
            ageApprox: row.age_approx,
            publishedAt: row.published_at,
            resolvedAt: row.resolved_at,
            province: loc?.province ?? null,
            municipality: loc?.municipality ?? null,
            zone: loc?.zone ?? null,
            approximateLat: loc?.approximate_lat ?? null,
            approximateLng: loc?.approximate_lng ?? null,
            coverImageUrl: coverUrl,
          };
        });

        if (active) setPublications(mapped);

        setPageMeta({
          title: `@${profileRow.username} · Perfil · Patitas`,
          description: `Publicaciones de @${profileRow.username} en Patitas.`,
          canonicalPath: `/perfil/${profileRow.username}`,
        });
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'No pudimos cargar el perfil.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [username]);

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center min-h-[60vh] gap-4 py-10">
        <CatLoader size="lg" />
        <p className="font-display text-lg font-semibold text-foreground">Cargando perfil...</p>
      </section>
    );
  }

  if (error || !profile) {
    return (
      <section className="py-10">
        <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-12 text-center shadow-md">
          <div className="mx-auto max-w-md space-y-4">
            <div className="size-16 rounded-2xl bg-lost/10 flex items-center justify-center mx-auto">
              <User className="size-8 text-lost" />
            </div>
            <h1 className="font-display text-2xl font-extrabold text-foreground">{error ?? 'Perfil no encontrado'}</h1>
            <p className="text-foreground/70">Verifica el nombre de usuario o vuelve al inicio.</p>
            <Link to="/">
              <Button variant="primary">Volver al inicio</Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8 py-10">
      {/* Hero del perfil */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-purple/10 via-app to-turquoise/10 border-2 border-foreground/10 p-8 shadow-md">
        <div className="blob-decoration absolute top-5 right-5 size-24 bg-orange/20" />
        <div className="relative flex flex-col md:flex-row items-center gap-6">
          <div className="size-24 rounded-2xl overflow-hidden border-4 border-foreground/10 shadow-lg bg-linear-to-br from-orange to-turquoise flex items-center justify-center text-white text-4xl font-display font-extrabold">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`Avatar de ${profile.username}`}
                className="size-full object-cover"
              />
            ) : (
              profile.username?.[0]?.toUpperCase() || 'U'
            )}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
              <User className="size-5 text-foreground/60" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Perfil público</span>
            </div>
            <h1 className="font-display text-4xl font-extrabold text-foreground mb-2">@{profile.username}</h1>
            {profile.full_name && <p className="font-semibold text-foreground">{profile.full_name}</p>}
            <p className="text-sm text-foreground/60 flex items-center gap-1 justify-center md:justify-start mt-1">
              <Calendar className="size-4" />
              Miembro desde {new Date(profile.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}
            </p>
          </div>
          <Link to="/buscar">
            <Button variant="secondary">Ver publicaciones</Button>
          </Link>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="group rounded-2xl border-2 border-orange/20 bg-orange/5 p-6 text-center transition-all hover:shadow-lg hover:-translate-y-1">
          <PawPrint className="size-8 text-orange mx-auto mb-2" />
          <p className="font-display text-3xl font-extrabold text-foreground">{stats.total}</p>
          <p className="text-sm font-medium text-foreground/70">Publicaciones</p>
        </div>
        <div className="group rounded-2xl border-2 border-turquoise/20 bg-turquoise/5 p-6 text-center transition-all hover:shadow-lg hover:-translate-y-1">
          <MapPin className="size-8 text-turquoise mx-auto mb-2" />
          <p className="font-display text-3xl font-extrabold text-foreground">{stats.active}</p>
          <p className="text-sm font-medium text-foreground/70">Casos activos</p>
        </div>
        <div className="group rounded-2xl border-2 border-purple/20 bg-purple/5 p-6 text-center transition-all hover:shadow-lg hover:-translate-y-1">
          <CheckCircle className="size-8 text-purple mx-auto mb-2" />
          <p className="font-display text-3xl font-extrabold text-foreground">{stats.resolved}</p>
          <p className="text-sm font-medium text-foreground/70">Resueltos</p>
        </div>
      </div>

      {/* Publicaciones */}
      {publications.length === 0 ? (
        <EmptyState
          title={`@${profile.username} aún no ha publicado`}
          description="Cuando publique un caso, aparecerá aquí."
          illustration="cat"
          action={
            <Link to="/buscar">
              <Button variant="primary">Explorar casos</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <h2 className="font-display text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Eye className="size-6 text-orange" />
            Publicaciones de @{profile.username}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {publications.map((pub) => (
              <PublicationCard key={pub.id} publication={pub} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default ProfilePage;
