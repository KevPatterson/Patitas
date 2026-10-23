import { useEffect } from 'react';
import { ChevronDown, PawPrint, Search } from 'lucide-react';
import { LinkButton } from '../components/ui/button';
import { ScrollReveal } from '../components/ui/scroll-reveal';
import { setPageMeta } from '../lib/seo/page-meta';
import {
  generateFaqStructuredData,
  injectStructuredData,
  removeStructuredData,
} from '../lib/seo/structured-data';
import { SITE_URL } from '../lib/config/site';

type FaqItem = {
  question: string;
  answer: string;
};

type FaqCategory = {
  title: string;
  items: FaqItem[];
};

const CATEGORIES: FaqCategory[] = [
  {
    title: 'Empezar en Patitas',
    items: [
      {
        question: '¿Qué es Patitas?',
        answer:
          'Una plataforma comunitaria para publicar y buscar mascotas perdidas, encontradas, avistadas y en adopción. Cada caso aparece en el buscador y en el mapa, y la comunidad puede comentar y reportar avistamientos.',
      },
      {
        question: '¿Cuánto cuesta usarla?',
        answer:
          'Nada. Patitas es gratuita para publicar, buscar y adoptar. Si alguien te pide dinero para "liberar" una publicación o una mascota, desconfía y repórtalo.',
      },
      {
        question: '¿Necesito crear una cuenta?',
        answer:
          'Para explorar el buscador, el mapa y las adopciones no hace falta. Necesitas iniciar sesión para publicar, comentar, registrar avistamientos y enviar solicitudes de adopción.',
      },
      {
        question: '¿Qué tipo de casos puedo publicar?',
        answer:
          'Mascotas perdidas, encontradas, avistamientos y adopciones. Cada tipo tiene su propio formulario, así que la información que se pide es la que realmente ayuda a encontrar o reubicar al animal.',
      },
      {
        question: '¿Cómo publico mi caso paso a paso?',
        answer:
          'Entra en Publicar caso, completa el asistente (características, zona y fotos) y guarda. Puedes volver a editarlo o marcarlo como resuelto desde tu panel cuando la mascota vuelva a casa.',
      },
    ],
  },
  {
    title: 'Privacidad y datos',
    items: [
      {
        question: '¿Se ve la dirección exacta donde perdí a mi mascota?',
        answer:
          'No. La ubicación se difumina automáticamente antes de guardarse: solo se publica una zona aproximada. El mapa nunca muestra la coordenada exacta.',
      },
      {
        question: '¿Quién puede ver mi teléfono o mi correo?',
        answer:
          'Nadie de forma directa. Esos datos no se pueden consultar por la API pública: solo se leen cuando alguien decide revelar el contacto de una publicación, y cada acceso queda registrado.',
      },
      {
        question: '¿Hay un límite para revelar contactos?',
        answer:
          'Sí. Cada cuenta tiene una cuota de 30 revelaciones cada 24 horas para evitar que alguien coseche datos de contacto en masa. El dueño de la publicación y el equipo de moderación no consumen cuota.',
      },
      {
        question: '¿Qué pasa con los datos de mis fotos?',
        answer:
          'Al subir una imagen se limpia su información EXIF, incluida cualquier ubicación GPS, así que una foto tomada en casa no revela dónde vives. Si la imagen lleva GPS, se rechaza.',
      },
    ],
  },
  {
    title: 'Ayuda y comunidad',
    items: [
      {
        question: '¿Cómo me avisan si aparece un caso parecido al mío?',
        answer:
          'Con notificaciones. Cuando se publica un caso compatible con el tuyo, recibes un aviso y un contador aparece en la navegación.',
      },
      {
        question: '¿Cómo reporto una publicación falsa o abusiva?',
        answer:
          'Usa el botón de reporte que hay en la publicación. Los reportes llegan a moderación, que puede ocultar o retirar el contenido y dejar registro de la acción.',
      },
      {
        question: '¿Qué hago para adoptar o dar en adopción de forma segura?',
        answer:
          'Revisa los consejos de seguridad antes de concretar una entrega: verifica al animal, acuerda el encuentro en un lugar público y no entregues ni pagues nada por adelantado.',
      },
      {
        question: '¿Puedo proponer mejoras o reportar un error de la web?',
        answer:
          'Sí. Escríbenos por la página de contacto; toda ayuda para que la plataforma funcione mejor es bienvenida.',
      },
    ],
  },
];

const ALL_FAQ_ITEMS = CATEGORIES.flatMap((category) => category.items);

export function FaqPage() {
  useEffect(() => {
    setPageMeta({
      title: 'Preguntas frecuentes — Patitas',
      description:
        'Respuestas sobre cómo publicar y buscar mascotas en Patitas, qué datos son privados, cómo funcionan las notificaciones y las adopciones responsables.',
      canonicalPath: '/preguntas-frecuentes',
    });

    // FAQPage permite que los asistentes citen respuestas literales de la página
    // en lugar de reconstruirlas desde fragmentos de la interfaz.
    injectStructuredData(
      generateFaqStructuredData(ALL_FAQ_ITEMS, `${SITE_URL}/preguntas-frecuentes`),
      'faq-structured-data'
    );

    return () => removeStructuredData('faq-structured-data');
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-12 py-10">
      <div className="relative overflow-hidden rounded-3xl border-2 border-foreground/10 bg-linear-to-br from-orange/10 via-app to-turquoise/10 p-8 shadow-md md:p-12">
        <div className="blob-decoration absolute right-5 top-5 size-32 bg-purple/20" />
        <div className="blob-decoration absolute bottom-5 left-5 size-24 bg-orange/15" style={{ animationDelay: '2s' }} />

        <div className="relative space-y-4">
          <div className="flex items-center gap-2">
            <Search className="size-6 text-orange animate-paw-bounce" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
              Centro de ayuda
            </span>
          </div>
          <h1 className="font-display text-4xl font-extrabold text-foreground md:text-5xl">
            Preguntas frecuentes
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-foreground/70">
            Todo lo que suele preguntarse la comunidad antes de publicar, buscar o adoptar.
            ¿No encuentras tu respuesta? Escríbenos y la añadimos.
          </p>
        </div>
      </div>

      {CATEGORIES.map((category) => (
        <ScrollReveal key={category.title}>
          <section className="space-y-4" aria-label={category.title}>
            <h2 className="font-display text-2xl font-extrabold text-foreground">
              {category.title}
            </h2>
            <div className="space-y-3">
              {category.items.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-2xl border-2 border-foreground/10 bg-surface shadow-md transition-colors duration-base open:border-orange/40"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-display text-lg font-bold text-foreground [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <ChevronDown
                      className="size-5 shrink-0 text-orange transition-transform duration-base group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="px-5 pb-5 leading-relaxed text-foreground/70">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </ScrollReveal>
      ))}

      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-orange to-orange-dark p-10 text-center shadow-xl md:p-12">
        <div className="blob-decoration absolute right-10 top-10 size-32 bg-white/10" />
        <div className="relative space-y-6">
          <div className="flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm animate-paw-bounce">
              <PawPrint className="size-8 text-white" />
            </div>
          </div>
          <h2 className="font-display text-3xl font-extrabold text-white md:text-4xl">
            ¿Sigues con dudas?
          </h2>
          <p className="mx-auto max-w-xl text-lg text-white/90">
            Cuéntanos qué necesitas y te ayudamos a publicar o encontrar ese caso.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton href="/contacto" variant="ghost" className="bg-white text-orange font-extrabold shadow-lg hover:bg-white/90">
              Escríbenos
            </LinkButton>
            <LinkButton href="/seguridad" variant="ghost" className="bg-white/15 text-white font-extrabold hover:bg-white/25">
              Consejos de seguridad
            </LinkButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FaqPage;
