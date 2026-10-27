import { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { Button } from '../ui/button';
import { CatLoader } from '../ui/cat-loader';
import { EmptyState } from '../ui/empty-state';

/**
 * Visor de `audit_logs` (tarea 5.3).
 *
 * Hasta ahora las acciones de moderación se registraban (ejecutadas desde
 * `/api/admin?resource=moderation` y desde el trigger de revelación de contacto) pero **no
 * había forma de consultarlas desde la interfaz**: el panel de administración no
 * mostraba nada.
 *
 * La lectura la autoriza la RLS (`moderators and admins can read audit logs`,
 * 0001:375), así que un usuario normal recibe cero filas aunque llame a la API
 * directamente. Este componente no filtra por rol: no hace falta.
 */

type AuditLog = {
  id: string;
  actor_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const PAGE_SIZE = 50;

/** Traduce el nombre técnico de la acción a algo legible. */
const ACTION_LABEL: Record<string, string> = {
  'resolve-report': 'Reporte resuelto',
  'hide-publication': 'Publicación ocultada',
  'restore-publication': 'Publicación restaurada',
  'set-role': 'Rol cambiado',
  'approve-takedown': 'Retirada aprobada',
  'reject-takedown': 'Retirada rechazada',
  TAKEDOWN_APPROVED: 'Retirada aprobada',
  TAKEDOWN_REJECTED: 'Retirada rechazada',
  TAKEDOWN_REQUESTED: 'Retirada solicitada',
  TAKEDOWN_REQUESTED_AND_HIDDEN: 'Retirada solicitada (oculta)',
  CONTACT_REVEALED: 'Contacto revelado',
};

export function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (append = false) => {
    setLoading(true);
    setError(null);

    try {
      const from = append ? logs.length : 0;
      const to = from + PAGE_SIZE - 1;

      const { data, error: queryError } = await supabase
        .from('audit_logs')
        .select('id, actor_profile_id, action, entity_type, entity_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (queryError) throw queryError;

      const rows = (data ?? []) as AuditLog[];

      setLogs((prev) => (append ? [...prev, ...rows] : rows));
      setHasMore(rows.length === PAGE_SIZE);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'No pudimos cargar los registros de auditoría.'
      );
    } finally {
      setLoading(false);
    }
  }, [logs.length]);

  useEffect(() => {
    void load(false);
    // Solo en el montaje: `load` cambia con `logs.length` y provocaría un bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && logs.length === 0) {
    return (
      <div className="flex justify-center py-10">
        <CatLoader size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold text-foreground">
            <History className="size-5" aria-hidden />
            Registro de auditoría
          </h2>
          <p className="text-sm text-foreground/60">
            Acciones sensibles de moderación y accesos a datos de contacto.
          </p>
        </div>
        <Button variant="ghost" className="gap-2 text-sm" onClick={() => void load(false)}>
          <RefreshCw className="size-4" aria-hidden />
          Actualizar
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border-2 border-lost/20 bg-lost/10 px-4 py-3 text-sm font-medium text-lost">
          {error}
        </div>
      )}

      {logs.length === 0 && !error ? (
        <EmptyState
          title="Sin registros todavía"
          description="Aquí aparecerán las acciones de moderación, los cambios de rol y las revelaciones de contacto."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-foreground/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-foreground/5 text-xs uppercase tracking-wide text-foreground/60">
              <tr>
                <th scope="col" className="px-4 py-3">Fecha</th>
                <th scope="col" className="px-4 py-3">Acción</th>
                <th scope="col" className="px-4 py-3">Entidad</th>
                <th scope="col" className="px-4 py-3">Actor</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Detalle</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isOpen = expanded === log.id;
                const hasMetadata =
                  log.metadata && Object.keys(log.metadata).length > 0;

                return (
                  <tr key={log.id} className="border-t border-foreground/10 align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-foreground/70">
                      {new Date(log.created_at).toLocaleString('es-CU')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {ACTION_LABEL[log.action] ?? log.action}
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      {log.entity_type}
                      {log.entity_id ? (
                        <span className="block font-mono text-[11px] text-foreground/40">
                          {log.entity_id.slice(0, 8)}…
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-foreground/50">
                      {log.actor_profile_id ? `${log.actor_profile_id.slice(0, 8)}…` : 'sistema'}
                    </td>
                    <td className="px-4 py-3">
                      {hasMetadata && (
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : log.id)}
                          aria-expanded={isOpen}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-orange hover:bg-orange/10"
                        >
                          <ChevronDown
                            className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            aria-hidden
                          />
                          {isOpen ? 'Ocultar' : 'Detalle'}
                        </button>
                      )}
                      {isOpen && (
                        <pre className="mt-2 max-w-md overflow-x-auto rounded-lg bg-foreground/5 p-2 text-[11px] text-foreground/70">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <Button variant="ghost" className="w-full" onClick={() => void load(true)} disabled={loading}>
          {loading ? 'Cargando…' : 'Cargar más'}
        </Button>
      )}
    </div>
  );
}

export default AuditLogPanel;
