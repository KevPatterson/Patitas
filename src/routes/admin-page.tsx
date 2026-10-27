import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../app/auth-context';
import { supabase } from '../lib/supabase/client';
import { Button } from '../components/ui/button';
import { DuplicateReview } from '../components/admin/duplicate-review';
import { ModerationQueue } from '../components/admin/moderation-queue';
import { TakedownQueue } from '../components/admin/takedown-queue';
import { PendingReviewQueue } from '../components/admin/pending-review-queue';
import { ExternalSourcesManager } from '../components/admin/external-sources-manager';
import { AdminMetrics } from '../components/admin/admin-metrics';
import { AuditLogPanel } from '../components/admin/audit-log-panel';
import { ChatReportsPanel } from '../components/admin/chat-reports-panel';
import { VerificationQueue } from '../components/admin/verification-queue';
import { UserPlus, Shield, Copy, AlertTriangle, Flag, CheckCircle, TrendingUp, Eye, BadgeCheck } from 'lucide-react';
import { ExternalLink, History } from 'lucide-react';
type DashboardCounts = {
  activePublications: number;
  pendingReports: number;
  resolvedCases: number;
  totalUsers: number;
  recentSightings: number;
  adoptionRequests: number;
  pendingTakedowns: number;
  approvedTakedowns: number;
  rejectedTakedowns: number;
  activeSources: number;
  inactiveSources: number;
  pendingVerifications: number;
};

type RecentReport = {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  publication_id: string;
  publication?: {
    slug: string;
    title: string;
  } | null;
};

type RecentPublication = {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
};

type UserProfile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  created_at: string;
  deleted_at: string | null;
};

type Tab = 'dashboard' | 'reports' | 'users' | 'publications' | 'duplicates' | 'moderation' | 'takedowns' | 'pending-review' | 'sources' | 'metrics' | 'audit' | 'chat-reports' | 'verifications';

export function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [reports, setReports] = useState<RecentReport[]>([]);
  const [publications, setPublications] = useState<RecentPublication[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setActionError(null);

    try {
      const [countsResults, reportsRes, pubsRes, usersRes] = await Promise.all([
        Promise.all([
          supabase.from('publications').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
          supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
          supabase.from('publications').select('id', { count: 'exact', head: true }).eq('status', 'RESOLVED'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('sightings').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
          supabase.from('adoption_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
          // Takedown metrics
          supabase.from('takedown_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
          supabase.from('takedown_requests').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED'),
          supabase.from('takedown_requests').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED'),
          // Source metrics
          supabase.from('external_sources').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('external_sources').select('id', { count: 'exact', head: true }).eq('is_active', false),
          // Verificaciones pendientes de revisión
          supabase.from('profile_verifications').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
        ]),
        supabase.from('reports').select('id, reason, status, created_at, publication_id, publication:publications(slug, title)').order('created_at', { ascending: false }).limit(20),
        supabase.from('publications').select('id, slug, title, type, status, created_at').order('created_at', { ascending: false }).limit(20),
        supabase.from('profiles').select('id, username, full_name, avatar_url, role, created_at, deleted_at').order('created_at', { ascending: false }).limit(100),
      ]);

      const [
        activePubs, pendingReports, resolvedCases, totalUsers, recentSightings, adoptionRequests,
        pendingTakedowns, approvedTakedowns, rejectedTakedowns,
        activeSources, inactiveSources, pendingVerifications
      ] = countsResults;

      setCounts({
        activePublications: activePubs.count ?? 0,
        pendingReports: pendingReports.count ?? 0,
        resolvedCases: resolvedCases.count ?? 0,
        totalUsers: totalUsers.count ?? 0,
        recentSightings: recentSightings.count ?? 0,
        adoptionRequests: adoptionRequests.count ?? 0,
        pendingTakedowns: pendingTakedowns.count ?? 0,
        approvedTakedowns: approvedTakedowns.count ?? 0,
        rejectedTakedowns: rejectedTakedowns.count ?? 0,
        activeSources: activeSources.count ?? 0,
        inactiveSources: inactiveSources.count ?? 0,
        pendingVerifications: pendingVerifications.count ?? 0,
      });

      setReports(((reportsRes.data ?? []).map((r) => ({ ...r, publication: Array.isArray(r.publication) ? r.publication[0] : r.publication })) as RecentReport[]));
      setPublications((pubsRes.data ?? []) as RecentPublication[]);
      setUsers((usersRes.data ?? []) as UserProfile[]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Error al cargar el panel');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsPrivileged(false);
      setIsAdmin(false);
      return;
    }
    refreshDashboard();
    const profileRes = supabase.from('profiles').select('role').eq('id', user.id).single();
    profileRes.then(({ data }) => {
      if (data) {
        setIsPrivileged(data.role === 'MODERATOR' || data.role === 'ADMIN');
        setIsAdmin(data.role === 'ADMIN');
      }
    });
  }, [user, authLoading, refreshDashboard]);

  const apiCall = async (action: string, id: string, extra?: Record<string, unknown>) => {
    setActionLoadingId(id);
    setActionError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error('No hay sesión activa');

      const response = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, id, ...extra }),
      });

      const raw = await response.text();
      let result: { error?: string } = {};
      try {
        result = raw ? JSON.parse(raw) : {};
      } catch {
        result = {};
      }

      if (!response.ok) {
        const fallback =
          response.status === 404
            ? 'No se encontró la API local. Ejecuta `vercel dev` para servir /api.'
            : `Error en la acción (${response.status})`;
        throw new Error(result.error || fallback);
      }

      refreshDashboard();
      return result;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Error en la acción');
      throw error;
    } finally {
      setActionLoadingId(null);
    }
  };

  const resolveReport = async (reportId: string) => {
    await apiCall('resolve-report', reportId);
  };

  const setUserRole = async (userId: string, newRole: 'USER' | 'MODERATOR' | 'ADMIN') => {
    await apiCall('set-role', userId, { role: newRole });
  };

  if (authLoading || loading) {
    return (
      <section className="flex flex-col items-center justify-center min-h-[60vh] gap-4 py-8">
        <div className="size-16 rounded-2xl bg-orange/10 flex items-center justify-center animate-paw-bounce">
          <Shield className="size-8 text-orange" />
        </div>
        <p className="font-display text-lg font-semibold text-foreground">Cargando panel administrativo...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="py-10">
        <div className="max-w-2xl mx-auto rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-lost/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-lost" />
          </div>
          <h2 className="font-display text-2xl font-extrabold text-foreground mb-3">
            Acceso restringido
          </h2>
          <p className="text-foreground/70 mb-6">
            Debes iniciar sesión con una cuenta autorizada para acceder al panel administrativo.
          </p>
          <Link to={`/auth/login?next=${encodeURIComponent('/admin')}`}>
            <Button variant="primary">Iniciar sesión</Button>
          </Link>
        </div>
      </section>
    );
  }

  if (!isPrivileged) {
    return (
      <section className="py-10">
        <div className="max-w-2xl mx-auto rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-lost/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-lost" />
          </div>
          <h2 className="font-display text-2xl font-extrabold text-foreground mb-3">
            Sin permisos
          </h2>
          <p className="text-foreground/70 mb-6">
            No tienes permisos para acceder a esta sección. Solo moderadores y administradores pueden gestionar el panel.
          </p>
          <Link to="/">
            <Button variant="primary">Volver al inicio</Button>
          </Link>
        </div>
      </section>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Resumen', icon: <Shield className="size-5" /> },
    { id: 'metrics', label: 'Métricas', icon: <TrendingUp className="size-5" /> },
    { id: 'audit', label: 'Auditoría', icon: <History className="size-5" /> },
    { id: 'reports', label: 'Reportes', icon: <Shield className="size-5" /> },
    { id: 'verifications', label: 'Verificaciones', icon: <BadgeCheck className="size-5" /> },
    { id: 'chat-reports', label: 'Mensajes reportados', icon: <Flag className="size-5" /> },
    { id: 'duplicates', label: 'Duplicados', icon: <Copy className="size-5" /> },
    { id: 'moderation', label: 'Moderación IA', icon: <AlertTriangle className="size-5" /> },
    { id: 'pending-review', label: 'Pendientes revisión', icon: <Eye className="size-5" /> },
    { id: 'takedowns', label: 'Retiradas', icon: <Flag className="size-5" /> },
    { id: 'sources', label: 'Fuentes', icon: <ExternalLink className="size-5" /> },
    { id: 'publications', label: 'Publicaciones', icon: <UserPlus className="size-5" /> },
    { id: 'users', label: 'Usuarios', icon: <UserPlus className="size-5" /> },
  ];

  return (
    <section className="space-y-8 py-10">
      {/* Hero del Admin */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-purple/10 via-app to-orange/10 border-2 border-foreground/10 p-8 shadow-md">
        <div className="blob-decoration absolute top-5 right-5 size-32 bg-orange/20" />
        <div className="blob-decoration absolute bottom-5 left-5 size-24 bg-purple/15" style={{ animationDelay: '2s' }} />
        
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="size-6 text-purple animate-paw-bounce" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Administración</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold text-foreground">Panel administrativo</h1>
            <p className="text-lg text-foreground/70 leading-relaxed max-w-2xl">
              Resumen operativo para revisar actividad, reportes y casos resueltos.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={refreshDashboard} className="gap-2">
            <span className={loading ? 'animate-spin' : ''}>🔄</span>
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tabs de navegación */}
      <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Pestañas del panel">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-base shrink-0',
              activeTab === tab.id
                ? 'bg-ink text-white shadow-md scale-105'
                : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground hover:scale-105',
            ].join(' ')}
          >
            {tab.icon} {tab.label}
            {tab.id === 'verifications' && (counts?.pendingVerifications ?? 0) > 0 ? (
              <span className="rounded-pill bg-orange px-2 py-0.5 text-xs font-extrabold text-[var(--color-orange-900)]">
                {counts?.pendingVerifications}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {actionError && (
        <div className="rounded-2xl bg-lost/10 border-2 border-lost/20 p-4 flex items-start gap-3">
          <div className="size-10 rounded-xl bg-lost/10 flex items-center justify-center shrink-0">
            <Shield className="size-5 text-lost" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground mb-1">Error en la operación</p>
            <p className="text-sm text-foreground/70">{actionError}</p>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && counts && (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <div className="group rounded-2xl border-2 border-orange/20 bg-orange/5 p-6 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-12 rounded-xl bg-orange/10 flex items-center justify-center">
                <UserPlus className="size-6 text-orange" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">Publicaciones</p>
            </div>
            <p className="font-display text-4xl font-extrabold text-foreground">{counts.activePublications}</p>
            <p className="text-sm font-medium text-foreground/70 mt-2">Casos activos</p>
          </div>
          
          <div className="group rounded-2xl border-2 border-lost/20 bg-lost/5 p-6 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-12 rounded-xl bg-lost/10 flex items-center justify-center">
                <Shield className="size-6 text-lost" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">Reportes</p>
            </div>
            <p className="font-display text-4xl font-extrabold text-foreground">{counts.pendingReports}</p>
            <p className="text-sm font-medium text-foreground/70 mt-2">Pendientes</p>
          </div>
          
          <div className="group rounded-2xl border-2 border-found/20 bg-found/5 p-6 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-12 rounded-xl bg-found/10 flex items-center justify-center">
                <UserPlus className="size-6 text-found" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">Resueltos</p>
            </div>
            <p className="font-display text-4xl font-extrabold text-foreground">{counts.resolvedCases}</p>
            <p className="text-sm font-medium text-foreground/70 mt-2">Casos cerrados</p>
          </div>
          
          <div className="group rounded-2xl border-2 border-turquoise/20 bg-turquoise/5 p-6 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-12 rounded-xl bg-turquoise/10 flex items-center justify-center">
                <UserPlus className="size-6 text-turquoise" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">Usuarios</p>
            </div>
            <p className="font-display text-4xl font-extrabold text-foreground">{counts.totalUsers}</p>
            <p className="text-sm font-medium text-foreground/70 mt-2">Total registrados</p>
          </div>
          
          <div className="group rounded-2xl border-2 border-purple/20 bg-purple/5 p-6 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-12 rounded-xl bg-purple/10 flex items-center justify-center">
                <UserPlus className="size-6 text-purple" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">Avistamientos</p>
            </div>
            <p className="font-display text-4xl font-extrabold text-foreground">{counts.recentSightings}</p>
            <p className="text-sm font-medium text-foreground/70 mt-2">Últimos 7 días</p>
          </div>
          
          <div className="group rounded-2xl border-2 border-lost/20 bg-lost/5 p-6 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-12 rounded-xl bg-lost/10 flex items-center justify-center">
                <Flag className="size-6 text-lost" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">Retiradas pendientes</p>
            </div>
            <p className="font-display text-4xl font-extrabold text-foreground">{counts.pendingTakedowns}</p>
            <p className="text-sm font-medium text-foreground/70 mt-2">Requieren revisión</p>
          </div>

          <div className="group rounded-2xl border-2 border-found/20 bg-found/5 p-6 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-12 rounded-xl bg-found/10 flex items-center justify-center">
                <CheckCircle className="size-6 text-found" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">Retiradas aprobadas</p>
            </div>
            <p className="font-display text-4xl font-extrabold text-foreground">{counts.approvedTakedowns}</p>
            <p className="text-sm font-medium text-foreground/70 mt-2">Publicaciones eliminadas</p>
          </div>

          <div className="group rounded-2xl border-2 border-turquoise/20 bg-turquoise/5 p-6 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-12 rounded-xl bg-turquoise/10 flex items-center justify-center">
                <BadgeCheck className="size-6 text-turquoise" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">Verificaciones</p>
            </div>
            <p className="font-display text-4xl font-extrabold text-foreground">{counts.pendingVerifications}</p>
            <p className="text-sm font-medium text-foreground/70 mt-2">Pendientes de revisión</p>
          </div>

          <div className="group rounded-2xl border-2 border-border bg-secondary/50 p-6 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-12 rounded-xl bg-secondary flex items-center justify-center">
                <UserPlus className="size-6 text-orange" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">Fuentes activas</p>
            </div>
            <p className="font-display text-4xl font-extrabold text-foreground">{counts.activeSources}</p>
            <p className="text-sm font-medium text-foreground/70 mt-2">Canales monitoreados</p>
          </div>
        </div>
      )}

      {activeTab === 'verifications' && <VerificationQueue />}

      {activeTab === 'reports' && (
        <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-2xl font-extrabold text-foreground flex items-center gap-2">
              <Shield className="size-6 text-lost" />
              Reportes recientes
            </h2>
            <Button type="button" variant="ghost" onClick={refreshDashboard}>
              🔄
            </Button>
          </div>
          
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="rounded-2xl border-2 border-foreground/10 bg-surface p-5 space-y-3 transition-all hover:shadow-lg hover:-translate-y-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-display font-bold text-foreground">{report.reason}</p>
                  <span className={[
                    'rounded-pill px-4 py-2 text-xs font-bold uppercase tracking-wider',
                    report.status === 'PENDING' ? 'bg-lost/10 text-lost' : 'bg-found/10 text-found'
                  ].join(' ')}>
                    {report.status}
                  </span>
                </div>
                
                {report.publication ? (
                  <Link to={`/p/${report.publication.slug}`} className="block text-sm font-semibold text-orange hover:text-orange-dark transition-colors">
                    {report.publication.title} →
                  </Link>
                ) : (
                  <p className="text-sm text-foreground/60">ID: {report.publication_id}</p>
                )}
                
                <p className="text-xs text-foreground/50">
                  {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.created_at))}
                </p>
                
                {report.status === 'PENDING' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => resolveReport(report.id)}
                    disabled={actionLoadingId === report.id}
                    className="gap-2"
                  >
                    <Shield className="size-4" />
                    {actionLoadingId === report.id ? 'Resolviendo...' : 'Resolver reporte'}
                  </Button>
                ) : null}
              </div>
            ))}
            {reports.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-foreground/20 bg-foreground/5 p-12 text-center">
                <Shield className="size-12 text-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground/60">
                  No hay reportes recientes
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {activeTab === 'chat-reports' && <ChatReportsPanel />}

      {activeTab === 'duplicates' && (
        <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md">
          <DuplicateReview />
        </div>
      )}
      
      {activeTab === 'audit' && <AuditLogPanel />}

      {activeTab === 'metrics' && (
        <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md">
          <AdminMetrics />
        </div>
      )}
      
      {activeTab === 'pending-review' && (
        <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md">
          <PendingReviewQueue />
        </div>
      )}
      
      {activeTab === 'sources' && (
        <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md">
          <ExternalSourcesManager />
        </div>
      )}
      
      {activeTab === 'moderation' && (
        <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md">
          <ModerationQueue />
        </div>
      )}

      {activeTab === 'takedowns' && (
        <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md">
          <TakedownQueue />
        </div>
      )}

      {activeTab === 'publications' && (
        <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md space-y-6">
          <h2 className="font-display text-2xl font-extrabold text-foreground flex items-center gap-2">
            <UserPlus className="size-6 text-orange" />
            Publicaciones recientes
          </h2>
          
          <div className="space-y-4">
            {publications.map((pub) => (
              <Link 
                key={pub.id} 
                to={`/p/${pub.slug}`} 
                className="group block rounded-2xl border-2 border-foreground/10 bg-surface p-5 transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-display text-lg font-bold text-foreground group-hover:text-orange transition-colors">{pub.title}</p>
                    <p className="mt-2 text-xs text-foreground/50">
                      {new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(pub.created_at))}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="rounded-pill bg-orange/10 px-3 py-1.5 text-xs font-bold text-orange">
                      {pub.type}
                    </span>
                    <span className={[
                      'rounded-pill px-3 py-1.5 text-xs font-bold',
                      pub.status === 'ACTIVE' ? 'bg-found/10 text-found' : 'bg-foreground/10 text-foreground'
                    ].join(' ')}>
                      {pub.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            {publications.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-foreground/20 bg-foreground/5 p-12 text-center">
                <UserPlus className="size-12 text-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground/60">
                  No hay publicaciones
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md space-y-6">
          <h2 className="font-display text-2xl font-extrabold text-foreground flex items-center gap-2">
            <UserPlus className="size-6 text-turquoise" />
            Gestión de usuarios
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b-2 border-foreground/10">
                  <th className="pb-4 font-display font-extrabold text-foreground">Usuario</th>
                  <th className="pb-4 font-display font-extrabold text-foreground">Nombre</th>
                  <th className="pb-4 font-display font-extrabold text-foreground">Rol</th>
                  <th className="pb-4 font-display font-extrabold text-foreground">Registrado</th>
                  <th className="pb-4 font-display font-extrabold text-foreground">Estado</th>
                  <th className="pb-4 font-display font-extrabold text-foreground text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-foreground/5 hover:bg-app/50 transition-colors">
                    <td className="py-4 font-semibold text-foreground">@{u.username}</td>
                    <td className="py-4 text-foreground/70">{u.full_name ?? '—'}</td>
                    <td className="py-4">
                      <span className={[
                        'inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-bold uppercase tracking-wider',
                        u.role === 'ADMIN' ? 'bg-lost/10 text-lost' :
                        u.role === 'MODERATOR' ? 'bg-orange/10 text-orange' :
                        'bg-turquoise/10 text-turquoise'
                      ].join(' ')}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 text-foreground/60 text-xs">
                      {new Intl.DateTimeFormat('es-ES', { dateStyle: 'short' }).format(new Date(u.created_at))}
                    </td>
                    <td className="py-4">
                      <span className={u.deleted_at ? 'text-lost font-semibold' : 'text-found font-semibold'}>
                        {u.deleted_at ? 'Eliminado' : 'Activo'}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={u.role}
                          onChange={(e) => setUserRole(u.id, e.target.value as 'USER' | 'MODERATOR' | 'ADMIN')}
                          disabled={actionLoadingId === u.id || !isAdmin}
                          className="h-10 rounded-xl border-2 border-foreground/10 bg-surface px-3 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="USER">Usuario</option>
                          <option value="MODERATOR">Moderador</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        {actionLoadingId === u.id && (
                          <span className="size-5 animate-spin text-orange">⏳</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {users.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-foreground/20 bg-foreground/5 p-12 text-center mt-6">
                <UserPlus className="size-12 text-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground/60">
                  No hay usuarios registrados
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default AdminPage;