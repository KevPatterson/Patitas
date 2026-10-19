import { Link } from 'react-router-dom';
import { MapPin, Clock, X, MessageCircle } from 'lucide-react';
import type { PublicationSummary } from '../../lib/supabase/publication-search';
import { POST_TYPE_META, POST_STATUS_META, shouldRenderStatus, isValidPostType } from '../../lib/constants/map-popup';

interface CasePopupProps {
  publication: PublicationSummary;
  onClose: () => void;
}

const POPUP_WIDTH = 320;
const IMAGE_HEIGHT = 168;
const BUTTON_HEIGHT = 44;
const BUTTON_RADIUS = 14;
const CLOSE_BTN_SIZE = 44;

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

    if (diffDays >= 1) {
      return rtf.format(-diffDays, 'day');
    }
    if (diffHours >= 1) {
      return rtf.format(-diffHours, 'hour');
    }
    if (diffMinutes >= 1) {
      return rtf.format(-diffMinutes, 'minute');
    }
    return rtf.format(-1, 'second');
  } catch {
    // Fallback si Intl no está disponible
    if (diffDays >= 1) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    if (diffHours >= 1) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffMinutes >= 1) return `Hace ${diffMinutes} min`;
    return 'Ahora mismo';
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
  const typeMeta = isValidPostType(publication.type) ? POST_TYPE_META[publication.type] : POST_TYPE_META.LOST;
  const statusMeta = shouldRenderStatus(publication.status) ? POST_STATUS_META[publication.status] : null;

  const hasImage = !!publication.coverImageUrl;
  const locationParts = [publication.zone, publication.municipality, publication.province].filter(Boolean);
  const locationText = locationParts.length > 0 ? locationParts.join(', ') : null;
  const relativeTime = formatRelativeTime(publication.publishedAt);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
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
          <div className="case-popup__image-wrapper" style={{ position: 'relative', width: '100%', height: IMAGE_HEIGHT, overflow: 'hidden' }} aria-hidden="true">
            <img
              src={publication.coverImageUrl!}
              alt={publication.title}
              loading="lazy"
              className="case-popup__image"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
              onError={handleImageError}
            />
            {/* Fallback si falla la imagen */}
            <div
              className="case-popup__image-fallback"
              style={{
                display: 'none',
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #f6dfcc, #e9b996)',
              }}
              aria-hidden="true"
            >
              <svg
                width="72"
                height="72"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(122,74,42,0.35)"
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
            <div
              className="case-popup__top-bar"
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 8,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 8,
                zIndex: 1,
              }}
            >
              <div className="case-popup__chips" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Chip de tipo */}
                <span
                  className="case-popup__type-chip"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 9999,
                    backgroundColor: typeMeta.chipBg,
                    color: typeMeta.chipText,
                    fontFamily: 'var(--font-sans, Figtree)',
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: typeMeta.stroke,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  {typeMeta.label}
                </span>

                {/* Badge de estado */}
                {statusMeta && (
                  <span
                    className="case-popup__status-badge"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      borderRadius: 9999,
                      backgroundColor: statusMeta.bg,
                      color: statusMeta.text,
                      fontFamily: 'var(--font-sans, Figtree)',
                      fontSize: 12,
                      fontWeight: 500,
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {statusMeta.label}
                  </span>
                )}
              </div>

              {/* Botón cerrar */}
              <button
                type="button"
                className="case-popup__close-btn"
                onClick={onClose}
                aria-label="Cerrar"
                style={{
                  width: CLOSE_BTN_SIZE,
                  height: CLOSE_BTN_SIZE,
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(42,20,8,0.15)',
                  transition: 'background-color 0.15s ease',
                  flexShrink: 0,
                  padding: 0,
                  lineHeight: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5ece4')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
              >
                <X size={20} strokeWidth={2.5} color="#2a1408" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ===== VARIANTE SIN IMAGEN: Cabecera compacta ===== */}
      {!hasImage && (
        <div
          className="case-popup__header-compact"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 0 20px',
            gap: 12,
          }}
        >
          <div className="case-popup__chips" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className="case-popup__type-chip"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 9999,
                backgroundColor: typeMeta.chipBg,
                color: typeMeta.chipText,
                fontFamily: 'var(--font-sans, Figtree)',
                fontSize: 13,
                fontWeight: 500,
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: typeMeta.stroke,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              {typeMeta.label}
            </span>

            {statusMeta && (
              <span
                className="case-popup__status-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 10px',
                  borderRadius: 9999,
                  backgroundColor: statusMeta.bg,
                  color: statusMeta.text,
                  fontFamily: 'var(--font-sans, Figtree)',
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {statusMeta.label}
              </span>
            )}
          </div>

          <button
            type="button"
            className="case-popup__close-btn-compact"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: CLOSE_BTN_SIZE,
              height: CLOSE_BTN_SIZE,
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '-6px -8px -6px 0',
              transition: 'background-color 0.15s ease',
              flexShrink: 0,
              padding: 0,
              lineHeight: 0,
              color: '#2a1408',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5ece4')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={20} strokeWidth={2.5} color="#2a1408" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ===== CUERPO COMÚN ===== */}
      <div
        className="case-popup__body"
        style={{
          padding: '16px 20px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Título */}
        <h2
          className="case-popup__title"
          style={{
            margin: 0,
            fontFamily: 'var(--font-display, Baloo 2)',
            fontWeight: 800,
            fontSize: 21,
            lineHeight: 1.2,
            color: '#2a1408',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {publication.title}
        </h2>

        {/* Descripción */}
        <p
          className="case-popup__description"
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans, Figtree)',
            fontSize: 15,
            lineHeight: 1.55,
            color: '#5b4636',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {publication.description}
        </p>

        {/* Meta: ubicación + fecha relativa */}
        {(locationText || relativeTime) && (
          <div
            className="case-popup__meta"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '6px 16px',
              fontFamily: 'var(--font-sans, Figtree)',
              fontSize: 13,
              color: '#7a6555',
              lineHeight: 1,
            }}
          >
            {locationText && (
              <span
                className="case-popup__meta-item"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <MapPin
                  size={16}
                  strokeWidth={2}
                  color="currentColor"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{locationText}</span>
              </span>
            )}

            {relativeTime && (
              <span
                className="case-popup__meta-item"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Clock
                  size={16}
                  strokeWidth={2}
                  color="currentColor"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                />
                <span>{relativeTime}</span>
              </span>
            )}
          </div>
        )}

        {/* Acciones */}
        <div
          className="case-popup__actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 6,
          }}
        >
          {/* Botón principal: Ver publicación */}
          <Link
            to={`/p/${publication.slug}`}
            className="case-popup__btn-primary"
            style={{
              flex: 1,
              height: BUTTON_HEIGHT,
              borderRadius: BUTTON_RADIUS,
              backgroundColor: '#ff8c42', // var(--color-orange)
              color: '#2a1408',
              fontFamily: 'var(--font-display, Baloo 2)',
              fontWeight: 600,
              fontSize: 16,
              lineHeight: 1,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease, transform 0.1s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f0721f'; // var(--color-orange-dark)
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ff8c42';
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Ver publicación
          </Link>

          {/* Botón secundario: Contactar */}
          {hasContactInfo(publication) && (
            <button
              type="button"
              className="case-popup__btn-contact"
              aria-label="Contactar"
              style={{
                width: BUTTON_HEIGHT,
                height: BUTTON_HEIGHT,
                borderRadius: BUTTON_RADIUS,
                backgroundColor: '#f5ece4',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease',
                flexShrink: 0,
                padding: 0,
                lineHeight: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e9dccf')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f5ece4')}
            >
              <MessageCircle size={20} strokeWidth={2} color="#2a1408" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}