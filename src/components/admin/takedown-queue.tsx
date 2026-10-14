import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { CheckCircle, XCircle, Eye, Mail, Shield, Clock } from 'lucide-react';

type TakedownRequest = {
  id: string;
  publication_id: string;
  reason: 'COPYRIGHT' | 'PRIVACY' | 'INACCURATE' | 'OTHER';
  contact_email: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  publication: {
    id: string;
    slug: string;
    title: string;
    type: string;
    status: string;
    source_url: string | null;
    is_imported: boolean;
  } | null;
};

const REASON_LABELS: Record<TakedownRequest['reason'], string> = {
  COPYRIGHT: 'Derechos de autor',
  PRIVACY: 'Privacidad',
  INACCURATE: 'Información incorrecta',
  OTHER: 'Otro',
};

const REASON_COLORS: Record<TakedownRequest['reason'], string> = {
  COPYRIGHT: 'bg-purple/10 text-purple-700',
  PRIVACY: 'bg-blue/10 text-blue-700',
  INACCURATE: 'bg-yellow/10 text-yellow-700',
  OTHER: 'bg-navy/10 text-navy-700',
};

const STATUS_CONFIG: Record<TakedownRequest['status'], { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow/10 text-yellow-700', icon: <Clock className="size-3.5" /> },
  APPROVED: { label: 'Aprobada', color: 'bg-red/10 text-red-700', icon: <CheckCircle className="size-3.5" /> },
  REJECTED: { label: 'Rechazada', color: 'bg-green/10 text-green-700', icon: <XCircle className="size-3.5" /> },
  EXPIRED: { label: 'Expirada', color: 'bg-navy/10 text-navy-700', icon: <Clock className="size-3.5" /> },
};

export function TakedownQueue() {
  const [requests, setRequests] = useState<TakedownRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('takedown_requests')
        .select(`
          *,
          publication:publications!takedown_requests_publication_id_fkey (
            id, slug, title, type, status, source_url, is_imported
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRequests((data ?? []) as TakedownRequest[]);
    } catch (error) {
      console.error('Error loading takedown queue:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleReview = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setActionLoadingId(requestId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error('No hay sesión activa');

      const action = decision === 'APPROVED' ? 'approve-takedown' : 'reject-takedown';
      const response = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, id: requestId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error en la acción');
      }

      loadQueue();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error en la acción');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleViewPublication = (slug: string) => {
    window.open(`/p/${slug}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div className="size-12 rounded-2xl bg-orange/10 flex items-center justify-center animate-paw-bounce">
          <Shield className="size-6 text-orange" />
        </div>
        <p className="font-display text-lg font-semibold text-navy">Cargando solicitudes de retirada...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<Shield className="size-12 text-navy/30" />}
        title="Sin solicitudes de retirada"
        description="No hay solicitudes pendientes de revisión."
        action={<Button variant="ghost" onClick={loadQueue}>Actualizar</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-bold text-navy flex items-center gap-2">
          <Shield className="size-6 text-orange" />
          Solicitudes de retirada ({requests.filter(r => r.status === 'PENDING').length} pendientes)
        </h3>
        <Button variant="ghost" size="sm" onClick={loadQueue}>
          <span className="size-4 animate-spin">🔄</span>
          Actualizar
        </Button>
      </div>

      <div className="rounded-2xl border-2 border-navy/10 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-navy/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy/60">Publicación</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy/60">Motivo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy/60">Solicitante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy/60">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy/60">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-navy/60">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {requests.map((request) => {
                const statusConfig = STATUS_CONFIG[request.status];
                const pub = request.publication;
                return (
                  <tr key={request.id} className="hover:bg-navy/5 transition-colors">
                    <td className="px-4 py-3">
                      {pub ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-navy truncate max-w-xs">{pub.title}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              pub.type === 'LOST' ? 'bg-lost/10 text-lost' :
                              pub.type === 'FOUND' ? 'bg-found/10 text-found' :
                              pub.type === 'ADOPTION' ? 'bg-adoption/10 text-adoption' :
                              'bg-navy/10 text-navy'
                            }`}>
                              {pub.type}
                            </span>
                            {pub.is_imported && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple/10 text-purple-700 flex items-center gap-1">
                                <Shield className="size-3" /> Importada
                              </span>
                            )}
                          </div>
                          {pub.source_url && (
                            <a href={pub.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                              <Eye className="size-3" /> Ver fuente
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-navy/40 italic">Publicación eliminada</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${REASON_COLORS[request.reason]}`}>
                        {REASON_LABELS[request.reason]}
                      </span>
                      {request.review_notes && (
                        <p className="text-xs text-navy/50 mt-1 line-clamp-1">{request.review_notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-navy/70">
                        {request.contact_email ? (
                          <a href={`mailto:${request.contact_email}`} className="flex items-center gap-1 hover:underline">
                            <Mail className="size-3.5" />
                            {request.contact_email}
                          </a>
                        ) : (
                          <span className="text-navy/40 italic">Anónimo</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-navy/70 whitespace-nowrap">
                      {new Date(request.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {pub && (
                          <Button variant="ghost" size="sm" onClick={() => handleViewPublication(pub.slug)}>
                            <Eye className="size-3.5" />
                          </Button>
                        )}
                        {request.status === 'PENDING' && (
                          <>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleReview(request.id, 'APPROVED')}
                              loading={actionLoadingId === request.id}
                              className="gap-1"
                            >
                              <CheckCircle className="size-3.5" />
                              Aprobar
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleReview(request.id, 'REJECTED')}
                              loading={actionLoadingId === request.id}
                              className="gap-1"
                            >
                              <XCircle className="size-3.5" />
                              Rechazar
                            </Button>
                          </>
                        )}
                        {request.status !== 'PENDING' && (
                          <span className="text-xs text-navy/50">
                            {request.reviewed_at ? (
                              `Revisado: ${new Date(request.reviewed_at).toLocaleDateString('es-ES')}`
                            ) : (
                              'Completada'
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TakedownQueue;