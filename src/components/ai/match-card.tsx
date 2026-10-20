import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, X, Eye, CheckCircle, MapPin, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import type { AIMatch } from '../../lib/ai/types';

type MatchCardProps = {
  match: AIMatch;
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
  onConfirm?: (matchId: string) => Promise<void>;
  onDismiss?: (matchId: string) => Promise<void>;
};

const matchTypeLabels: Record<AIMatch['match_type'], { label: string; emoji: string }> = {
  LOST_FOUND: { label: 'Perdida/Encontrada', emoji: '🔄' },
  SIGHTING: { label: 'Avistamiento', emoji: '👁️' },
  VISUAL: { label: 'Similitud visual', emoji: '📸' },
  SEMANTIC: { label: 'Similitud semántica', emoji: '🧠' },
};

export function MatchCard({ match, publication, onConfirm, onDismiss }: MatchCardProps) {
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || match.status === 'DISMISSED') {
    return null;
  }

  const handleConfirm = async () => {
    if (!onConfirm) return;
    setLoading(true);
    try {
      await onConfirm(match.id);
    } catch (error) {
      console.error('Error confirming match:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (!onDismiss) return;
    setLoading(true);
    try {
      await onDismiss(match.id);
      setDismissed(true);
    } catch (error) {
      console.error('Error dismissing match:', error);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = 
    match.overall_score >= 80 ? 'text-purple bg-purple/10' :
    match.overall_score >= 60 ? 'text-turquoise bg-turquoise/10' :
    'text-orange bg-orange/10';

  const matchTypeConfig = matchTypeLabels[match.match_type];

  return (
    <div className="group rounded-2xl border-2 border-foreground/10 bg-surface p-5 shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-full ${scoreColor} font-bold text-sm`}>
            {Math.round(match.overall_score)}% match
          </div>
          <div className="px-2 py-1 rounded-full bg-foreground/5 text-foreground/70 text-xs font-medium">
            {matchTypeConfig.emoji} {matchTypeConfig.label}
          </div>
        </div>
        
        {match.status === 'CONFIRMED' && (
          <div className="flex items-center gap-1 text-purple text-sm font-medium">
            <CheckCircle className="size-4" />
            <span>Confirmado</span>
          </div>
        )}
      </div>

      {/* Publication Preview */}
      {publication && (
        <Link
          to={`/p/${publication.slug}`}
          className="block mb-4 group/link"
        >
          <div className="flex gap-4">
            {/* Image */}
            <div className="relative size-20 rounded-xl overflow-hidden bg-foreground/5 shrink-0">
              {publication.coverImageUrl ? (
                <img
                  src={publication.coverImageUrl}
                  alt={publication.title}
                  className="size-full object-cover group-hover/link:scale-110 transition-transform duration-300"
                />
              ) : (
                <div className="size-full flex items-center justify-center text-3xl">
                  🐾
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-foreground text-base mb-1 truncate group-hover/link:text-purple transition-colors">
                {publication.title}
              </h3>
              <p className="text-sm text-foreground/70 mb-2">
                {publication.species}
              </p>
              {publication.location && (
                <div className="flex items-center gap-1 text-xs text-foreground/60">
                  <MapPin className="size-3" />
                  <span>
                    {publication.location.municipality}, {publication.location.province}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 text-xs text-foreground/60 mt-1">
                <Calendar className="size-3" />
                <span>
                  {new Date(publication.published_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Match Details */}
      {match.reasons.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-turquoise/5 border border-turquoise/20">
          <p className="text-xs font-medium text-foreground/70 mb-2">Razones del match:</p>
          <ul className="space-y-1">
            {match.reasons.slice(0, 3).map((reason, i) => (
              <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                <span className="text-turquoise">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scores Breakdown */}
      {(match.structured_score || match.semantic_score || match.visual_score) && (
        <div className="mb-4 space-y-2">
          {match.structured_score && match.structured_score > 0 && (
            <ScoreBar label="Estructurado" score={match.structured_score} />
          )}
          {match.semantic_score && match.semantic_score > 0 && (
            <ScoreBar label="Semántico" score={match.semantic_score} />
          )}
          {match.visual_score && match.visual_score > 0 && (
            <ScoreBar label="Visual" score={match.visual_score} />
          )}
        </div>
      )}

      {/* Actions */}
      {match.status === 'PENDING' && (onConfirm || onDismiss) && (
        <div className="flex gap-2">
          {onConfirm && (
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 min-h-0! py-2!"
            >
              <Heart className="size-4" />
              Confirmar match
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="secondary"
              onClick={handleDismiss}
              disabled={loading}
              className="min-h-0! py-2!"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      )}

      {match.status === 'VIEWED' && (
        <div className="flex items-center gap-2 text-sm text-foreground/60">
          <Eye className="size-4" />
          <span>Ya viste este match</span>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-foreground/60 w-24">{label}</span>
      <div className="flex-1 h-1.5 bg-foreground/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-turquoise to-purple rounded-full transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-medium text-foreground w-10 text-right">
        {Math.round(score)}%
      </span>
    </div>
  );
}
