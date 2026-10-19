import { MapPin } from 'lucide-react';

type Sighting = {
  id: string;
  note: string;
  occurred_at: string | null;
  created_at: string;
  location: {
    province: string;
    municipality: string;
    zone: string | null;
  } | null;
};

type SightingsTimelineProps = {
  sightings: Sighting[];
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-CU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function SightingsTimeline({ sightings }: SightingsTimelineProps) {
  if (sightings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-display text-2xl font-extrabold" style={{ fontFamily: '"Baloo 2", cursive', color: '#0B3B3C' }}>
          Avistamientos
        </h3>
        <span className="rounded-full px-3 py-1 text-sm font-bold text-white" style={{ backgroundColor: '#0E7C66' }}>{sightings.length}</span>
      </div>

      <div className="space-y-3">
        {sightings.map((sighting, index) => (
          <div
            key={sighting.id}
            className="relative rounded-2xl border-2 p-5 shadow-sm"
            style={{
              borderColor: '#CFEFE6',
              backgroundColor: 'hsl(var(--card))',
            }}
          >
            <div
              className="absolute -left-3 top-6 flex size-6 items-center justify-center rounded-full text-xs font-bold shadow-md"
              style={{
                backgroundColor: '#FF6B35',
                color: '#0B3B3C',
              }}
            >
              {sightings.length - index}
            </div>

            <div className="space-y-2 pl-4">
              <p className="text-sm font-semibold" style={{ color: 'rgba(11,59,60,0.6)' }}>{formatDate(sighting.occurred_at ?? sighting.created_at)}</p>

              {sighting.location ? (
                <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#0B3B3C' }}>
                  <MapPin className="size-4" aria-hidden="true" style={{ color: '#FF6B35' }} />
                  {[sighting.location.zone, sighting.location.municipality, sighting.location.province].filter(Boolean).join(', ')}
                </p>
              ) : null}

              <p className="leading-7" style={{ color: '#0B3B3C' }}>{sighting.note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
