import { useEffect } from 'react';
import {
  BadgeCheck,
  Camera,
  Eye,
  Flag,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { LinkButton } from '../components/ui/button';
import { ScrollReveal } from '../components/ui/scroll-reveal';
import { setPageMeta } from '../lib/seo/page-meta';

const PRIVACY = [
  {
    icon: MapPin,
    color: 'turquoise',
    title: 'Ubicación difuminada',
    text: 'La dirección exacta nunca se guarda. Lo que ves en el mapa es una zona aproximada, no el punto donde se escaneó.',
  },
  {
    icon: Phone,
    color: 'orange',
    title: 'Contacto bajo tu control',
    text: 'Tu teléfono y tu correo no se pueden consultar directamente. Solo se muestran cuando decides revelar el contacto, con cuota y registro de cada acceso.',
  },
  {
    icon: Camera,
    color: 'purple',
    title: 'Fotos sin metadatos',
    text: 'Al subir una imagen se limpia su EXIF, incluido el GPS. Si una foto lleva ubicación incrustada, se rechaza antes de publicarse.',
  },
];

const CHECKLIST = [
  {
    icon: Eye,
    title: 'Confirma que es tu mascota',
    text: 'Pide fotos o vídeos recientes, no solo una imagen antigua. Pregunta por señas concretas (manchas, cicatrices, collar) que solo el dueño conocería.',
  },
  {
    icon: Users,
    title: 'Queda en un lugar público y de día',
    text: 'Elige un sitio concurrido y con gente, avisa a alguien de confianza y, si puedes, ve acompañado.',
  },
  {
    icon: BadgeCheck,
    title: 'Verifica la identidad del animal',
    text: 'Comprueba vacunas, cartilla o microchip si los tiene. Una entrega responsable incluye esta conversación, no la evita.',
  },
  {
    icon: Flag,
    title: 'Documenta el encuentro',
    text: 'Guarda capturas de la conversación y una foto del momento de la entrega. Si algo sale mal, ayudan a moderación.',
  },
];

const RED_FLAGS = [
  'Te piden dinero por adelantado para "liberar" la mascota, pagar un "rescate" o una "reserva".',
  'Se niegan a mostrar el animal en vivo o a que lo veas en persona.',
  'El contacto de la publicación cambia o aparece en otra cuenta con el mismo caso.',
  'Ofrecen la mascota "solo hoy" y presionan para que decidas sin comprobar nada.',
  'En las fotos se ven documentos, matrículas o datos personales de terceros.',
];

const colorClasses: Record<string, string> = {
  orange: 'bg-orange/10 text-orange',
  turquoise: 'bg-turquoise/10 text-turquoise',
  purple: 'bg-purple/10 text-purple',
};

export function SecurityPage() {
  useEffect(() => {
    setPageMeta({
      title: 'Consejos de seguridad — Patitas',
      description:
        'Cómo cuidamos tu privacidad en Patitas y qué comprobar antes de concretar un encuentro para recuperar o entregar una mascota.',
      canonicalPath: '/seguridad',
    });
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-12 py-10">
      <div className="relative overflow-hidden rounded-3xl border-2 border-foreground/10 bg-linear-to-br from-found/10 via-app to-orange/10 p-8 shadow-md md:p-12">
        <div className="blob-decoration absolute right-5 top-5 size-32 bg-found/20" />
        <div className="blob-decoration absolute bottom-5 left-5 size-24 bg-orange/15" style={{ animationDelay: '2s' }} />

        <div className="relative space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-6 text-found animate-paw-bounce" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
              Tu seguridad primero
            </span>
          </div>
          <h1 className="font-display text-4xl font-extrabold text-foreground md:text-5xl">
            Consejos de seguridad
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-foreground/70">
            Reencontrar una mascota mueve emociones, y eso es justo lo que aprovechan los
            estafadores. Aquí tienes cómo protegemos tus datos y qué comprobar antes de quedar.
          </p>
        </div>
      </div>

      <ScrollReveal>
        <section className="space-y-6" aria-label="Cómo protegemos tus datos">
          <h2 className="font-display text-2xl font-extrabold text-foreground">
            Lo que Patitas ya hace por ti
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {PRIVACY.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border-2 border-foreground/10 bg-surface p-6 shadow-md transition-all duration-base hover:-translate-y-1 hover:shadow-lg"
              >
                <div className={`mb-4 flex size-12 items-center justify-center rounded-xl ${colorClasses[item.color]}`}>
                  <item.icon className="size-6" aria-hidden="true" />
                </div>
                <h3 className="mb-2 font-display text-lg font-bold text-foreground">{item.title}</h3>
                <p className="text-sm leading-relaxed text-foreground/70">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="space-y-6" aria-label="Antes de concretar un encuentro">
          <h2 className="font-display text-2xl font-extrabold text-foreground">
            Antes de concretar un encuentro
          </h2>
          <div className="space-y-4">
            {CHECKLIST.map((item) => (
              <div
                key={item.title}
                className="flex gap-5 rounded-2xl border-2 border-foreground/10 bg-surface p-6 shadow-md"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-orange/10 text-orange">
                  <item.icon className="size-6" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-bold text-foreground">{item.title}</h3>
                  <p className="leading-relaxed text-foreground/70">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section
          className="space-y-5 rounded-3xl border-2 border-lost/20 bg-lost/5 p-8"
          aria-label="Señales de alerta"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-lost/10 text-lost">
              <TriangleAlert className="size-6" aria-hidden="true" />
            </div>
            <h2 className="font-display text-2xl font-extrabold text-foreground">
              Señales de alerta
            </h2>
          </div>
          <ul className="space-y-3" role="list">
            {RED_FLAGS.map((flag) => (
              <li key={flag} className="flex gap-3 leading-relaxed text-foreground/80">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-lost" aria-hidden="true" />
                {flag}
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground/70">
            <Lock className="size-4 text-lost" aria-hidden="true" />
            Ante cualquiera de estas señales, corta el contacto y reporta la publicación.
          </p>
        </section>
      </ScrollReveal>

      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-orange to-orange-dark p-10 text-center shadow-xl md:p-12">
        <div className="blob-decoration absolute right-10 top-10 size-32 bg-white/10" />
        <div className="relative space-y-6">
          <div className="flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm animate-paw-bounce">
              <ShieldCheck className="size-8 text-white" />
            </div>
          </div>
          <h2 className="font-display text-3xl font-extrabold text-white md:text-4xl">
            Un reencuentro seguro es posible
          </h2>
          <p className="mx-auto max-w-xl text-lg text-white/90">
            Compartir la información correcta y comprobar antes de quedar protege a tu mascota
            y a quien te ayuda a encontrarla.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton
              href="/publicar"
              variant="ghost"
              className="bg-white text-orange font-extrabold shadow-lg hover:bg-white/90"
            >
              Publicar un caso
            </LinkButton>
            <LinkButton
              href="/preguntas-frecuentes"
              variant="ghost"
              className="bg-white/15 text-white font-extrabold hover:bg-white/25"
            >
              Ver preguntas frecuentes
            </LinkButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SecurityPage;
