import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Heart, HeartHandshake, Home, MapPin, Sparkles } from 'lucide-react';
import type { PublicationSummary } from '../../lib/supabase/publication-search';
import {
  SUCCESS_STORY_LABELS,
  countSuccessStories,
  filterSuccessStories,
  getSuccessStoryKind,
  type SuccessStoryFilter,
} from '../../lib/success-stories';
import { LinkButton } from '../ui/button';
import { Logo } from '../Logo';
import { ScrollReveal } from '../ui/scroll-reveal';

type SuccessStoriesSectionProps = {
  stories: PublicationSummary[];
  loading: boolean;
};

const FILTERS: Array<{ value: SuccessStoryFilter; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'REUNITED', label: 'Reencuentros' },
  { value: 'ADOPTED', label: 'Adopciones' },
];

function formatStoryDate(story: PublicationSummary): string {
  const date = new Date(story.resolvedAt ?? story.publishedAt);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('es-CU', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function storyLocation(story: PublicationSummary): string {
  return [story.municipality, story.province].filter(Boolean).join(', ');
}

function StoryCard({ story }: { story: PublicationSummary }) {
  const kind = getSuccessStoryKind(story.type);
  const isAdopted = kind === 'ADOPTED';
  const location = storyLocation(story);

  return (
    <Link
      to={`/p/${story.slug}`}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-surface shadow-md transition-all duration-base ease-smooth hover:-translate-y-2 hover:shadow-xl ${
        isAdopted ? 'border-purple/20 hover:border-purple/40' : 'border-found/20 hover:border-found/40'
      }`}
    >
      <div className="relative aspect-4/3 overflow-hidden bg-linear-to-br from-found/10 to-orange/10">
        {story.coverImageUrl ? (
          <img
            src={story.coverImageUrl}
            alt={story.title}
            className="h-full w-full object-cover transition-transform duration-slow group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
            <Logo variant="mark" size={64} className="opacity-50" />
          </div>
        )}

        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-bold text-white shadow-md ${
            isAdopted ? 'bg-purple' : 'bg-found'
          }`}
        >
          {isAdopted ? (
            <Home className="size-3.5" aria-hidden="true" />
          ) : (
            <HeartHandshake className="size-3.5" aria-hidden="true" />
          )}
          {SUCCESS_STORY_LABELS[kind]}
        </span>

        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-pill bg-surface/90 px-3 py-1.5 text-xs font-bold text-foreground shadow-sm backdrop-blur-sm">
          <Sparkles className="size-3.5 text-orange" aria-hidden="true" />
          Final feliz
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="line-clamp-2 font-display text-xl font-extrabold leading-tight text-foreground transition-colors group-hover:text-orange">
          {story.title}
        </h3>

        <p className="line-clamp-2 text-sm leading-relaxed text-foreground/70">{story.description}</p>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-foreground/60">
          {location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {location}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {formatStoryDate(story)}
          </span>
        </div>
      </div>

      <div
        className={`h-1 origin-left scale-x-0 transition-transform duration-base group-hover:scale-x-100 ${
          isAdopted ? 'bg-linear-to-r from-purple/40 via-purple to-purple-dark' : 'bg-linear-to-r from-found/40 via-found to-found-dark'
        }`}
      />
    </Link>
  );
}

export function SuccessStoriesSection({ stories, loading }: SuccessStoriesSectionProps) {
  const [filter, setFilter] = useState<SuccessStoryFilter>('ALL');

  const counts = useMemo(() => countSuccessStories(stories), [stories]);
  const visibleStories = useMemo(
    () => filterSuccessStories(stories, filter).slice(0, 3),
    [stories, filter]
  );

  // Sin historias no se pinta una sección vacía: el home ya tiene suficiente
  // contenido y un bloque "no hay finales felices" sería contraproducente.
  if (!loading && stories.length === 0) return null;

  return (
    <ScrollReveal animation="fade-up">
      <section className="relative overflow-hidden rounded-3xl border-2 border-found/20 bg-linear-to-br from-found/10 via-app to-orange/10 p-6 shadow-md md:p-10">
        <div className="blob-decoration absolute -right-8 -top-8 size-40 bg-found/15" />
        <div className="blob-decoration absolute -bottom-10 -left-6 size-32 bg-orange/15" style={{ animationDelay: '2s' }} />

        <div className="relative space-y-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Heart className="size-5 text-found" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                  Historias reales
                </span>
              </div>
              <h2 className="font-display text-3xl font-extrabold text-foreground md:text-4xl">
                Finales felices
              </h2>
              <p className="max-w-2xl text-foreground/60">
                Reencuentros y adopciones que ya son realidad. Cada una empezó con una publicación y
                mucha gente dispuesta a ayudar.
              </p>
            </div>

            <LinkButton href="/buscar?status=RESOLVED" variant="ghost" className="hidden shrink-0 sm:flex">
              Ver todas las historias →
            </LinkButton>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar historias">
            {FILTERS.map((option) => {
              const isActive = filter === option.value;
              const count =
                option.value === 'ALL'
                  ? stories.length
                  : counts[option.value];

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setFilter(option.value)}
                  className={`inline-flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-bold transition-colors ${
                    isActive
                      ? 'bg-found text-white shadow-sm'
                      : 'border-2 border-foreground/10 bg-surface text-foreground/70 hover:border-found/30 hover:text-foreground'
                  }`}
                >
                  {option.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs ${
                      isActive ? 'bg-white/20' : 'bg-foreground/5'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-80 animate-pulse rounded-2xl border-2 border-foreground/10 bg-surface"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : visibleStories.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-foreground/15 bg-surface/70 px-6 py-10 text-center">
              <p className="font-display text-lg font-extrabold text-foreground">
                Aún no hay historias en esta categoría
              </p>
              <p className="mt-1 text-sm text-foreground/60">
                Cuando un caso se resuelva, aparecerá aquí para inspirar a más personas.
              </p>
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className="mt-4 text-sm font-bold text-found underline-offset-2 hover:underline"
              >
                Ver todos los finales felices
              </button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleStories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          )}

          <div className="text-center sm:hidden">
            <LinkButton href="/buscar?status=RESOLVED" variant="ghost">
              Ver todas las historias →
            </LinkButton>
          </div>
        </div>
      </section>
    </ScrollReveal>
  );
}
