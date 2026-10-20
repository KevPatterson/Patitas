import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, CheckCircle, MapPin, PawPrint, X, Heart, Flag, Pencil, Trash2, Shield, XCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { TextareaField } from '../components/ui/textarea-field';
import { StatusBadge } from '../components/ui/status-badge';
import { PawLoader } from '../components/ui/paw-loader';
import { ProcessingStatusBadge } from '../components/ai/processing-status';
import { DuplicateWarning } from '../components/ai/duplicate-warning';
import { MatchesPanel } from '../components/publications/matches-panel';
import { ProcessButton } from '../components/ai/process-button';
import { isFeatureEnabled } from '../lib/config/feature-flags';
import { createReport } from '../lib/supabase/reports';
import { useAuth } from '../app/auth-context';
import { getPublicationBySlug, searchPublications } from '../lib/supabase/publication-search';
import { setPageMeta } from '../lib/seo/page-meta';
import { ShareMenu } from '../components/publications/share-menu';
import { ResolvedCelebration } from '../components/publications/resolved-celebration';
import { SightingForm } from '../components/publications/sighting-form';
import { SightingsTimeline } from '../components/publications/sightings-timeline';
import { CommentsSection } from '../components/publications/comments-section';
import { resolvePublication, getSightings, deletePublication } from '../lib/supabase/publication-actions';
import { findMatches } from '../lib/matching/match-calculator';
import { createAdoptionRequest } from '../lib/supabase/adoption-requests';
import { generateLostPetStructuredData, injectStructuredData, removeStructuredData } from '../lib/seo/structured-data';
import { SPECIES_LABELS, SEX_LABELS, SIZE_LABELS, AGE_LABELS } from '../lib/constants/labels';

// Helper para normalizar location que puede venir como objeto o array
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeLocation(location: any) {
  if (!location) return null;
  return Array.isArray(location) ? location[0] : location;
}

export function PublicationPage() {
  const { user } = useAuth();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [publication, setPublication] = useState<Awaited<ReturnType<typeof getPublicationBySlug>> | null>(null);
  const [sightings, setSightings] = useState<Awaited<ReturnType<typeof getSightings>>>([]);
  const [matches, setMatches] = useState<Array<{ publicationId: string; score: number; reasons: string[]; publication: { slug: string; title: string; coverImageUrl: string | null } }>>([]);
  const [loading, setLoading] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState<'FALSE_INFO' | 'SPAM' | 'SCAM' | 'DUPLICATE' | 'REUNITED' | 'INAPPROPRIATE' | 'OTHER'>('FALSE_INFO');
  const [reportDescription, setReportDescription] = useState('');
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [showAdoptForm, setShowAdoptForm] = useState(false);
  const [adoptMessage, setAdoptMessage] = useState('');
  const [adoptLoading, setAdoptLoading] = useState(false);
  const [adoptError, setAdoptError] = useState<string | null>(null);
  const [adoptSuccess, setAdoptSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showTakedownModal, setShowTakedownModal] = useState(false);
  const [takedownReason, setTakedownReason] = useState<'COPYRIGHT' | 'PRIVACY' | 'INACCURATE' | 'OTHER'>('INACCURATE');
  const [takedownEmail, setTakedownEmail] = useState('');
  const [takedownDetails, setTakedownDetails] = useState('');
  const [takedownLoading, setTakedownLoading] = useState(false);
  const [takedownMessage, setTakedownMessage] = useState<string | null>(null);
  const loadSightings = async () => {
    if (!publication) return;
    const data = await getSightings(publication.id);
    setSightings(data);
  };

  useEffect(() => {
    let active = true;

    async function load() {
      if (!slug) return;

      const data = await getPublicationBySlug(slug);

      if (active) {
        setPublication(data);
        setLoading(false);
      }

      if (data) {
        // Normalizar location: puede ser objeto o array
        const loc = normalizeLocation(data.location);
        
        // Cargar avistamientos
        const sightingsData = await getSightings(data.id);
        if (active) {
          setSightings(sightingsData);
        }

        // Calcular coincidencias solo para publicaciones LOST o FOUND
        if (data.type === 'LOST' || data.type === 'FOUND') {
          const oppositeType = data.type === 'LOST' ? 'FOUND' : 'LOST';
          const candidates = await searchPublications({ type: oppositeType, status: 'ACTIVE' });

          const targetPub = {
            id: data.id,
            species: data.species,
            color: data.color,
            size: data.size,
            sex: data.sex,
            province: loc?.province ?? '',
            municipality: loc?.municipality ?? '',
            event_date: data.event_date,
          };

          const candidatePubs = candidates.map((c: {
            id: string;
            species: string;
            color: string | null;
            size: string | null;
            sex: string | null;
            province: string | null;
            municipality: string | null;
          }) => ({
            id: c.id,
            species: c.species,
            color: c.color,
            size: c.size,
            sex: c.sex,
            province: c.province ?? '',
            municipality: c.municipality ?? '',
            event_date: null as string | null,
          }));

          const matchResults = findMatches(targetPub, candidatePubs);

          const enrichedMatches = matchResults.slice(0, 3).map((match) => {
            const candidate = candidates.find((c: { id: string }) => c.id === match.publicationId)!;
            return {
              ...match,
              publication: {
                slug: candidate.slug,
                title: candidate.title,
                coverImageUrl: candidate.coverImageUrl,
              },
            };
          });

          if (active) {
            setMatches(enrichedMatches);
          }
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [slug]);

  const coverImage = useMemo(() => publication?.publication_images?.find((image) => image.is_cover) ?? publication?.publication_images?.[0] ?? null, [publication]);
  const coverImagePath = coverImage?.storage_path ?? null;

  useEffect(() => {
    if (!publication) return;

    const image = coverImagePath
      ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/pet-images/${coverImagePath}`
      : undefined;

    setPageMeta({
      title: `${publication.title} · Patitas`,
      description: publication.description.slice(0, 155),
      canonicalPath: `/p/${publication.slug}`,
      image,
      // Solo se indexa lo público y vigente: una publicación resuelta, oculta o
      // eliminada no debe posicionarse en buscadores (tarea 6.2).
      noindex: publication.status !== 'ACTIVE',
    });

    // Agregar structured data para publicaciones perdidas/encontradas
    if ((publication.type === 'LOST' || publication.type === 'FOUND') && image) {
      const loc = normalizeLocation(publication.location);
      const structuredData = generateLostPetStructuredData({
        name: publication.title,
        description: publication.description,
        image,
        species: publication.species,
        location: {
          municipality: loc?.municipality ?? '',
          province: loc?.province ?? '',
        },
        datePosted: publication.published_at,
        url: `${window.location.origin}/p/${publication.slug}`,
      });
      injectStructuredData(structuredData, 'publication-structured-data');
    }

    return () => {
      removeStructuredData('publication-structured-data');
    };
  }, [coverImagePath, publication]);

  const submitReport = async () => {
    if (!publication) return;

    setReportMessage(null);

    try {
      await createReport({
        publicationId: publication.id,
        reporterId: user?.id ?? null,
        reason: reportReason,
        description: reportDescription,
      });
      setReportMessage('Reporte enviado. Gracias por ayudar a cuidar la calidad de Patitas.');
      setReportDescription('');
      setReportReason('FALSE_INFO');
      setShowReportForm(false);
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : 'No pudimos enviar el reporte.');
    }
  };

  const handleResolve = async () => {
    if (!publication || !user) return;

    setResolving(true);

    try {
      await resolvePublication(publication.id, user.id);
      // Recargar publicación
      const updated = await getPublicationBySlug(publication.slug);
      setPublication(updated);
    } catch (error) {
      console.error('Error resolving publication:', error);
    } finally {
      setResolving(false);
    }
  };

  const handleAdoptRequest = async () => {
    if (!publication || !user) return;

    setAdoptLoading(true);
    setAdoptError(null);
    setAdoptSuccess(false);

    try {
      await createAdoptionRequest(publication.id, adoptMessage.trim());
      setAdoptSuccess(true);
      setAdoptMessage('');
      setShowAdoptForm(false);
    } catch (error) {
      setAdoptError(error instanceof Error ? error.message : 'No pudimos enviar la solicitud.');
    } finally {
      setAdoptLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!publication || !user || !deleteConfirm) return;

    setDeleting(true);

    try {
      await deletePublication(publication.id, user.id);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting publication:', error);
      alert(error instanceof Error ? error.message : 'No se pudo eliminar la publicación');
    } finally {
      setDeleting(false);
    }
  };

  const handleTakedown = async () => {
    if (!publication) return;

    setTakedownLoading(true);
    setTakedownMessage(null);

    try {
      const response = await fetch('/api/takedown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publication.id,
          reason: takedownReason,
          contact_email: takedownEmail || undefined,
          details: takedownDetails || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear solicitud');
      }

      setTakedownMessage('Solicitud enviada. La publicación ha sido ocultada pendiente de revisión.');
      
      // Cerrar modal y recargar publicación
      setShowTakedownModal(false);
      setTakedownReason('INACCURATE');
      setTakedownEmail('');
      setTakedownDetails('');
      
      const updated = await getPublicationBySlug(publication.slug);
      setPublication(updated);
    } catch (error) {
      setTakedownMessage(error instanceof Error ? error.message : 'No pudimos procesar la solicitud.');
    } finally {
      setTakedownLoading(false);
    }
  };

  const isOwner = user && publication && publication.owner_profile_id === user.id;

  return (
    <section className="space-y-6 py-8">
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <PawLoader size="lg" />
          <p className="font-display text-lg font-semibold text-foreground">Cargando publicación...</p>
        </div>
      ) : publication ? (
        <div className="space-y-6">
          {/* Celebración si está resuelta */}
          {publication.status === 'RESOLVED' ? (
            <ResolvedCelebration petName={publication.title.split(' ')[0]} />
          ) : null}

          <article className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Columna principal */}
            <div className="space-y-6">
              {/* Galería */}
              <div className="overflow-hidden rounded-3xl border-2 border-foreground/10 bg-surface shadow-md transition-all hover:shadow-lg">
                {coverImage?.storage_path ? (
                  <img
                    src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/pet-images/${coverImage.storage_path}`}
                    alt={coverImage.alt_text ?? publication.title}
                    className="h-96 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-96 items-center justify-center bg-foreground/5 text-foreground/20">
                    <PawPrint size={64} strokeWidth={1.5} />
                  </div>
                )}
              </div>

              {/* Información principal */}
              <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-6 space-y-4 shadow-md">
                <div>
                  <StatusBadge status={publication.type} />
                  <h1 className="mt-3 font-display text-4xl font-extrabold text-foreground">{publication.title}</h1>
                </div>
                <p className="leading-7 text-foreground/80">{publication.description}</p>

                {/* Características */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {publication.species ? (
                    <div className="rounded-2xl border border-turquoise/20 bg-turquoise/5 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Especie</p>
                      <p className="mt-1 font-semibold text-foreground">{SPECIES_LABELS[publication.species] ?? publication.species}</p>
                    </div>
                  ) : null}
                  {publication.breed ? (
                    <div className="rounded-2xl border border-orange/20 bg-orange/5 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Raza</p>
                      <p className="mt-1 font-semibold text-foreground">{publication.breed}</p>
                    </div>
                  ) : null}
                  {publication.color ? (
                    <div className="rounded-2xl border border-purple/20 bg-purple/5 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Color</p>
                      <p className="mt-1 font-semibold text-foreground">{publication.color}</p>
                    </div>
                  ) : null}
                  {publication.size ? (
                    <div className="rounded-2xl border border-turquoise/20 bg-turquoise/5 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Tamaño</p>
                      <p className="mt-1 font-semibold text-foreground">{SIZE_LABELS[publication.size] ?? publication.size}</p>
                    </div>
                  ) : null}
                  {publication.sex ? (
                    <div className="rounded-2xl border border-orange/20 bg-orange/5 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Sexo</p>
                      <p className="mt-1 font-semibold text-foreground">{SEX_LABELS[publication.sex] ?? publication.sex}</p>
                    </div>
                  ) : null}
                  {publication.age_approx ? (
                    <div className="rounded-2xl border border-purple/20 bg-purple/5 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Edad aprox.</p>
                      <p className="mt-1 font-semibold text-foreground">{AGE_LABELS[publication.age_approx] ?? publication.age_approx}</p>
                    </div>
                  ) : null}
                </div>

                {publication.characteristics ? (
                  <div className="rounded-2xl border border-orange/20 bg-orange/5 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Características</p>
                    <p className="mt-2 leading-7 text-foreground/80">{publication.characteristics}</p>
                  </div>
                ) : null}
              </div>

              {/* Coincidencias */}
              {matches.length > 0 ? (
                <div className="space-y-4 rounded-3xl border-2 border-orange/20 bg-orange/5 p-6 shadow-md">
                  <div>
                    <h3 className="font-display text-2xl font-extrabold text-foreground">✨ Posibles coincidencias</h3>
                    <p className="mt-2 text-sm text-foreground/70">
                      Encontramos casos con características similares. Revísalos para verificar si coinciden.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {matches.map((match) => (
                      <Link
                        key={match.publicationId}
                        to={`/p/${match.publication.slug}`}
                        className="block overflow-hidden rounded-2xl border-2 border-turquoise/20 bg-surface transition-all hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div className="flex gap-4 p-4">
                          <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-foreground/5">
                            {match.publication.coverImageUrl ? (
                              <img src={match.publication.coverImageUrl} alt={match.publication.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-foreground/30">
                                <PawPrint size={28} strokeWidth={1.5} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-semibold text-foreground">{match.publication.title}</p>
                              <div className="shrink-0 rounded-full bg-orange px-3 py-1 text-xs font-bold text-white shadow-paw">
                                {match.score}%
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {match.reasons.slice(0, 3).map((reason, index) => (
                                <span key={index} className="rounded-full bg-turquoise/10 border border-turquoise/20 px-2 py-1 text-xs font-medium text-turquoise-dark">
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <p className="text-xs italic text-foreground/60">
                    Esta coincidencia es automática y puede no ser exacta. Verifica los detalles antes de contactar.
                  </p>
                </div>
              ) : null}

              {/* Avistamientos */}
              {publication.type === 'LOST' && publication.status === 'ACTIVE' ? (
                <SightingForm publicationId={publication.id} userId={user?.id ?? null} onSuccess={loadSightings} />
              ) : null}

              {sightings.length > 0 ? <SightingsTimeline sightings={sightings} /> : null}

              {/* Comentarios */}
              <CommentsSection publicationId={publication.id} currentUserId={user?.id ?? null} />
            </div>

            {/* Columna lateral */}
            <aside className="space-y-5">
              {/* Botón de procesamiento IA (solo para el dueño) */}
              {isOwner && publication.id && (
                <div className="rounded-xl border-2 border-purple/20 bg-surface p-4 shadow-sm">
                  {isFeatureEnabled('ai') && <ProcessButton publicationId={publication.id} />}
                </div>
              )}

              {/* Estado de procesamiento de IA */}
              {isFeatureEnabled('ai') && publication.id && (
                <ProcessingStatusBadge publicationId={publication.id} />
              )}

              {/* Alerta de duplicados — solo para el dueño: el endpoint
                  exige propiedad de la publicación desde la Fase 1.
                  Oculto si la IA está desactivada (tarea 5.4): con el proveedor
                  mock los resultados son inventados. */}
              {isFeatureEnabled('ai') && isOwner && publication.id && (
                <DuplicateWarning
                  publicationId={publication.id}
                  onViewDuplicate={(duplicateId) => {
                    window.open(`/admin/publicaciones/${duplicateId}`, '_blank', 'noopener,noreferrer');
                  }}
                />
              )}

              {/* Panel de Matches de IA — solo para el dueño: el endpoint exige
                  propiedad desde la Fase 1 (hallazgo API-02), así que pedirlo
                  como visitante solo produciría un 403 y un panel vacío. */}
              {isFeatureEnabled('ai') &&
                isOwner &&
                publication.id &&
                (publication.type === 'LOST' || publication.type === 'FOUND') && (
                  <MatchesPanel publicationId={publication.id} />
                )}

              {/* Detalles */}
              <div className="rounded-3xl border-2 border-turquoise/20 bg-surface p-6 space-y-3 shadow-md">
                <h2 className="font-display text-2xl font-extrabold text-foreground">📍 Ubicación</h2>
                <p className="flex items-center gap-2 text-sm text-foreground/70">
                  <MapPin size={16} className="shrink-0 text-turquoise" />
                  {(() => {
                    const loc = normalizeLocation(publication.location);
                    return [loc?.zone, loc?.municipality, loc?.province].filter(Boolean).join(', ');
                  })()}
                </p>
                {publication.event_date ? (
                  <p className="flex items-center gap-2 text-sm text-foreground/70">
                    <Calendar size={16} className="shrink-0 text-orange" />
                    {new Intl.DateTimeFormat('es-CU', { dateStyle: 'long' }).format(new Date(publication.event_date))}
                  </p>
                ) : null}
                <Link className="inline-block text-sm font-semibold text-turquoise hover:underline" to="/mapa">
                  Ver en mapa →
                </Link>
              </div>

              {/* Acciones */}
              <div className="rounded-3xl border-2 border-orange/20 bg-surface p-6 space-y-3 shadow-md">
                <h2 className="font-display text-2xl font-extrabold text-foreground">⚡ Acciones</h2>
                <div className="flex flex-col gap-3">
                  {isOwner && publication.status === 'ACTIVE' ? (
                    <>
                      <Button type="button" onClick={handleResolve} disabled={resolving} className="gap-2">
                        <CheckCircle size={16} />
                        {resolving ? 'Resolviendo...' : 'Marcar como resuelto'}
                      </Button>
                      
                      <Link to={`/publicar?edit=${publication.id}`}>
                        <Button type="button" variant="secondary" className="w-full gap-2">
                          <Pencil size={16} />
                          Editar publicación
                        </Button>
                      </Link>
                      
                      {!deleteConfirm ? (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          onClick={() => setDeleteConfirm(true)}
                          className="gap-2 text-lost hover:text-lost-dark"
                        >
                          <Trash2 size={16} />
                          Eliminar publicación
                        </Button>
                      ) : (
                        <div className="space-y-2 p-4 bg-lost/10 border-2 border-lost/20 rounded-2xl">
                          <p className="text-sm font-semibold text-lost-dark">
                            ¿Estás seguro? Esta acción no se puede deshacer.
                          </p>
                          <div className="flex gap-2">
                            <Button 
                              type="button" 
                              variant="ghost"
                              onClick={handleDelete}
                              disabled={deleting}
                              className="flex-1 bg-lost text-white hover:bg-lost-dark"
                            >
                              {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                            </Button>
                            <Button 
                              type="button" 
                              variant="ghost"
                              onClick={() => setDeleteConfirm(false)}
                              className="flex-1"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}
                  
                  {publication.type === 'ADOPTION' && publication.status === 'ACTIVE' && user && !isOwner ? (
                    !showAdoptForm ? (
                      <Button type="button" variant="secondary" onClick={() => setShowAdoptForm(true)} className="gap-2">
                        <Heart size={16} />
                        Solicitar adopción
                      </Button>
                    ) : (
                      <div className="space-y-3 p-4 bg-purple/5 border border-purple/20 rounded-2xl">
                        <h3 className="font-semibold text-foreground">Solicitar adopción</h3>
                        <p className="text-sm text-foreground/70">Cuéntale al por qué quieres adoptar a esta mascota.</p>
                        <TextareaField
                          label="Mensaje"
                          placeholder="Hola, me gustaría adoptar a esta mascota porque..."
                          value={adoptMessage}
                          onChange={(event) => setAdoptMessage(event.target.value)}
                        />
                        {adoptError ? (
                          <p className="rounded-2xl bg-lost/10 border border-lost/20 px-4 py-3 text-sm font-medium text-lost-dark">{adoptError}</p>
                        ) : null}
                        {adoptSuccess ? (
                          <p className="rounded-2xl bg-found/10 border border-found/20 px-4 py-3 text-sm font-medium text-found-dark">Solicitud enviada. El propietario recibirá una notificación.</p>
                        ) : null}
                        <div className="flex gap-3">
                          <Button type="button" onClick={handleAdoptRequest} disabled={adoptLoading}>{adoptLoading ? 'Enviando...' : 'Enviar solicitud'}</Button>
                          <Button type="button" variant="ghost" onClick={() => { setShowAdoptForm(false); setAdoptMessage(''); setAdoptError(null); setAdoptSuccess(false); }}>Cancelar</Button>
                        </div>
                      </div>
                    )
                  ) : null}
                  {/* Botón Retirar para publicaciones importadas */}
                  {publication.is_imported && publication.status !== 'HIDDEN' && publication.status !== 'DELETED' ? (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => setShowTakedownModal(true)}
                      className="gap-2"
                    >
                      <Shield size={16} />
                      Retirar
                    </Button>
                  ) : null}

                  <div className="flex items-stretch gap-3">
                    <ShareMenu
                      publication={{
                        title: publication.title,
                        type: publication.type,
                        location: (() => {
                          const loc = normalizeLocation(publication.location);
                          return [loc?.municipality, loc?.province].filter(Boolean).join(', ');
                        })(),
                        slug: publication.slug,
                      }}
                      className="flex-1"
                    />

                    {!showReportForm ? (
                      <Button type="button" variant="ghost" onClick={() => setShowReportForm(true)} className="flex-1 w-full gap-2 justify-center">
                        <AlertTriangle size={16} />
                        Reportar
                      </Button>
                    ) : null}
                  </div>
              </div>

              {/* Formulario de reporte */}
              {showReportForm ? (
                <div className="rounded-3xl border-2 border-lost/20 bg-lost/5 p-6 space-y-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-xl font-extrabold text-foreground flex items-center gap-2">
                      <Flag size={20} className="text-lost" />
                      Reportar
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowReportForm(false)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-foreground/60 hover:text-foreground transition"
                    >
                      <X size={16} />
                      Cerrar
                    </button>
                  </div>
                  <label className="space-y-2 text-sm font-semibold text-foreground">
                    <span>Motivo</span>
                    <select
                      className="h-12 w-full rounded-2xl border-2 border-foreground/10 bg-surface px-4 text-foreground shadow-sm outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20"
                      value={reportReason}
                      onChange={(event) => setReportReason(event.target.value as typeof reportReason)}
                    >
                      <option value="FALSE_INFO">Información falsa</option>
                      <option value="SPAM">Spam</option>
                      <option value="SCAM">Estafa</option>
                      <option value="DUPLICATE">Duplicado</option>
                      <option value="REUNITED">Mascota recuperada</option>
                      <option value="INAPPROPRIATE">Contenido inapropiado</option>
                      <option value="OTHER">Otro</option>
                    </select>
                  </label>
                  <TextareaField
                    label="Descripción (opcional)"
                    placeholder="Cuéntanos el contexto del reporte."
                    value={reportDescription}
                    onChange={(event) => setReportDescription(event.target.value)}
                  />
                  {reportMessage ? (
                    <p
                      className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                        reportMessage.includes('Gracias') || reportMessage.includes('enviado')
                          ? 'bg-found/10 border border-found/20 text-found-dark'
                          : 'bg-lost/10 border border-lost/20 text-lost-dark'
                      }`}
                    >
                      {reportMessage}
                    </p>
                  ) : null}
                  <Button type="button" onClick={submitReport}>
                    Enviar reporte
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Modal de retirada (takedown) */}
            {showTakedownModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                  <div className="w-full max-w-md bg-surface rounded-3xl border-2 border-foreground/10 shadow-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
                        <Shield className="size-6 text-lost" />
                        Retirar publicación
                      </h2>
                      <button
                        type="button"
                        onClick={() => { setShowTakedownModal(false); setTakedownMessage(null); }}
                        className="p-1 rounded-xl hover:bg-foreground/5 transition"
                      >
                        <XCircle className="size-5 text-foreground/50" />
                      </button>
                    </div>

                    <p className="text-sm text-foreground/70 mb-4">
                      Esta acción ocultará la publicación inmediatamente y notificará a los moderadores.
                      Solo para publicaciones importadas desde fuentes externas.
                    </p>

                    <label className="space-y-2 text-sm font-semibold text-foreground">
                      <span>Motivo</span>
                      <select
                        className="w-full h-10 rounded-2xl border-2 border-foreground/10 bg-surface px-3 text-base text-foreground"
                        value={takedownReason}
                        onChange={(e) => setTakedownReason(e.target.value as typeof takedownReason)}
                      >
                        <option value="COPYRIGHT">Derechos de autor / Propiedad intelectual</option>
                        <option value="PRIVACY">Privacidad / Datos personales</option>
                        <option value="INACCURATE">Información incorrecta / Desactualizada</option>
                        <option value="OTHER">Otro motivo</option>
                      </select>
                    </label>

                    <label className="space-y-2 text-sm font-semibold text-foreground">
                      <span>Tu email (opcional, para seguimiento)</span>
                      <input
                        type="email"
                        className="w-full h-10 rounded-2xl border-2 border-foreground/10 bg-surface px-3 text-base text-foreground"
                        placeholder="tu@email.com"
                        value={takedownEmail}
                        onChange={(e) => setTakedownEmail(e.target.value)}
                      />
                    </label>

                    <label className="space-y-2 text-sm font-semibold text-foreground">
                      <span>Detalles adicionales (opcional)</span>
                      <TextareaField
                        label="Detalles adicionales"
                        value={takedownDetails}
                        onChange={(e) => setTakedownDetails(e.target.value)}
                        placeholder="Explica brevemente por qué solicitas la retirada..."
                      />
                    </label>

                    {takedownMessage && (
                      <p
                        className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                          takedownMessage.includes('enviado') ? 'bg-found/10 border border-found/20 text-found-dark' : 'bg-lost/10 border border-lost/20 text-lost-dark'
                        }`}
                      >
                        {takedownMessage}
                      </p>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => { setShowTakedownModal(false); setTakedownMessage(null); }}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={handleTakedown}
                        loading={takedownLoading}
                        className="flex-1"
                      >
                        Enviar solicitud
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <div className="rounded-3xl border-2 border-purple/20 bg-surface p-6 space-y-3 shadow-md">
                <h2 className="font-display text-xl font-extrabold text-foreground">👤 Publicado por</h2>
                {publication.owner?.username ? (
                  <Link to={`/perfil/${publication.owner.username}`} className="text-sm font-semibold text-purple hover:text-purple-dark hover:underline transition-colors">
                    @{publication.owner.username}
                  </Link>
                ) : (
                  <p className="text-sm font-semibold text-purple">@{publication.owner?.username ?? 'Usuario'}</p>
                )}
                <p className="text-xs text-foreground/60">
                  {new Intl.DateTimeFormat('es-CU', { dateStyle: 'long' }).format(new Date(publication.published_at))}
                </p>
              </div>
            </aside>
          </article>
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-8 text-center shadow-md">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-orange/10 flex items-center justify-center">
              <PawPrint size={40} className="text-orange" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-extrabold text-foreground">🐱 No encontramos esta patita</h2>
              <p className="text-sm text-foreground/60">Es posible que haya sido eliminada o que el enlace no sea correcto.</p>
            </div>
            <Link to="/">
              <Button>Volver al inicio</Button>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}