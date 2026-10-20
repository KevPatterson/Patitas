import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';
import { getMatchesForPublication, confirmMatch, dismissMatch } from '../../lib/ai/matching';
import { supabase } from '../../lib/supabase/client';
import { MatchCard } from '../ai/match-card';
import type { AIMatch } from '../../lib/ai/types';

type MatchesPanelProps = {
  publicationId: string;
};

type EnrichedMatch = AIMatch & {
  publication?: {
    id: string;
    slug: string;
    title: string;
    species: string;
    published_at: string;
    coverImageUrl: string | null;
    location?: {
      province: string;
      municipality: string;
    };
  };
};

export function MatchesPanel({ publicationId }: MatchesPanelProps) {
  const [matches, setMatches] = useState<EnrichedMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicationId]);

  async function loadMatches() {
    setLoading(true);
    try {
      const data = await getMatchesForPublication(publicationId);
      
      // Enriquecer con datos de publicación
      const enriched = await Promise.all(
        data.map(async (match) => {
          // Determinar qué publicación mostrar (la otra que no es la actual)
          const otherPubId = match.publication_a_id === publicationId 
            ? match.publication_b_id 
            : match.publication_a_id;

          const { data: pub } = await supabase
            .from('publications')
            .select(`
              id,
              slug,
              title,
              species,
              published_at,
              publication_images(storage_path, is_cover),
              location:locations(province, municipality)
            `)
            .eq('id', otherPubId)
            .single();

          if (!pub) return { ...match };

          const coverImage = Array.isArray(pub.publication_images)
            ? pub.publication_images.find((img: { is_cover: boolean }) => img.is_cover) || pub.publication_images[0]
            : null;

          const location = Array.isArray(pub.location) ? pub.location[0] : pub.location;

          return {
            ...match,
            publication: {
              id: pub.id,
              slug: pub.slug,
              title: pub.title,
              species: pub.species,
              published_at: pub.published_at,
              coverImageUrl: coverImage?.storage_path
                ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/pet-images/${coverImage.storage_path}`
                : null,
              location: location || undefined,
            },
          };
        })
      );

      setMatches(enriched);
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(matchId: string) {
    const { data: userResponse } = await supabase.auth.getUser();
    if (!userResponse.user) return;

    await confirmMatch(matchId, userResponse.user.id);
    loadMatches();
  }

  async function handleDismiss(matchId: string) {
    const { data: userResponse } = await supabase.auth.getUser();
    if (!userResponse.user) return;

    await dismissMatch(matchId, userResponse.user.id);
    loadMatches();
  }

  if (loading) {
    return (
      <div className="rounded-xl border-2 border-purple/20 bg-purple/5 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-purple animate-pulse" />
          <h3 className="font-display text-sm font-bold text-foreground">Buscando coincidencias...</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-foreground/5 rounded-xl" />
          <div className="h-20 bg-foreground/5 rounded-xl" />
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border-2 border-purple/20 bg-purple/5 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="size-5 text-purple" />
        <h3 className="font-display text-lg font-bold text-foreground">
          Coincidencias de IA
        </h3>
        <span className="ml-auto rounded-full bg-purple/20 px-2 py-0.5 text-xs font-bold text-purple-dark">
          {matches.length}
        </span>
      </div>

      <div className="space-y-3">
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            publication={match.publication}
            onConfirm={handleConfirm}
            onDismiss={handleDismiss}
          />
        ))}
      </div>

      <p className="mt-3 text-xs text-foreground/60 leading-relaxed">
        💡 Estas coincidencias fueron detectadas automáticamente por IA. Revisa los detalles antes de contactar.
      </p>
    </div>
  );
}
