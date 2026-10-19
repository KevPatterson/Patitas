import { Link } from 'react-router-dom';
import { MapPin, Clock, X, MessageCircle } from 'lucide-react';
import { useMap } from 'react-leaflet';
import type { PublicationSummary } from '../../lib/supabase/publication-search';
import { POST_TYPE_META, POST_STATUS_META, shouldRenderStatus, isValidPostType } from '../../lib/constants/map-popup';
import './CasePopup.css';

interface CasePopupProps {
  publication: PublicationSummary;
  onClose?: () => void;
}

const POPUP_WIDTH = 320;

/**
 * Formato de fecha relativa en español usando Intl.RelativeTimeFormat.
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  try {
    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    if (diffDays > 0) return rtf.format(-diffDays, 'day');
    if (diffHours > 0) return rtf.format(-diffHours, 'hour');
    if (diffMinutes > 0) return rtf.format(-diffMinutes, 'minute');
    return 'Justo ahora';
  } catch {
    if (diffDays > 0) return `hace ${diffDays}d`;
    if (diffHours > 0) return `hace ${diffHours}h`;
    if (diffMinutes > 0) return `hace ${diffMinutes}m`;
    return 'Justo ahora';
  }
}

/**
 * Determina si la publicación tiene datos de contacto para mostrar el botón de contactar.
 */
function hasContactInfo(_pub: PublicationSummary): boolean {
  // En el modelo actual no hay contact_mode/contact_phone, etc. en PublicationSummary
  // Se omite el botón si no hay datos. Si en el futuro se añaden, actualizar aquí.
  return false;
}

export function CasePopup({ publication, onClose }: CasePopupProps) {
  const map = useMap();

  const closePopup = () => {
    onClose?.();
    map.closePopup();
  };

  const typeMeta = isValidPostType(publication.type) ? POST_TYPE_META[publication.type] : POST_TYPE_META.LOST;
  const statusMeta = shouldRenderStatus(publication.status) ? POST_STATUS_META[publication.status] : null;

  const hasImage = !!publication.coverImageUrl;
  const locationParts = [publication.zone, publication.municipality, publication.province].filter(Boolean);
  const locationText = locationParts.length > 0 ? locationParts.join(', ') : null;
  const relativeTime = formatRelativeTime(publication.publishedAt);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closePopup();
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    target.style.display = 'none';
    const fallback = target.nextElementSibling as HTMLElement;
    if (fallback) fallback.style.display = 'flex';
  };

  return (
    <div
      className="case-popup"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${typeMeta.label.toLowerCase()}: ${publication.title}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        width: hasImage ? POPUP_WIDTH : `min(${POPUP_WIDTH}px, calc(100vw - 32px))`,
        maxWidth: POPUP_WIDTH,
      } as React.CSSProperties}
    >
      {/* ===== VARIANTE CON IMAGEN ===== */}
      {hasImage && (
        <>
          <div className="case-popup__image-wrapper" aria-hidden="true">
            <img
              src={publication.coverImageUrl!}
              alt={publication.title}
              loading="lazy"
              className="case-popup__image"
              onError={handleImageError}
            />
            {/* Fallback si falla la imagen */}
            <div className="case-popup__image-fallback" aria-hidden="true">
              <svg
                width="72"
                height="72"
                viewBox="0 0 24 24"
                fill="none"
                stroke="hsl(var(--muted-foreground) / 0.35)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="4" r="2" />
                <circle cx="18" cy="8" r="2" />
                <circle cx="20" cy="16" r="2" />
                <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
              </svg>
            </div>

            {/* Overlay superior: chip de tipo + badge de estado (izq) + botón cerrar (der) */}
            <div className="case-popup__top-bar">
              <div className="case-popup__chips">
                {/* Chip de tipo */}
                <span className="case-popup__type-chip" style={{ backgroundColor: typeMeta.chipBg, color: typeMeta.chipText }}>
                  <span
                    className="case-popup__type-dot"
                    style={{ backgroundColor: typeMeta.stroke }}
                    aria-hidden="true"
                  />
                  {typeMeta.label}
                </span>

                {/* Badge de estado */}
                {statusMeta && (
                  <span
                    className="case-popup__status-badge"
                    style={{ backgroundColor: statusMeta.bg, color: statusMeta.text }}
                  >
                    {statusMeta.label}
                  </span>
                )}
              </div>

              {/* Botón cerrar - más pequeño (32px) */}
              <button
                type="button"
                className="case-popup__close-btn"
                onClick={closePopup}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2.5} color="hsl(var(--foreground))" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ===== VARIANTE SIN IMAGEN: Cabecera compacta ===== */}
      {!hasImage && (
        <div className="case-popup__header-compact">
          <div className="case-popup__chips">
            <span className="case-popup__type-chip" style={{ backgroundColor: typeMeta.chipBg, color: typeMeta.chipText }}>
              <span
                className="case-popup__type-dot"
                style={{ backgroundColor: typeMeta.stroke }}
                aria-hidden="true"
              />
              {typeMeta.label}
            </span>

            {statusMeta && (
              <span
                className="case-popup__status-badge"
                style={{ backgroundColor: statusMeta.bg, color: statusMeta.text }}
              >
                {statusMeta.label}
              </span>
            )}
          </div>

          <button
            type="button"
            className="case-popup__close-btn-compact"
            onClick={closePopup}
            aria-label="Cerrar"
          >
            <X size={18} strokeWidth={2.5} color="hsl(var(--foreground))" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ===== CUERPO COMÚN ===== */}
      <div className="case-popup__body">
        {/* Título */}
        <h2 className="case-popup__title">
          {publication.title}
        </h2>

        {/* Descripción */}
        <p className="case-popup__description">
          {publication.description}
        </p>

        {/* Meta: ubicación + fecha relativa */}
        {(locationText || relativeTime) && (
          <div className="case-popup__meta">
            {locationText && (
              <span className="case-popup__meta-item">
                <MapPin
                  size={16}
                  strokeWidth={2}
                  color="currentColor"
                  aria-hidden="true"
                  className="case-popup__meta-icon"
                />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, display: 'block' }}>{locationText}</span>
              </span>
            )}

            {relativeTime && (
              <span className="case-popup__meta-item">
                <Clock
                  size={16}
                  strokeWidth={2}
                  color="currentColor"
                  aria-hidden="true"
                  className="case-popup__meta-icon"
                />
                <span>{relativeTime}</span>
              </span>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="case-popup__actions">
          {/* Botón principal: Ver publicación */}
          <Link
            to={`/p/${publication.slug}`}
            className="case-popup__btn-primary"
          >
            Ver publicación
          </Link>

          {/* Botón secundario: Contactar */}
          {hasContactInfo(publication) && (
            <button
              type="button"
              className="case-popup__btn-contact"
              aria-label="Contactar"
            >
              <MessageCircle size={20} strokeWidth={2} color="hsl(var(--primary-foreground))" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CasePopup;