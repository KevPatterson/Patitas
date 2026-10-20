import { useEffect } from 'react';
import { Camera, MapPin, Bell, Eye, ShieldCheck, Share2, Flag, CheckCircle, PawPrint } from 'lucide-react';
import { LinkButton } from '../components/ui/button';
import { setPageMeta } from '../lib/seo/page-meta';

const SECTIONS = [
  {
    icon: Camera,
    color: 'orange',
    title: 'Publica en minutos',
    text: 'Describe a la mascota paso a paso: especie, color, zona, fotos y cómo contactarte. Sin conocimientos técnicos.',
  },
  {
    icon: MapPin,
    color: 'turquoise',
    title: 'Todo geolocalizado y buscable',
    text: 'Cada caso aparece en el mapa y en el buscador con filtros por tipo, animal, provincia, fecha y más. Nada se pierde.',
  },
  {
    icon: Bell,
    color: 'purple',
    title: 'Coincidencias automáticas',
    text: 'Cuando alguien publica un caso compatible (misma especie, zona y características), Patitas te avisa.',
  },
  {
    icon: Eye,
    color: 'found',
    title: 'Avistamientos con línea temporal',
    text: 'Si alguien vio a tu mascota, puede reportarlo. Cada avistamiento se suma a una línea temporal que ayuda a seguir su rastro.',
  },
  {
    icon: ShieldCheck,
    color: 'navy',
    title: 'Tu privacidad primero',
    text: 'Nunca mostramos tu dirección exacta: las ubicaciones se difuminan automáticamente. Tu teléfono y correo solo se muestran si tú lo decides.',
  },
  {
    icon: Share2,
    color: 'orange',
    title: 'Comparte con un enlace',
    text: 'Cada publicación tiene un enlace único listo para compartir por WhatsApp, Facebook o Telegram.',
  },
  {
    icon: Flag,
    color: 'lost',
    title: 'Comunidad cuidada',
    text: 'Un equipo de moderación revisa cada reporte para evitar que cualquier persona pueda reportar publicaciones falsas o spam.',
  },
  {
    icon: CheckCircle,
    color: 'found',
    title: 'Los finales felices se celebran',
    text: 'Cuando una mascota vuelve a casa, el caso se marca como resuelto y queda como una historia de esperanza para la comunidad.',
  },
];

const colorClasses: Record<string, string> = {
  orange: 'bg-orange/10 text-orange',
  turquoise: 'bg-turquoise/10 text-turquoise',
  purple: 'bg-purple/10 text-purple',
  found: 'bg-found/10 text-found',
  lost: 'bg-lost/10 text-lost',
  navy: 'bg-foreground/10 text-foreground',
};

export function HowItWorksPage() {
  useEffect(() => {
    setPageMeta({
      title: 'Cómo funciona — Patitas',
      description:
        'Descubre cómo Patitas centraliza casos de mascotas perdidas, encontradas, abandonadas y en adopción para que ninguna publicación se pierda. Publica, recibe coincidencias y comparte.',
      canonicalPath: '/como-funciona',
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-orange/10 via-app to-turquoise/10 border-2 border-foreground/10 p-8 md:p-12 shadow-md">
        <div className="blob-decoration absolute top-5 right-5 size-32 bg-purple/20" />
        <div className="blob-decoration absolute bottom-5 left-5 size-24 bg-orange/15" style={{ animationDelay: '2s' }} />
        
        <div className="relative space-y-4">
          <div className="flex items-center gap-2">
            <PawPrint className="size-6 text-orange animate-paw-bounce" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Guía completa</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold text-foreground">
            Cómo funciona Patitas
          </h1>
          <p className="text-lg text-foreground/70 leading-relaxed max-w-2xl">
            Patitas es el lugar donde buscas cuando una mascota desaparece. Centralizamos los casos para que ninguna publicación se pierda.
          </p>
        </div>
      </div>

      {/* Secciones */}
      <div className="space-y-6">
        {SECTIONS.map((section, i) => (
          <div 
            key={section.title} 
            className="group rounded-2xl border-2 border-foreground/10 bg-surface p-6 md:p-8 shadow-md hover:shadow-lg transition-all duration-base hover:-translate-y-1"
          >
            <div className="flex gap-5">
              <div className="shrink-0">
                <div className={`size-14 rounded-2xl ${colorClasses[section.color]} flex items-center justify-center transition-transform duration-base group-hover:scale-110`}>
                  <section.icon className="size-7" aria-hidden="true" />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <h2 className="font-display text-2xl font-extrabold text-foreground">
                  <span className="text-orange mr-2">{String(i + 1).padStart(2, '0')}</span>
                  {section.title}
                </h2>
                <p className="text-foreground/70 leading-relaxed">
                  {section.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA final */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-orange to-orange-dark p-10 md:p-12 text-center shadow-xl">
        <div className="blob-decoration absolute top-10 right-10 size-32 bg-white/10" />
        <div className="relative space-y-6">
          <div className="flex justify-center">
            <div className="size-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center animate-paw-bounce">
              <PawPrint className="size-8 text-white" />
            </div>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white">
            Ayudemos a que vuelvan a casa
          </h2>
          <p className="text-white/90 text-lg max-w-xl mx-auto">
            Cada caso publicado es un paso más cerca del reencuentro. Juntos hacemos la diferencia.
          </p>
          <LinkButton 
            href="/publicar" 
            variant="ghost"
            className="bg-white hover:bg-white/90 text-orange font-extrabold shadow-lg"
          >
            <PawPrint className="size-5" />
            Publicar un caso
          </LinkButton>
        </div>
      </div>

      {/* Info adicional */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border-2 border-turquoise/20 bg-turquoise/5 p-6 text-center">
          <div className="size-12 rounded-xl bg-turquoise/10 flex items-center justify-center mx-auto mb-3">
            <MapPin className="size-6 text-turquoise" />
          </div>
          <h3 className="font-display text-lg font-bold text-foreground mb-2">Geolocalizado</h3>
          <p className="text-sm text-foreground/70">Encuentra casos cerca de ti con el mapa interactivo</p>
        </div>

        <div className="rounded-2xl border-2 border-purple/20 bg-purple/5 p-6 text-center">
          <div className="size-12 rounded-xl bg-purple/10 flex items-center justify-center mx-auto mb-3">
            <Bell className="size-6 text-purple" />
          </div>
          <h3 className="font-display text-lg font-bold text-foreground mb-2">Notificaciones</h3>
          <p className="text-sm text-foreground/70">Recibe alertas cuando hay coincidencias con tu caso</p>
        </div>

        <div className="rounded-2xl border-2 border-found/20 bg-found/5 p-6 text-center">
          <div className="size-12 rounded-xl bg-found/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="size-6 text-found" />
          </div>
          <h3 className="font-display text-lg font-bold text-foreground mb-2">Historias felices</h3>
          <p className="text-sm text-foreground/70">Celebramos cada reencuentro en la comunidad</p>
        </div>
      </div>
    </div>
  );
}

export default HowItWorksPage;
