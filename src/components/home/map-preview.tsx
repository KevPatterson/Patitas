import { useEffect, useRef, useState, type CSSProperties } from 'react';

type CaseType = 'LOST' | 'FOUND' | 'ABANDONED' | 'ADOPTION' | 'SIGHTING';

/** Colores idénticos a los marcadores del mapa real */
const CASE_COLORS: Record<CaseType, { color: string; fillColor: string }> = {
  LOST: { color: '#fe6411', fillColor: 'rgba(254, 100, 17, 0.2)' },
  FOUND: { color: '#10b981', fillColor: 'rgba(16, 185, 129, 0.2)' },
  ABANDONED: { color: '#ff8c42', fillColor: 'rgba(255, 140, 66, 0.2)' },
  ADOPTION: { color: '#a78bfa', fillColor: 'rgba(167, 139, 250, 0.2)' },
  SIGHTING: { color: '#ffb078', fillColor: 'rgba(255, 176, 120, 0.2)' },
};

/** viewBox 400x250. Radar centrado en Vedado. */
const RADAR_CX = 200;
const RADAR_CY = 150;
const RADAR_R = 100;
const SWEEP_SECONDS = 6; // una vuelta del barrido
const WEDGE_DEG = 50; // ancho de la cuña

type DemoCase = { id: string; type: CaseType; x: number; y: number; protagonist?: boolean };

/** (x, y) = PUNTA del marcador. Todos sobre tierra y dentro del radio del radar. */
const DEMO_CASES: DemoCase[] = [
  { id: 'case-lost', type: 'LOST', x: 125, y: 140, protagonist: true },
  { id: 'case-found', type: 'FOUND', x: 285, y: 120 },
  { id: 'case-adoption', type: 'ADOPTION', x: 110, y: 205 },
  { id: 'case-abandoned', type: 'ABANDONED', x: 275, y: 210 },
  { id: 'case-sighting', type: 'SIGHTING', x: 170, y: 230 },
];

/**
 * Delay = momento en que el borde delantero del barrido (ángulo 0° al inicio,
 * girando en sentido horario) llega al caso. Ángulo 0–360 desde el centro.
 */
function sweepDelay(x: number, y: number): number {
  let angle = (Math.atan2(y - RADAR_CY, x - RADAR_CX) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  return Number(((angle / 360) * SWEEP_SECONDS).toFixed(2));
}

const CASES = DEMO_CASES.map((c) => ({ ...c, delay: sweepDelay(c.x, c.y) }));
const PROTAGONIST = CASES.filter((c) => c.protagonist)[0] ?? CASES[0];

/** Cuña de WEDGE_DEG grados que "arrastra" detrás del borde delantero (ángulo 0). */
const wedgeEndX = (RADAR_R * Math.cos((-WEDGE_DEG * Math.PI) / 180)).toFixed(2);
const wedgeEndY = (RADAR_R * Math.sin((-WEDGE_DEG * Math.PI) / 180)).toFixed(2);
const SWEEP_PATH = `M0 0 L${RADAR_R} 0 A${RADAR_R} ${RADAR_R} 0 0 0 ${wedgeEndX} ${wedgeEndY} Z`;

/** Formas del icono de patita (viewBox 24x24). Reemplazar por el icono real del mapa si es exportable. */
function PawShapes() {
  return (
    <>
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="20" cy="16" r="2" />
      <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
    </>
  );
}

/**
 * Marcador. Estructura: <g translate> (posición, NUNCA animado) > <g .map-case> (animado, origen = punta).
 * El icono se dibuja de modo que su punta (centro-abajo) quede en (0,0).
 */
function Marker({
  c,
  type,
  variant,
  ring = false,
}: {
  c: (typeof CASES)[number];
  type: CaseType;
  variant: 'cycle' | 'lost' | 'found';
  ring?: boolean;
}) {
  const { color, fillColor } = CASE_COLORS[type];
  return (
    <g transform={`translate(${c.x} ${c.y})`}>
      <g className={`map-case map-case--${variant}`} style={{ animationDelay: `${c.delay}s` }}>
        {ring && (
          <ellipse className="map-ground-ring" cx="0" cy="0" rx="12" ry="4.5" fill="none" stroke={color} strokeWidth="2" />
        )}
        <circle className="map-case-disc" cx="0" cy="-14" r="15" />
        <g
          transform="translate(-14 -28) scale(1.1667)"
          fill={fillColor}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <PawShapes />
        </g>
      </g>
    </g>
  );
}

const CONFETTI = [
  { dx: -22, rot: -160 },
  { dx: -10, rot: 110 },
  { dx: 2, rot: -70 },
  { dx: 14, rot: 200 },
  { dx: 26, rot: -110 },
];

/** Confeti en coordenadas SVG, valores deterministas (sin Math.random). */
function Confetti({ x, y, delay }: { x: number; y: number; delay: number }) {
  const { color, fillColor } = CASE_COLORS.FOUND;
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      {CONFETTI.map((p, i) => (
        <g
          key={i}
          className="map-confetti"
          style={{ animationDelay: `${(delay + i * 0.06).toFixed(2)}s`, '--dx': `${p.dx}px`, '--rot': `${p.rot}deg` } as CSSProperties}
        >
          <g transform="translate(-8 -8) scale(0.6667)" fill={fillColor} stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <PawShapes />
          </g>
        </g>
      ))}
    </g>
  );
}

export function MapPreview({ nearbyCount = 5 }: { nearbyCount?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  // Pausar cuando el componente sale de pantalla
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Pausar cuando la pestaña está oculta
  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const paused = !inView || !tabVisible;

  return (
    <div
      ref={ref}
      className={`map-preview-container${paused ? ' is-paused' : ''}`}
      role="img"
      aria-label="Vista previa animada del mapa de La Habana con casos cercanos"
    >
      <svg viewBox="0 0 400 250" className="map-preview-svg" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
        {/* ===== CAPA 1: MAPA BASE ===== */}
        <rect width="400" height="250" className="map-sea" />
        <path d="M0 100 Q100 85 200 95 Q300 105 400 90 L400 250 L0 250 Z" className="map-land" />

        {/* Zonas */}
        <ellipse cx="70" cy="150" rx="55" ry="35" className="map-zone" />
        <ellipse cx="200" cy="125" rx="62" ry="30" className="map-zone" />
        <ellipse cx="318" cy="172" rx="48" ry="30" className="map-zone" />

        {/* Calles (ninguna entra al mar) */}
        <g className="map-streets">
          <path d="M20 125 L380 133" />
          <path d="M30 152 L370 158" />
          <path d="M40 180 L360 178" />
          <path d="M50 210 L350 203" />
          <path d="M60 235 L340 223" />
          <path d="M300 105 L310 250" />
        </g>

        {/* Bahía: entrante de agua que nace en la costa */}
        <path d="M302 98 C308 118 330 138 366 148 L400 152 L400 90 C360 93 330 97 302 98 Z" className="map-bay" />

        {/* Malecón: costa hasta la boca de la bahía */}
        <path d="M0 100 Q100 85 200 95 Q250 100 300 98.75" className="map-coastline" />

        {/* Faro (silueta del Morro) en la boca de la bahía */}
        <g className="map-lighthouse" transform="translate(292 76)">
          <path d="M-3 22 L-2 6 L2 6 L3 22 Z" />
          <rect x="-5" y="22" width="10" height="3" rx="1" />
          <circle cx="0" cy="3" r="3.2" className="map-lighthouse-light" />
        </g>

        {/* Etiquetas de zona (ya en mayúsculas: text-transform no funciona en SVG) */}
        <text x="70" y="156" className="map-zone-label">PLAYA</text>
        <text x="172" y="106" className="map-zone-label">VEDADO</text>
        <text x="318" y="178" className="map-zone-label">H. VIEJA</text>

        {/* ===== CAPA 2: RADAR ===== */}
        <g transform={`translate(${RADAR_CX} ${RADAR_CY})`}>
          <circle r="35" className="map-radar-ring" />
          <circle r="70" className="map-radar-ring" />
          <circle r={RADAR_R} className="map-radar-ring" />
          <line x1={-RADAR_R} y1="0" x2={RADAR_R} y2="0" className="map-radar-cross" />
          <line x1="0" y1={-RADAR_R} x2="0" y2={RADAR_R} className="map-radar-cross" />

          <path d={SWEEP_PATH} className="map-radar-sweep" />

          {/* Ondas: solo transform/opacity (nada de animar `r`) */}
          <circle r={RADAR_R} className="map-radar-wave" />
          <circle r={RADAR_R} className="map-radar-wave" style={{ animationDelay: '2s' }} />

          <circle r="12" className="map-radar-halo" />
          <circle r="5" className="map-radar-center" />
          <text x="14" y="4" className="map-radar-label">TÚ</text>
          <text x="52" y="-52" className="map-distance-label">10 km</text>
        </g>

        {/* ===== CAPA 3: CASOS ===== */}
        <g>
          {CASES.map((c) =>
            c.protagonist ? (
              <g key={c.id}>
                <Marker c={c} type="LOST" variant="lost" ring />
                <Marker c={c} type="FOUND" variant="found" />
                <Confetti x={c.x} y={c.y - 30} delay={c.delay + 0.34 * 12} />
              </g>
            ) : (
              <Marker key={c.id} c={c} type={c.type} variant="cycle" />
            ),
          )}
        </g>
      </svg>

      {/* Tarjetas del caso protagonista: dos apiladas, cada una con su propio ciclo CSS */}
      <div
        className="map-card-anchor"
        style={{
          left: `clamp(120px, ${((PROTAGONIST.x - 40) / 400) * 100}%, calc(100% - 120px))`,
          top: `${((PROTAGONIST.y - 45) / 250) * 100}%`,
        }}
      >
        <div className="map-floating-card map-card--lost" style={{ animationDelay: `${PROTAGONIST.delay}s` }}>
          <span className="map-card-dot map-card-dot--lost" />
          <span>Perra mestiza · Perdida</span>
        </div>
        <div className="map-floating-card map-card--found" style={{ animationDelay: `${PROTAGONIST.delay}s` }}>
          <span className="map-card-dot map-card-dot--found" />
          <span>¡Reencontrada!</span>
        </div>
      </div>

      <div className="map-nearby-chip">
        <span className="map-chip-dot" />
        <span>{nearbyCount} caso{nearbyCount !== 1 ? 's' : ''} cerca de ti</span>
      </div>
    </div>
  );
}

export default MapPreview;