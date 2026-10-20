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
        <h3 className="font-display text-2xl font-extrabold text-foreground" style={{ fontFamily: '"Baloo 2", cursive' }}>
          Avistamientos
        </h3>
        <span className="rounded-full bg-found px-3 py-1 text-sm font-bold text-white">{sightings.length}</span>
      </div>

      <div className="space-y-3">
        {sightings.map((sighting, index) => (
          <div
            key={sighting.id}
            className="relative rounded-2xl border-2 border-found/30 bg-surface p-5 shadow-sm"
          >
            <div
              className="absolute -left-3 top-6 flex size-6 items-center justify-center rounded-full bg-orange text-xs font-bold text-primary-foreground shadow-md"
            >
              {sightings.length - index}
            </div>

            <div className="space-y-2 pl-4">
              <p className="text-sm font-semibold text-foreground/60">{formatDate(sighting.occurred_at ?? sighting.created_at)}</p>

              {sighting.location ? (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <MapPin className="size-4 text-orange" aria-hidden="true" />
                  {[sighting.location.zone, sighting.location.municipality, sighting.location.province].filter(Boolean).join(', ')}
                </p>
              ) : null}

              <p className="leading-7 text-foreground">{sighting.note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
