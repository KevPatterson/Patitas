import { useEffect } from 'react';
import { Mail, MessagesSquare, MessageSquareWarning, PawPrint, Send } from 'lucide-react';
import { LinkButton } from '../components/ui/button';
import { ScrollReveal } from '../components/ui/scroll-reveal';
import { setPageMeta } from '../lib/seo/page-meta';

const CONTACT_EMAIL = 'kevinpatterson618@gmail.com';
const REPO_URL = 'https://github.com/KevPatterson/Patitas---Plataforma-de-mascotas';

const CHANNELS = [
  {
    icon: Mail,
    color: 'orange',
    title: 'Correo',
    text: 'Para dudas generales, retirada de contenido o cualquier asunto que no encaje en los otros canales.',
    action: { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  },
  {
    icon: MessageSquareWarning,
    color: 'lost',
    title: 'Reportar un error',
    text: 'Si algo de la web no funciona como debería, cuéntanoslo con el mayor detalle posible para poder reproducirlo.',
    action: { label: 'Abrir un issue', href: `${REPO_URL}/issues/new` },
  },
  {
    icon: MessagesSquare,
    color: 'purple',
    title: 'Ideas y propuestas',
    text: 'Sugerencias de nuevas funciones, mejoras de accesibilidad o cambios en la experiencia de uso.',
    action: { label: 'Ir a las discusiones', href: `${REPO_URL}/discussions` },
  },
];

const INCLUDE = [
  'Qué intentabas hacer y en qué página estabas.',
  'Qué esperabas que ocurriera y qué ocurrió realmente.',
  'El enlace de la publicación o del perfil, si el asunto está relacionado con uno.',
  'Tu navegador y dispositivo, si es un problema visual o de rendimiento.',
];

const colorClasses: Record<string, string> = {
  orange: 'bg-orange/10 text-orange',
  lost: 'bg-lost/10 text-lost',
  purple: 'bg-purple/10 text-purple',
};

export function ContactPage() {
  useEffect(() => {
    setPageMeta({
      title: 'Contacto — Patitas',
      description:
        'Canales de contacto de Patitas para dudas, reportar errores, proponer mejoras o solicitar la retirada de contenido.',
      canonicalPath: '/contacto',
    });
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-12 py-10">
      <div className="relative overflow-hidden rounded-3xl border-2 border-foreground/10 bg-linear-to-br from-orange/10 via-app to-purple/10 p-8 shadow-md md:p-12">
        <div className="blob-decoration absolute right-5 top-5 size-32 bg-orange/20" />
        <div className="blob-decoration absolute bottom-5 left-5 size-24 bg-purple/15" style={{ animationDelay: '2s' }} />

        <div className="relative space-y-4">
          <div className="flex items-center gap-2">
            <Send className="size-6 text-orange animate-paw-bounce" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
              Hablemos
            </span>
          </div>
          <h1 className="font-display text-4xl font-extrabold text-foreground md:text-5xl">
            Contacto
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-foreground/70">
            ¿Una duda, un error o una idea para mejorar Patitas? Estos son los canales por los
            que llega todo al equipo.
          </p>
        </div>
      </div>

      <ScrollReveal>
        <section className="grid gap-6 md:grid-cols-3" aria-label="Canales de contacto">
          {CHANNELS.map((channel) => (
            <div
              key={channel.title}
              className="flex flex-col rounded-2xl border-2 border-foreground/10 bg-surface p-6 shadow-md transition-all duration-base hover:-translate-y-1 hover:shadow-lg"
            >
              <div className={`mb-4 flex size-12 items-center justify-center rounded-xl ${colorClasses[channel.color]}`}>
                <channel.icon className="size-6" aria-hidden="true" />
              </div>
              <h2 className="mb-2 font-display text-lg font-bold text-foreground">{channel.title}</h2>
              <p className="mb-5 flex-1 text-sm leading-relaxed text-foreground/70">{channel.text}</p>
              <a
                href={channel.action.href}
                target={channel.action.href.startsWith('mailto:') ? undefined : '_blank'}
                rel={channel.action.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                className="break-words font-semibold text-orange transition-colors duration-base hover:text-orange-dark"
              >
                {channel.action.label}
              </a>
            </div>
          ))}
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section
          className="space-y-5 rounded-3xl border-2 border-foreground/10 bg-surface p-8 shadow-md"
          aria-label="Qué incluir en tu mensaje"
        >
          <h2 className="font-display text-2xl font-extrabold text-foreground">
            Para que te ayudemos más rápido
          </h2>
          <ul className="space-y-3" role="list">
            {INCLUDE.map((item) => (
              <li key={item} className="flex gap-3 leading-relaxed text-foreground/80">
                <PawPrint className="mt-1 size-4 shrink-0 text-orange" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p className="rounded-2xl border-2 border-orange/20 bg-orange/5 p-4 text-sm leading-relaxed text-foreground/80">
            Si necesitas retirar contenido por derechos de autor, privacidad o datos inexactos,
            escríbenos al correo indicando el enlace y el motivo. Para asuntos urgentes sobre una
            mascota, publica el caso: la comunidad lo verá antes que cualquier correo.
          </p>
        </section>
      </ScrollReveal>

      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-orange to-orange-dark p-10 text-center shadow-xl md:p-12">
        <div className="blob-decoration absolute right-10 top-10 size-32 bg-white/10" />
        <div className="relative space-y-6">
          <div className="flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm animate-paw-bounce">
              <PawPrint className="size-8 text-white" />
            </div>
          </div>
          <h2 className="font-display text-3xl font-extrabold text-white md:text-4xl">
            Mientras tanto, ayuda a que vuelvan a casa
          </h2>
          <p className="mx-auto max-w-xl text-lg text-white/90">
            Publicar un caso es la forma más rápida de que la comunidad empiece a buscar.
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
              href="/como-funciona"
              variant="ghost"
              className="bg-white/15 text-white font-extrabold hover:bg-white/25"
            >
              Cómo funciona
            </LinkButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContactPage;
