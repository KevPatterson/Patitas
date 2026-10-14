import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Clock, CheckCircle, XCircle, Copy, Shield, Eye, AlertTriangle, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
// No Card component available, using styled div instead

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  iconBg: string;
}

function MetricCard({ title, value, change, changeLabel, icon, iconBg }: MetricCardProps) {
  const hasChange = change !== undefined && change !== 0;
  const isPositive = change !== undefined && change > 0;

  return (
    <div className="rounded-2xl border-2 border-navy/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-navy/60">{title}</p>
          <p className="font-display text-3xl font-bold text-navy mt-1">{value}</p>
          {hasChange && (
            <div className="flex items-center gap-1 mt-2">
              {isPositive ? (
                <TrendingUp className="size-4 text-green-600" />
              ) : change !== undefined && change < 0 ? (
                <TrendingDown className="size-4 text-red-600" />
              ) : (
                <Minus className="size-4 text-navy/50" />
              )}
              <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : change !== undefined && change < 0 ? 'text-red-600' : 'text-navy/50'}`}>
                {change !== undefined ? `${change > 0 ? '+' : ''}${change}%` : '0%'}
              </span>
              {changeLabel && <span className="text-xs text-navy/50">{changeLabel}</span>}
            </div>
          )}
        </div>
        <div className={`rounded-xl p-3 ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function AdminMetrics() {
  const [metrics, setMetrics] = useState<{
    importedToday: number;
    importedWeek: number;
    importedMonth: number;
    approvalRate: number;
    avgConfidence: number;
    duplicatesDetected: number;
    takedownsPending: number;
    takedownsApproved: number;
    takedownsRejected: number;
    activeSources: number;
    inactiveSources: number;
    trustedSources: number;
  }>({
    importedToday: 0,
    importedWeek: 0,
    importedMonth: 0,
    approvalRate: 0,
    avgConfidence: 0,
    duplicatesDetected: 0,
    takedownsPending: 0,
    takedownsApproved: 0,
    takedownsRejected: 0,
    activeSources: 0,
    inactiveSources: 0,
    trustedSources: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        { count: importedToday },
        { count: importedWeek },
        { count: importedMonth },
        { data: approvalData },
        { data: confidenceData },
        { count: duplicatesDetected },
        { count: takedownsPending },
        { count: takedownsApproved },
        { count: takedownsRejected },
        { count: activeSources },
        { count: inactiveSources },
        { count: trustedSources },
      ] = await Promise.all([
        supabase.from('external_posts').select('*', { count: 'exact', head: true }).eq('status', 'PUBLISHED').gte('created_at', todayStart),
        supabase.from('external_posts').select('*', { count: 'exact', head: true }).eq('status', 'PUBLISHED').gte('created_at', weekStart),
        supabase.from('external_posts').select('*', { count: 'exact', head: true }).eq('status', 'PUBLISHED').gte('created_at', monthStart),
        supabase.from('external_posts').select('status').in('status', ['PUBLISHED', 'REJECTED']),
        supabase.from('external_posts').select('confidence').eq('status', 'PUBLISHED'),
        supabase.from('duplicate_detections').select('*', { count: 'exact', head: true }),
        supabase.from('takedown_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('takedown_requests').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED'),
        supabase.from('takedown_requests').select('*', { count: 'exact', head: true }).eq('status', 'REJECTED'),
        supabase.from('external_sources').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('external_sources').select('*', { count: 'exact', head: true }).eq('is_active', false),
        supabase.from('external_sources').select('*', { count: 'exact', head: true }).eq('is_trusted', true),
      ]);

      const totalReviewed = (approvalData?.length ?? 0);
      const approved = approvalData?.filter(p => p.status === 'PUBLISHED').length ?? 0;
      const approvalRate = totalReviewed > 0 ? Math.round((approved / totalReviewed) * 100) : 0;

      const avgConfidence = confidenceData && confidenceData.length > 0
        ? Math.round((confidenceData.reduce((sum, p) => sum + (p.confidence ?? 0), 0) / confidenceData.length) * 100)
        : 0;

      setMetrics({
        importedToday: importedToday ?? 0,
        importedWeek: importedWeek ?? 0,
        importedMonth: importedMonth ?? 0,
        approvalRate,
        avgConfidence,
        duplicatesDetected: duplicatesDetected ?? 0,
        takedownsPending: takedownsPending ?? 0,
        takedownsApproved: takedownsApproved ?? 0,
        takedownsRejected: takedownsRejected ?? 0,
        activeSources: activeSources ?? 0,
        inactiveSources: inactiveSources ?? 0,
        trustedSources: trustedSources ?? 0,
      });
    } catch (error) {
      console.error('Error loading admin metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  const metricCards = useMemo(() => [
    {
      title: 'Importados hoy',
      value: metrics.importedToday,
      icon: <CheckCircle className="size-6 text-green-600" />,
      iconBg: 'bg-green/10',
    },
    {
      title: 'Importados esta semana',
      value: metrics.importedWeek,
      icon: <TrendingUp className="size-6 text-orange-600" />,
      iconBg: 'bg-orange/10',
    },
    {
      title: 'Importados este mes',
      value: metrics.importedMonth,
      icon: <Eye className="size-6 text-blue-600" />,
      iconBg: 'bg-blue/10',
    },
    {
      title: 'Tasa de aprobación',
      value: `${metrics.approvalRate}%`,
      icon: <CheckCircle className="size-6 text-found" />,
      iconBg: 'bg-found/10',
    },
    {
      title: 'Confidence promedio',
      value: `${metrics.avgConfidence}%`,
      icon: <Star className="size-6 text-yellow-600" />,
      iconBg: 'bg-yellow/10',
    },
    {
      title: 'Duplicados detectados',
      value: metrics.duplicatesDetected,
      icon: <Copy className="size-6 text-purple-600" />,
      iconBg: 'bg-purple/10',
    },
    {
      title: 'Retiradas pendientes',
      value: metrics.takedownsPending,
      icon: <Clock className="size-6 text-orange-600" />,
      iconBg: 'bg-orange/10',
    },
    {
      title: 'Retiradas aprobadas',
      value: metrics.takedownsApproved,
      icon: <Shield className="size-6 text-red-600" />,
      iconBg: 'bg-red/10',
    },
    {
      title: 'Retiradas rechazadas',
      value: metrics.takedownsRejected,
      icon: <XCircle className="size-6 text-green-600" />,
      iconBg: 'bg-green/10',
    },
    {
      title: 'Fuentes activas',
      value: metrics.activeSources,
      icon: <Shield className="size-6 text-green-600" />,
      iconBg: 'bg-green/10',
    },
    {
      title: 'Fuentes inactivas',
      value: metrics.inactiveSources,
      icon: <AlertTriangle className="size-6 text-yellow-600" />,
      iconBg: 'bg-yellow/10',
    },
    {
      title: 'Fuentes confiables',
      value: metrics.trustedSources,
      icon: <Star className="size-6 text-purple-600" />,
      iconBg: 'bg-purple/10',
    },
  ], [metrics]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="rounded-2xl border-2 border-navy/10 bg-white p-5 animate-pulse shadow-sm">
            <div className="h-4 bg-navy/10 rounded w-3/4 mb-2" />
            <div className="h-8 bg-navy/10 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-bold text-navy">Métricas del sistema</h2>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metricCards.map((card, idx) => (
          <MetricCard key={idx} {...card} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-navy/10 bg-white p-5 shadow-sm border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-3 bg-yellow/10">
              <Clock className="size-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-navy/60">Retiradas pendientes</p>
              <p className="font-display text-2xl font-bold text-navy">{metrics.takedownsPending}</p>
              <p className="text-xs text-navy/50">Requieren revisión de moderador</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-navy/10 bg-white p-5 shadow-sm border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-3 bg-red/10">
              <CheckCircle className="size-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-navy/60">Retiradas aprobadas</p>
              <p className="font-display text-2xl font-bold text-navy">{metrics.takedownsApproved}</p>
              <p className="text-xs text-navy/50">Publicaciones eliminadas permanentemente</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-navy/10 bg-white p-5 shadow-sm border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-3 bg-green/10">
              <XCircle className="size-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-navy/60">Retiradas rechazadas</p>
              <p className="font-display text-2xl font-bold text-navy">{metrics.takedownsRejected}</p>
              <p className="text-xs text-navy/50">Publicaciones restauradas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-navy/10 bg-white p-5 shadow-sm border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-3 bg-green/10">
              <Shield className="size-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-navy/60">Fuentes activas</p>
              <p className="font-display text-2xl font-bold text-navy">{metrics.activeSources}</p>
              <p className="text-xs text-navy/50">Monitoreando contenido nuevo</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-navy/10 bg-white p-5 shadow-sm border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-3 bg-yellow/10">
              <AlertTriangle className="size-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-navy/60">Fuentes inactivas</p>
              <p className="font-display text-2xl font-bold text-navy">{metrics.inactiveSources}</p>
              <p className="text-xs text-navy/50">Pausadas o con errores</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-navy/10 bg-white p-5 shadow-sm border-l-4 border-purple-500">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-3 bg-purple/10">
              <Star className="size-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-navy/60">Fuentes confiables</p>
              <p className="font-display text-2xl font-bold text-navy">{metrics.trustedSources}</p>
              <p className="text-xs text-navy/50">Habilitadas para auto-publicación</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminMetrics;