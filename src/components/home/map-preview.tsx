'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Tipos de casos compatibles con el mapa real
 */
type CaseType = 'LOST' | 'FOUND' | 'ABANDONED' | 'ADOPTION' | 'SIGHTING';

/**
 * Configuración de colores por tipo (idéntica al mapa real)
 */
const CASE_COLORS: Record<CaseType, { color: string; fillColor: string; label: string }> = {
  LOST: { color: '#ef4444', fillColor: 'rgba(239, 68, 68, 0.2)', label: 'Perdida' },
  FOUND: { color: '#10b981', fillColor: 'rgba(16, 185, 129, 0.2)', label: 'Encontrada' },
  ABANDONED: { color: '#ff8c42', fillColor: 'rgba(255, 140, 66, 0.2)', label: 'Abandonada' },
  ADOPTION: { color: '#a78bfa', fillColor: 'rgba(167, 139, 250, 0.2)', label: 'Adopción' },
  SIGHTING: { color: '#ffb078', fillColor: 'rgba(255, 176, 120, 0.2)', label: 'Avistamiento' },
};

/**
 * Casos de demostración con posiciones fijas en el viewBox 400x250
 * Radar centrado en Vedado aprox (200, 120)
 */
const DEMO_CASES: Array<{ id: string; type: CaseType; x: number; y: number }> = [
  { id: 'case-1', type: 'LOST', x: 180, y: 95 },      // Cerca del radar (protagonista)
  { id: 'case-2', type: 'FOUND', x: 240, y: 110 },
  { id: 'case-3', type: 'ADOPTION', x: 160, y: 145 },
  { id: 'case-4', type: 'ABANDONED', x: 260, y: 155 },
  { id: 'case-5', type: 'SIGHTING', x: 210, y: 75 },
];

/**
 * Centro del radar (zona Vedado)
 */
const RADAR_CX = 200;
const RADAR_CY = 120;

/**
 * Calcula el ángulo en grados (0-360) desde el centro del radar hacia un punto
 */
function getAngleFromCenter(x: number, y: number): number {
  const dx = x - RADAR_CX;
  const dy = y - RADAR_CY; // SVG: y crece hacia abajo
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI; // -180 a 180
  if (angle < 0) angle += 360; // 0 a 360
  return angle;
}

/**
 * Calcula el delay de animación basado en el ángulo
 * Barrido: 6s por vuelta completa (360°)
 */
function getSweepDelay(angle: number): number {
  return (angle / 360) * 6; // en segundos
}

/**
 * SVG del icono PawPrint (idéntico al mapa real)
 */
function PawPrintIcon({ 
  type, 
  size = 24, 
  className = '',
  style 
}: { 
  type: CaseType; 
  size?: number; 
  className?: string;
  style?: React.CSSProperties;
}) {
  const { color, fillColor } = CASE_COLORS[type];
  
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fillColor}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{
        filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15))',
        ...style,
      }}
    >
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="20" cy="16" r="2" />
      <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
    </svg>
  );
}

/**
 * Marcador con animación "pop" (scale 0.3→1 + fade)
 * transform-origin en la punta del pin (centro-abajo del icono)
 */
function CaseMarker({ 
  caseData, 
  delay, 
  isProtagonist, 
  protagonistPhase,
  reducedMotion 
}: { 
  caseData: { id: string; type: CaseType; x: number; y: number };
  delay: number;
  isProtagonist: boolean;
  protagonistPhase: 'hidden' | 'lost' | 'found' | 'celebration';
  reducedMotion: boolean;
}) {
  const { type, x, y } = caseData;
  const isLost = type === 'LOST' && isProtagonist;
  const currentType = isLost && protagonistPhase === 'found' ? 'FOUND' : type;
  const { color } = CASE_COLORS[currentType];
  
  // En reduced-motion: mostrar estado final directamente
  if (reducedMotion) {
    return (
      <g transform={`translate(${x}, ${y})`} style={{ transformOrigin: 'center bottom' }}>
        <PawPrintIcon type={currentType} size={28} />
        {/* Pulso en el suelo para el protagonista LOST */}
        {isLost && protagonistPhase === 'found' && (
          <circle
            cx="0"
            cy="14"
            r="18"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeOpacity="0.6"
            className="map-pulse-ring"
          />
        )}
      </g>
    );
  }
  
  // Animación pop: scale 0.3→1 con transform-origin en la punta (centro-abajo)
  // El icono tiene 28px, la punta está aprox en y=14 (centro-abajo)
  const popAnimation = `map-marker-pop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) ${delay}s forwards`;
  const fadeOutAnimation = `map-fade-out 0.5s ease-out ${11.5}s forwards`; // Desvanecer al final del ciclo 12s
  
  return (
    <g 
      transform={`translate(${x}, ${y})`} 
      style={{ 
        transformOrigin: 'center 14px', // Punta del pin (centro-abajo del icono 28px)
        animation: `${popAnimation}, ${fadeOutAnimation}`,
        opacity: 0, // Inicia invisible
      }}
    >
      <PawPrintIcon type={currentType} size={28} />
      {/* Anillo de pulso para el protagonista en fase LOST */}
      {isLost && protagonistPhase === 'lost' && (
        <circle
          cx="0"
          cy="14"
          r="18"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeOpacity="0.6"
          className="map-pulse-ring"
          style={{ animation: 'map-pulse-ring-anim 1.5s ease-out infinite' }}
        />
      )}
    </g>
  );
}

/**
 * Tarjetita flotante tipo píldora para el caso protagonista
 */
function ProtagonistCard({ 
  phase, 
  reducedMotion 
}: { 
  phase: 'lost' | 'found' | 'celebration' | 'hidden';
  reducedMotion: boolean;
}) {
  if (phase === 'hidden' || reducedMotion) {
    if (reducedMotion) {
      // En reduced-motion mostrar estado final
      return (
        <div className="map-floating-card map-card-found" style={{ opacity: 1 }}>
          <span className="map-card-dot found" />
          <span>¡Reencontrada!</span>
        </div>
      );
    }
    return null;
  }
  
  if (phase === 'lost') {
    return (
      <div className="map-floating-card map-card-lost" style={{ 
        animation: 'map-card-slide-in 0.3s ease-out 1.5s forwards',
        opacity: 0,
      }}>
        <span className="map-card-dot lost" />
        <span>Perro mestizo · Perdida</span>
      </div>
    );
  }
  
  if (phase === 'found') {
    return (
      <div className="map-floating-card map-card-found" style={{ 
        animation: 'map-card-slide-in 0.3s ease-out 7s forwards',
        opacity: 0,
      }}>
        <span className="map-card-dot found" />
        <span>¡Reencontrada!</span>
      </div>
    );
  }
  
  return null;
}

/**
 * Confeti simple: 4-6 patitas pequeñas que suben y se desvanecen
 */
function Confetti({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  if (!active || reducedMotion) return null;
  
  const particles = Array.from({ length: 5 }, (_, i) => ({
    id: i,
    delay: i * 0.1,
    xOffset: (Math.random() - 0.5) * 30,
  }));
  
  return (
    <g className="map-confetti">
      {particles.map((p) => (
        <PawPrintIcon
          key={p.id}
          type="FOUND"
          size={16}
          style={{
            position: 'absolute',
            left: `calc(50% + ${p.xOffset}px)`,
            bottom: '20px',
            animation: `map-confetti-rise 0.8s ease-out ${p.delay}s forwards`,
            opacity: 0,
            transformOrigin: 'center bottom',
          }}
        />
      ))}
    </g>
  );
}

/**
 * Chip fijo: "5 casos cerca de ti"
 */
function NearbyCasesChip({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="map-nearby-chip" style={{ 
      animation: reducedMotion ? 'none' : 'map-chip-slide-in 0.5s ease-out 0.5s forwards',
      opacity: reducedMotion ? 1 : 0,
    }}>
      <span className="map-chip-dot" />
      <span>5 casos cerca de ti</span>
    </div>
  );
}

export function MapPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [protagonistPhase, setProtagonistPhase] = useState<'hidden' | 'lost' | 'found' | 'celebration'>('hidden');
  const [showConfetti, setShowConfetti] = useState(false);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verificar prefers-reduced-motion
  useEffect(() => {
    const checkReducedMotion = () => {
      if (typeof window !== 'undefined') {
        setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }
    };
    checkReducedMotion();
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', checkReducedMotion);
    return () => mediaQuery.removeEventListener('change', checkReducedMotion);
  }, []);

  // IntersectionObserver para pausar cuando no es visible
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // VisibilityChange para pausar cuando la pestaña está oculta
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Control del ciclo de historia (12s = 2 vueltas del barrido de 6s)
  useEffect(() => {
    if (reducedMotion) {
      setProtagonistPhase('found');
      return;
    }

    const runCycle = () => {
      // Fase 1: LOST detectado (cuando el barrido pasa ~0.5s después del inicio)
      setProtagonistPhase('lost');
      
      // Fase 2: FOUND a mitad de ciclo (~6s)
      phaseTimerRef.current = setTimeout(() => {
        setProtagonistPhase('found');
        setShowConfetti(true);
        confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 1000);
      }, 6000);

      // Fase 3: Celebration y reinicio al final (~12s)
      cycleTimerRef.current = setTimeout(() => {
        setProtagonistPhase('hidden');
        setShowConfetti(false);
        runCycle(); // Reiniciar ciclo
      }, 12000);
    };

    // Iniciar después de un pequeño delay para que el barrido "llegue" al protagonista
    const initialDelay = setTimeout(runCycle, 500);
    
    return () => {
      clearTimeout(initialDelay);
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    };
  }, [reducedMotion, isVisible, isTabVisible]);

  // Pausar animaciones CSS cuando no visible
  const paused = !isVisible || !isTabVisible;

  // Pre-calcular delays para cada caso
  const casesWithDelays = DEMO_CASES.map((c) => ({
    ...c,
    angle: getAngleFromCenter(c.x, c.y),
    delay: getSweepDelay(getAngleFromCenter(c.x, c.y)),
    isProtagonist: c.type === 'LOST' && c.id === 'case-1',
  }));

  return (
    <div
      ref={containerRef}
      className="map-preview-container"
      role="img"
      aria-label="Vista previa animada del mapa de La Habana con casos cercanos"
      style={{ animationPlayState: paused ? 'paused' : 'running' }}
    >
      <svg
        viewBox="0 0 400 250"
        className="map-preview-svg"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* ========== CAPA 1: MAPA BASE (ESTÁTICO) ========== */}
        
        {/* Mar (arriba) - tono naranja claro */}
        <rect x="0" y="0" width="400" height="100" className="map-sea" />
        
        {/* Tierra (abajo) - tono más claro */}
        <path 
          d="M0,100 Q100,85 200,95 Q300,105 400,90 L400,250 L0,250 Z" 
          className="map-land" 
        />
        
        {/* Costa / Malecón - trazo naranja más fuerte, stroke ~4, round caps */}
        <path 
          d="M0,100 Q100,85 200,95 Q300,105 400,90" 
          className="map-coastline" 
        />
        
        {/* Bahía como entrante a la derecha */}
        <path 
          d="M320,90 Q350,95 360,130 Q350,165 320,170" 
          className="map-bay" 
        />
        
        {/* Faro / Silueta del Morro en la boca de la bahía */}
        <g className="map-lighthouse" transform="translate(335, 110)">
          <rect x="-3" y="0" width="6" height="20" rx="1" />
          <rect x="-5" y="20" width="10" height="4" rx="1" />
          <circle cx="0" cy="2" r="3" className="map-lighthouse-light" />
        </g>
        
        {/* Zonas como manchas suaves con etiquetas */}
        {/* PLAYA (arriba-izquierda) */}
        <ellipse cx="80" cy="140" rx="55" ry="35" className="map-zone" />
        <text x="80" y="145" className="map-zone-label">PLAYA</text>
        
        {/* VEDADO (centro) - donde está el radar */}
        <ellipse cx="200" cy="120" rx="60" ry="30" className="map-zone" />
        <text x="200" y="125" className="map-zone-label">VEDADO</text>
        
        {/* H. VIEJA (abajo-derecha) */}
        <ellipse cx="320" cy="190" rx="50" ry="30" className="map-zone" />
        <text x="320" y="195" className="map-zone-label">H. VIEJA</text>
        
        {/* 5-6 calles en trazo fino (1.5px), ligeramente diagonales */}
        <g className="map-streets">
          <path d="M20,120 L380,130" />
          <path d="M30,150 L370,155" />
          <path d="M40,180 L360,175" />
          <path d="M50,210 L350,200" />
          <path d="M60,235 L340,220" />
          <path d="M300,50 L310,250" />
        </g>
        
        {/* ========== CAPA 2: RADAR ========== */}
        <g className="map-radar" transform={`translate(${RADAR_CX}, ${RADAR_CY})`}>
          {/* Anillos concéntricos finos */}
          <circle r="40" className="map-radar-ring" />
          <circle r="70" className="map-radar-ring" />
          <circle r="100" className="map-radar-ring" />
          
          {/* Cruz punteada */}
          <line x1="-100" y1="0" x2="100" y2="0" className="map-radar-cross" />
          <line x1="0" y1="-100" x2="0" y2="100" className="map-radar-cross" />
          
          {/* Barrido: cuña de ~50°, rota 360° en 6s */}
          <path 
            d="M0,0 L40,0 A40,40 0 0,1 40*cos(50°),40*sin(50°) Z"
            className="map-radar-sweep"
            style={{ 
              // El path real se define con coordenadas calculadas
              // 50° = 0.87266 rad
              d: `M0,0 L40,0 A40,40 0 0,1 ${40 * Math.cos(50 * Math.PI / 180)},${40 * Math.sin(50 * Math.PI / 180)} Z`
            }}
          />
          
          {/* Onda que se expande cada 4s */}
          <circle r="0" className="map-radar-wave" />
          <circle r="0" className="map-radar-wave" style={{ animationDelay: '2s' }} />
          <circle r="0" className="map-radar-wave" style={{ animationDelay: '4s' }} />
          
          {/* Punto central "Tú" con halo */}
          <circle r="12" className="map-radar-halo" />
          <circle r="5" className="map-radar-center" />
          <text x="0" y="-18" className="map-radar-label" textAnchor="middle">Tú</text>
          
          {/* Etiqueta de distancia "300 m" junto a un anillo */}
          <text x="75" y="-5" className="map-distance-label">300 m</text>
        </g>
        
        {/* ========== CAPA 3: CASOS Y HISTORIA ========== */}
        <g className="map-cases-layer">
          {casesWithDelays.map((c) => (
            <CaseMarker
              key={c.id}
              caseData={c}
              delay={c.delay}
              isProtagonist={c.isProtagonist}
              protagonistPhase={protagonistPhase}
              reducedMotion={reducedMotion}
            />
          ))}
          
          {/* Confeti para celebración */}
          <Confetti active={showConfetti} reducedMotion={reducedMotion} />
        </g>
      </svg>
      
      {/* Tarjetita flotante del protagonista (posicionada en % sobre contenedor) */}
      <div 
        className="map-card-container"
        style={{ 
          // Posición relativa al contenedor, escalable
          left: `${(DEMO_CASES[0].x / 400) * 100}%`,
          top: `${(DEMO_CASES[0].y / 250) * 100}%`,
          transform: 'translate(-50%, -120%)', // Centrado horizontal, arriba del marcador
        }}
      >
        <ProtagonistCard phase={protagonistPhase} reducedMotion={reducedMotion} />
      </div>
      
      {/* Chip fijo abajo a la izquierda */}
      <NearbyCasesChip reducedMotion={reducedMotion} />
    </div>
  );
}

export default MapPreview;