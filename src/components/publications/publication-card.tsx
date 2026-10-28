import { Link } from 'react-router-dom';
import { PawPrint, MapPin, Calendar } from 'lucide-react';
import type { PublicationSummary } from '../../lib/supabase/publication-search';
import { StatusBadge } from '../ui/status-badge';
import { Logo } from '../Logo';
import { AGE_LABELS, SIZE_LABELS, SPECIES_LABELS } from '../../lib/constants/labels';

type PublicationCardProps = {
  publication: PublicationSummary;
  distance?: number;
};

const typeEmojis: Record<PublicationSummary['type'], string> = {
  LOST: '🔴',
  FOUND: '🟢',
  ABANDONED: '🟠',
  ADOPTION: '🟣',
  SIGHTING: '🔵',
};

export function PublicationCard({ publication, distance }: PublicationCardProps) {
  const formattedDate = new Date(publication.publishedAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <Link
      to={`/p/${publication.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border-2 border-foreground/10 bg-surface shadow-md transition-all duration-base ease-smooth hover:-translate-y-2 hover:shadow-xl hover:border-orange/30"
    >
      {/* Imagen con overlay decorativo */}
      {/* Altura responsive: la foto crece con la pantalla sin dominar la tarjeta */}
      <div className="relative h-36 overflow-hidden bg-linear-to-br from-orange/10 to-turquoise/10 sm:h-40 lg:h-44 xl:h-48">
        {publication.coverImageUrl ? (
          <img
            src={publication.coverImageUrl}
            alt={publication.title}
            className="h-full w-full object-cover transition-transform duration-slow group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
            <Logo variant="mark" size={64} className="opacity-50" />
          </div>
        )}
        
        {/* Badge de tipo en esquina superior izquierda */}
        <div className="absolute left-3 top-3 flex flex-col gap-2">
          <StatusBadge status={publication.type} />
          {distance !== undefined && distance !== Infinity && (
            <div className="rounded-full bg-turquoise/95 backdrop-blur-sm px-3 py-1.5 text-xs font-bold text-white shadow-lg border-2 border-white">
              📍 {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}
            </div>
          )}
        </div>
        
        {/* Badge de estado en esquina superior derecha */}
        <div className="absolute right-3 top-3">
          <StatusBadge status={publication.status} />
        </div>

        {/* Decoración de huella en hover */}
        <div className="absolute bottom-3 right-3 opacity-0 transition-opacity duration-base group-hover:opacity-30">
          <PawPrint className="size-8 text-white" strokeWidth={2} />
        </div>
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col space-y-3 p-5">
        {/* Título con emoji */}
        <div className="flex items-start gap-2">
          <span className="text-lg shrink-0 mt-0.5">{typeEmojis[publication.type]}</span>
          <h2 className="line-clamp-2 min-h-[3.25rem] font-display text-xl font-extrabold leading-tight text-foreground group-hover:text-orange transition-colors">
            {publication.title}
          </h2>
        </div>

        {/* Descripción */}
        <p className="line-clamp-2 min-h-[3rem] text-sm leading-relaxed text-foreground/70">
          {publication.description}
        </p>

        {/* Metadatos */}
        <div className="flex min-h-4 flex-wrap items-center gap-3 text-xs font-semibold text-foreground/60">
          {(publication.municipality || publication.province) && (
            <div className="flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              <span>
                {[publication.municipality, publication.province].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="size-3.5" aria-hidden="true" />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Detalles adicionales */}
        <div className="flex min-h-7 flex-wrap gap-2">
          {publication.species && (
            <span className="inline-flex items-center rounded-lg bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground">
              {SPECIES_LABELS[publication.species] ?? publication.species}
            </span>
          )}
          {publication.breed && (
            <span className="inline-flex items-center rounded-lg bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground">
              {publication.breed}
            </span>
          )}
          {publication.size && (
            <span className="inline-flex items-center rounded-lg bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground">
              {SIZE_LABELS[publication.size] ?? publication.size}
            </span>
          )}
          {publication.ageApprox && (
            <span className="inline-flex items-center rounded-lg bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground">
              {AGE_LABELS[publication.ageApprox] ?? publication.ageApprox}
            </span>
          )}
        </div>
      </div>

      {/* Barra inferior decorativa en hover - paleta naranja monocromática */}
      <div className="h-1 bg-linear-to-r from-orange-200 via-orange-400 to-orange-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-base origin-left" />
    </Link>
  );
}
