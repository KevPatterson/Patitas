import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/auth-context';
import { getMyPublications, type MyPublication } from '../lib/supabase/my-publications';
import { resolvePublication, deletePublication } from '../lib/supabase/publication-actions';
import { signOut } from '../lib/supabase/auth';
import { getProfile, uploadAvatar, deleteAvatar, getOAuthAvatarUrl, notifyAvatarUpdated } from '../lib/supabase/profiles';
import { PublicationCard } from '../components/publications/publication-card';
import { Button } from '../components/ui/button';
import { CatLoader } from '../components/ui/cat-loader';
import { EmptyState } from '../components/ui/empty-state';
import { AvatarUpload } from '../components/ui/avatar-upload';
import { Trash2, CheckCircle, Eye, PlusCircle, FileText, User as UserIcon, PawPrint, TrendingUp, LogOut, HeartHandshake } from 'lucide-react';
import { AdoptionRequestsPanel } from '../components/adoptions/adoption-requests-panel';

type Tab = 'resumen' | 'publicaciones' | 'adopciones' | 'perfil';

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('resumen');
  const [publications, setPublications] = useState<MyPublication[]>([]);
  /**
   * Solo el PRIMER cargamento oculta la interfaz.
   *
   * Era la pieza que faltaba: el `return` temprano con el loader se disparaba en
   * cada recarga, así que la página entera —incluidas las pestañas y el panel de
   * adopciones— se desmontaba y volvía a montarse. Al remontarse, el panel pedía
   * otra vez sus datos (cada consulta llama a `auth.getUser()`), y si eso refrescaba
   * el token, Supabase emitía `TOKEN_REFRESHED` → nueva sesión → nuevo objeto
   * `user` → el efecto se re-ejecutaba. Ese era el bucle infinito.
   */
  const [initialLoading, setInitialLoading] = useState(true);
  const [stats, setStats] = useState({ active: 0, resolved: 0, total: 0 });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  /**
   * Carga las publicaciones y las estadísticas.
   *
   * No toca ningún estado de "cargando" global: la interfaz solo se oculta con
   * `initialLoading`, en el primer render. Así, recargar datos nunca desmonta la
   * página ni sus pestañas.
   */
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const data = await getMyPublications();
      setPublications(data);
      setStats({
        active: data.filter((p) => p.status === 'ACTIVE').length,
        resolved: data.filter((p) => p.status === 'RESOLVED').length,
        total: data.length,
      });
    } catch (error) {
      console.error('Error loading publications:', error);
    } finally {
      setInitialLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth/login?next=${encodeURIComponent('/dashboard')}`, { replace: true });
    }
  }, [authLoading, user, navigate]);

  /**
   * Se carga UNA vez por usuario.
   *
   * La dependencia es `userId` (una cadena estable), no el objeto `user`: cualquier
   * refresco de token de Supabase crea una sesión nueva con un `user` nuevo, y con
   * el objeto en las dependencias el efecto se re-ejecutaba para siempre.
   */
  const userId = user?.id;

  const loadProfileData = useCallback(async () => {
    if (!userId) return;

    try {
      const profile = await getProfile(userId);
      setAvatarUrl(profile.avatar_url ?? getOAuthAvatarUrl(user) ?? null);
    } catch (error) {
      console.error('Error loading profile:', error);
      setAvatarUrl(getOAuthAvatarUrl(user));
    }
    // `user` se usa solo como respaldo del avatar; no se incluye para no recrear
    // la función con cada refresco de sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (userId) {
      void loadData();
      void loadProfileData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    const newAvatarUrl = await uploadAvatar(user.id, file);
    setAvatarUrl(newAvatarUrl);
    notifyAvatarUpdated();
  };

  const handleAvatarDelete = async () => {
    if (!user) return;
    // deleteAvatar devuelve la foto de Google/OAuth si existe; si no, null.
    const newAvatarUrl = await deleteAvatar(user.id);
    setAvatarUrl(newAvatarUrl ?? getOAuthAvatarUrl(user) ?? null);
    notifyAvatarUpdated();
  };

  const handleResolve = async (id: string) => {
    if (!user) return;
    setActionLoading(id);
    try {
      await resolvePublication(id, user.id);
      setPublications((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'RESOLVED' as const } : p))
      );
      setStats((s) => ({ ...s, active: s.active - 1, resolved: s.resolved + 1 }));
    } catch (error) {
      console.error('Error resolving:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !window.confirm('¿Eliminar esta publicación? No se puede deshacer.')) return;
    setActionLoading(id);
    try {
      await deletePublication(id, user.id);
      const deletedPub = publications.find((p) => p.id === id);
      setPublications((prev) => prev.filter((p) => p.id !== id));
      setStats((s) => ({
        ...s,
        total: s.total - 1,
        active: s.active - (deletedPub?.status === 'ACTIVE' ? 1 : 0),
      }));
    } catch (error) {
      console.error('Error deleting:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  // Sin sesión no se pinta nada: el efecto de arriba ya está redirigiendo a
  // /auth/login. Se comprueba ANTES del loader para que, si no hay usuario, no se
  // quede un spinner eterno (initialLoading solo se apaga al cargar datos, y sin
  // usuario no se cargan).
  if (!authLoading && !user) return null;

  if (authLoading || initialLoading) {
    return (
      <section className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <CatLoader size="lg" />
        <p className="font-display text-lg font-semibold text-foreground">Cargando tu panel...</p>
      </section>
    );
  }

  // A estas alturas `user` existe (si no, ya se habría salido antes). El chequeo
  // está aquí para que TypeScript lo estreche en todo el JSX siguiente.
  if (!user) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'resumen', label: 'Resumen', icon: <TrendingUp className="size-4" /> },
    { id: 'publicaciones', label: 'Mis publicaciones', icon: <FileText className="size-4" /> },
    { id: 'adopciones', label: 'Adopciones', icon: <HeartHandshake className="size-4" /> },
    { id: 'perfil', label: 'Cuenta', icon: <UserIcon className="size-4" /> },
  ];

  return (
    <section className="space-y-8 py-8">
      {/* Header del dashboard */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-orange/10 via-app to-turquoise/10 border-2 border-foreground/10 p-8 shadow-md">
        <div className="blob-decoration absolute top-5 right-5 size-24 bg-purple/20" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PawPrint className="size-5 text-orange animate-paw-bounce" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Tu espacio</span>
            </div>
            <h1 className="font-display text-4xl font-extrabold text-foreground">Panel de control</h1>
            <p className="text-foreground/60 mt-1">Gestiona tus publicaciones y tu cuenta</p>
          </div>
          <Link to="/publicar">
            <Button variant="primary" className="gap-2 shadow-lg">
              <PlusCircle className="size-5" />
              Publicar caso
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs de navegación */}
      <nav className="flex flex-wrap gap-2 border-b-2 border-foreground/10 pb-2" aria-label="Pestañas del panel">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-base ease-smooth',
              activeTab === tab.id
                ? 'bg-ink text-white shadow-md scale-105'
                : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground hover:scale-102',
            ].join(' ')}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      {/* Contenido según tab activo */}
      {activeTab === 'resumen' && (
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="group rounded-2xl border-2 border-turquoise/20 bg-surface p-6 shadow-md hover:shadow-lg transition-all duration-base hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground/70">Publicaciones activas</p>
              <Eye className="size-5 text-turquoise/40 group-hover:text-turquoise transition-colors" />
            </div>
            <p className="font-display text-4xl font-extrabold text-turquoise">{stats.active}</p>
          </div>
          
          <div className="group rounded-2xl border-2 border-found/20 bg-surface p-6 shadow-md hover:shadow-lg transition-all duration-base hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground/70">Casos resueltos</p>
              <CheckCircle className="size-5 text-found/40 group-hover:text-found transition-colors" />
            </div>
            <p className="font-display text-4xl font-extrabold text-found">{stats.resolved}</p>
          </div>
          
          <div className="group rounded-2xl border-2 border-purple/20 bg-surface p-6 shadow-md hover:shadow-lg transition-all duration-base hover:-translate-y-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground/70">Total publicaciones</p>
              <FileText className="size-5 text-purple/40 group-hover:text-purple transition-colors" />
            </div>
            <p className="font-display text-4xl font-extrabold text-purple">{stats.total}</p>
          </div>
        </div>
      )}

      {activeTab === 'publicaciones' && (
        <div className="space-y-4">
          {publications.length === 0 ? (
            <EmptyState
              title="No tienes publicaciones aún"
              description="Crea tu primera publicación y ayuda a una patita a volver a casa."
              illustration="dog"
              action={
                <Link to="/publicar">
                  <Button variant="primary">
                    <PlusCircle className="size-5" />
                    Crear mi primera publicación
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {publications.map((pub) => (
                <div key={pub.id} className="relative">
                  <PublicationCard
                    publication={{
                      id: pub.id,
                      slug: pub.slug,
                      title: pub.title,
                      description: pub.description,
                      type: pub.type,
                      status: pub.status,
                      species: pub.species,
                      breed: pub.breed,
                      color: pub.color,
                      sex: pub.sex,
                      size: pub.size,
                      publishedAt: pub.published_at,
                      province: pub.province ?? null,
                      municipality: pub.municipality ?? null,
                      zone: pub.zone ?? null,
                      approximateLat: pub.approximateLat ?? null,
                      approximateLng: pub.approximateLng ?? null,
                      coverImageUrl: pub.coverImageUrl,
                    }}
                  />
                  <div className="absolute top-3 right-3 flex gap-2 z-10">
                    {pub.status !== 'RESOLVED' && (
                      <Button
                        variant="ghost"
                        onClick={() => handleResolve(pub.id)}
                        disabled={actionLoading === pub.id}
                        aria-label="Marcar como resuelto"
                        className="p-2 min-h-9 px-3 bg-surface/90 hover:bg-found/10 border border-foreground/10"
                      >
                        <CheckCircle className="size-4 text-found" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => handleDelete(pub.id)}
                      disabled={actionLoading === pub.id}
                      className="p-2 min-h-9 px-3 bg-surface/90 hover:bg-lost/10 border border-foreground/10"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="size-4 text-lost" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'adopciones' && (
        <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-6 shadow-md">
          <AdoptionRequestsPanel />
        </div>
      )}

      {activeTab === 'perfil' && (
        <div className="max-w-2xl">
          <div className="rounded-2xl border-2 border-foreground/10 bg-surface p-8 shadow-md">
            <div className="flex flex-col items-center gap-6 mb-6 pb-6 border-b-2 border-foreground/10">
              <AvatarUpload
                currentAvatarUrl={avatarUrl}
                userName={user.user_metadata?.username || user.email}
                onUpload={handleAvatarUpload}
                onDelete={handleAvatarDelete}
              />
              <div className="text-center">
                <h2 className="font-display text-2xl font-extrabold text-foreground">Tu cuenta</h2>
                <p className="text-sm text-foreground/60">Información de tu cuenta</p>
              </div>
            </div>
            
            <div className="space-y-5">
              <div className="flex items-start justify-between py-3 border-b border-foreground/5">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground/60 mb-1">Usuario</p>
                  <p className="font-semibold text-foreground">{user.user_metadata?.username ?? '—'}</p>
                </div>
              </div>
              
              <div className="flex items-start justify-between py-3 border-b border-foreground/5">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground/60 mb-1">Nombre completo</p>
                  <p className="font-semibold text-foreground">{user.user_metadata?.full_name ?? '—'}</p>
                </div>
              </div>
              
              <div className="flex items-start justify-between py-3 border-b border-foreground/5">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground/60 mb-1">Correo</p>
                  <p className="font-semibold text-foreground">{user.email ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-start justify-between py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground/60 mb-1">Miembro desde</p>
                  <p className="font-semibold text-foreground">
                    {new Date(user.created_at).toLocaleDateString('es-ES', { 
                      year: 'numeric', 
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
            {/* Ver perfil público - acceso con botón */}
            {user.user_metadata?.username && (
              <div className="mt-6">
                <Link to={`/perfil/${user.user_metadata.username}`}>
                  <Button variant="secondary" className="w-full gap-2">
                    <Eye className="size-4" aria-hidden="true" />
                    Ver mi perfil público
                  </Button>
                </Link>
                <p className="mt-2 text-center text-xs text-foreground/50">Así te ven otros usuarios de la comunidad.</p>
              </div>
            )}
            {/* Cerrar sesión */}
            <div className="mt-8 pt-6 border-t-2 border-foreground/10">
              <Button
                variant="danger"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full gap-2"
              >
                <LogOut className="size-4" aria-hidden="true" />
                {loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
              </Button>
              <p className="mt-2 text-center text-xs text-foreground/50">Se cerrará tu sesión en este dispositivo.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default DashboardPage;