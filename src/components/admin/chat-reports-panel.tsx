import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Flag, Shield, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/button';
import { CatLoader } from '../ui/cat-loader';
import {
  chatErrorMessage,
  getMessageReports,
  getReportedContext,
  resolveMessageReport,
  type MessageReportSummary,
  type ModerationContextMessage,
} from '../../lib/supabase/chat';
import { CHAT_REPORT_REASONS } from '../../lib/constants/chat-copy';
import { formatChatTime } from '../../lib/utils/chat-format';

const reasonLabels: Record<string, string> = Object.fromEntries(
  CHAT_REPORT_REASONS.map((reason) => [reason.value, reason.label])
);

type ReportFilter = 'PENDING' | 'ALL';

/**
 * Bandeja de reportes de mensajes.
 *
 * No carga hilos completos: solo reportes. El contenido se pide a
 * `moderation_reported_context`, que devuelve ±20 mensajes alrededor del
 * reportado y deja la lectura en `audit_logs`. Así moderación no puede hojear
 * conversaciones ajenas por su cuenta.
 */
export function ChatReportsPanel() {
  const [reports, setReports] = useState<MessageReportSummary[]>([]);
  const [filter, setFilter] = useState<ReportFilter>('PENDING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [contexts, setContexts] = useState<Record<string, ModerationContextMessage[]>>({});
  const [contextLoadingId, setContextLoadingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getMessageReports();
      setReports(data);
    } catch (loadError) {
      setError(chatErrorMessage(loadError, 'No pudimos cargar los reportes de mensajes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const toggleContext = async (reportId: string) => {
    if (openReportId === reportId) {
      setOpenReportId(null);
      return;
    }

    setOpenReportId(reportId);
    setError(null);

    if (contexts[reportId]) {
      return;
    }

    setContextLoadingId(reportId);

    try {
      const messages = await getReportedContext(reportId);
      setContexts((previous) => ({ ...previous, [reportId]: messages }));
    } catch (contextError) {
      setError(chatErrorMessage(contextError, 'No pudimos cargar el contexto del reporte.'));
    } finally {
      setContextLoadingId(null);
    }
  };

  const handleResolve = async (reportId: string) => {
    setResolvingId(reportId);
    setError(null);

    try {
      await resolveMessageReport(reportId);
      setReports((previous) =>
        previous.map((report) =>
          report.id === reportId
            ? { ...report, status: 'RESOLVED', resolved_at: new Date().toISOString() }
            : report
        )
      );
    } catch (resolveError) {
      setError(chatErrorMessage(resolveError, 'No pudimos cerrar el reporte.'));
    } finally {
      setResolvingId(null);
    }
  };

  const visibleReports =
    filter === 'PENDING' ? reports.filter((report) => report.status === 'PENDING') : reports;

  return (
    <div className="space-y-6 rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold text-foreground">
            <Flag className="size-6 text-lost" aria-hidden="true" />
            Mensajes reportados
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            Cada apertura de contexto queda registrada en auditoría. Solo se muestra el entorno
            del mensaje reportado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('PENDING')}
            className={[
              'rounded-xl px-4 py-2 text-sm font-bold transition-colors',
              filter === 'PENDING'
                ? 'bg-ink text-white'
                : 'border-2 border-foreground/10 bg-surface text-foreground/70 hover:bg-foreground/5',
            ].join(' ')}
          >
            Pendientes
          </button>
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={[
              'rounded-xl px-4 py-2 text-sm font-bold transition-colors',
              filter === 'ALL'
                ? 'bg-ink text-white'
                : 'border-2 border-foreground/10 bg-surface text-foreground/70 hover:bg-foreground/5',
            ].join(' ')}
          >
            Todos
          </button>
          <Button type="button" variant="ghost" onClick={() => void loadReports()}>
            Actualizar
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-lost/20 bg-lost/10 px-4 py-3 text-sm font-medium text-lost-dark">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <CatLoader size="lg" />
          <p className="text-sm font-semibold text-foreground/70">Cargando reportes...</p>
        </div>
      ) : visibleReports.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-foreground/20 bg-foreground/5 p-12 text-center">
          <Shield className="mx-auto mb-3 size-12 text-foreground/30" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground/60">
            {filter === 'PENDING'
              ? 'No hay reportes de mensajes pendientes.'
              : 'Todavía no hay reportes de mensajes.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleReports.map((report) => {
            const context = contexts[report.id];
            const isOpen = openReportId === report.id;

            return (
              <article
                key={report.id}
                className="space-y-3 rounded-2xl border-2 border-foreground/10 bg-surface p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display font-bold text-foreground">
                      {reasonLabels[report.reason] ?? report.reason}
                    </p>
                    <p className="text-xs font-medium text-foreground/50">
                      Reportado por @{report.reporter_username ?? 'usuario'} ·{' '}
                      {formatChatTime(report.created_at)}
                    </p>
                  </div>
                  <span
                    className={[
                      'rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider',
                      report.status === 'PENDING'
                        ? 'bg-lost/10 text-lost'
                        : report.status === 'RESOLVED'
                          ? 'bg-found/10 text-found'
                          : 'bg-orange/10 text-orange-700',
                    ].join(' ')}
                  >
                    {report.status}
                  </span>
                </div>

                {report.details ? (
                  <p className="rounded-2xl bg-app/40 px-4 py-3 text-sm text-foreground/70">
                    {report.details}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void toggleContext(report.id)}
                    className="gap-1.5"
                  >
                    {isOpen ? (
                      <ChevronUp className="size-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="size-4" aria-hidden="true" />
                    )}
                    {isOpen ? 'Ocultar contexto' : 'Ver contexto'}
                  </Button>

                  {report.status === 'PENDING' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleResolve(report.id)}
                      loading={resolvingId === report.id}
                      className="gap-1.5"
                    >
                      <CheckCircle className="size-4" aria-hidden="true" />
                      Marcar resuelto
                    </Button>
                  ) : null}
                </div>

                {isOpen ? (
                  <div className="space-y-2 rounded-2xl border-2 border-foreground/10 bg-app/40 p-4">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
                      <ShieldAlert className="size-3.5" aria-hidden="true" />
                      Contexto limitado a ±20 mensajes · lectura auditada
                    </p>

                    {contextLoadingId === report.id ? (
                      <p className="py-4 text-center text-sm text-foreground/60">Cargando contexto...</p>
                    ) : context && context.length > 0 ? (
                      <div className="space-y-2">
                        {context.map((message) => (
                          <div
                            key={message.message_id}
                            className={[
                              'rounded-xl border px-3 py-2',
                              message.is_reported
                                ? 'border-lost/40 bg-lost/10'
                                : 'border-foreground/10 bg-surface',
                            ].join(' ')}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-bold text-foreground/60">
                                @{message.sender_username}
                                {message.is_reported ? ' · mensaje reportado' : ''}
                              </p>
                              <time className="text-[10px] text-foreground/40">
                                {formatChatTime(message.created_at)}
                              </time>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/80">
                              {message.body}
                            </p>
                            {message.has_phone || message.has_external_link ? (
                              <p className="mt-1 text-[10px] font-medium text-orange-800">
                                {message.has_phone && message.has_external_link
                                  ? 'Incluye teléfono y enlace'
                                  : message.has_phone
                                    ? 'Incluye teléfono'
                                    : 'Incluye enlace'}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-4 text-center text-sm text-foreground/60">
                        No se encontraron mensajes en el contexto.
                      </p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
