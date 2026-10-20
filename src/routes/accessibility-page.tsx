import { useEffect } from 'react';
import { Accessibility, BadgeCheck, HandHeart, TriangleAlert } from 'lucide-react';
import {
  LegalBullets,
  LegalCallout,
  LegalContactLink,
  LegalPage,
  LegalSection,
} from '../components/legal/legal-page';
import { setPageMeta } from '../lib/seo/page-meta';

const SECTIONS = [
  { id: 'compromiso', label: 'Nuestro compromiso' },
  { id: 'medidas', label: 'Medidas implementadas' },
  { id: 'limitaciones', label: 'Limitaciones conocidas' },
  { id: 'compatibilidad', label: 'Compatibilidad' },
  { id: 'evaluacion', label: 'Cómo evaluamos' },
  { id: 'reportar', label: 'Reportar una barrera' },
  { id: 'marco', label: 'Marco normativo' },
  { id: 'cambios', label: 'Actualizaciones' },
];

const RELATED = [
  { href: '/privacidad', label: 'Política de privacidad' },
  { href: '/terminos', label: 'Términos de uso' },
  { href: '/cookies', label: 'Política de cookies' },
];

const MEASURES = [
  {
    title: 'Navegación por teclado',
    text: 'Todos los enlaces, botones, formularios y acordeones se pueden usar con Tab e Intro, sin necesidad de ratón.',
  },
  {
    title: 'Foco visible',
    text: 'El elemento con el que interactúas se marca con un contorno naranja de varios píxeles, también en el tema oscuro.',
  },
  {
    title: 'Contraste y color',
    text: 'Los textos y controles usan combinaciones de color pensadas para mantener la legibilidad, y el tema claro u oscuro se elige sin perder información.',
  },
  {
    title: 'Estructura semántica',
    text: 'El sitio declara el idioma español, usa encabezados jerárquicos, regiones de navegación, un contenido principal y listas reales donde corresponde.',
  },
  {
    title: 'Formularios comprensibles',
    text: 'Cada campo tiene su etiqueta, los errores se explican con texto y los campos obligatorios se identifican. No dependemos solo del color para indicar un estado.',
  },
  {
    title: 'Áreas táctiles amplias',
    text: 'En pantallas pequeñas los botones y enlaces principales tienen al menos 44 píxeles de alto, para reducir pulsaciones accidentales.',
  },
  {
    title: 'Menos movimiento si lo pides',
    text: 'Si tu sistema tiene activada la preferencia de movimiento reducido, desactivamos animaciones, transiciones y el movimiento decorativo.',
  },
  {
    title: 'Textos alternativos',
    text: 'Las imágenes de los casos llevan texto alternativo derivado del título y de la descripción cuando existe. Los iconos decorativos se marcan para que no se anuncien.',
  },
  {
    title: 'Diseño adaptable',
    text: 'La interfaz funciona en móvil, tableta y escritorio, y está pensada para adaptarse al zoom del texto y a pantallas pequeñas.',
  },
  {
    title: 'Enlace para saltar al contenido',
    text: 'Con el teclado, la primera parada permite saltar directamente al contenido principal sin recorrer toda la navegación.',
  },
];

const LIMITATIONS = [
  'El mapa interactivo se apoya en Leaflet y OpenStreetMap: su navegación con teclado y lectores de pantalla es limitada. Por eso los casos también están disponibles en el buscador y en listas con la misma información y la zona aproximada.',
  'Las fotos subidas por otras personas pueden tener descripciones poco específicas. Cuando detectamos una imagen sin texto útil, la tratamos como decorativa para no leer información engañosa.',
  'El contenido importado de Telegram o Facebook puede incluir imágenes o formatos que no controlamos y que no siempre cumplen nuestras pautas.',
  'Algunos textos legales son densos por naturaleza. Si necesitas una explicación en lenguaje sencillo de cualquier punto, escríbenos y te la damos.',
  'Los recursos de terceros (tipografías de Google, teselas de OpenStreetMap) pueden fallar o ralentizarse según tu conexión; el contenido principal sigue siendo legible sin ellos.',
];

const frameWork = [
  'Constitución de la República de Cuba, artículo 42: igualdad y prohibición de discriminación, incluida la basada en discapacidad.',
  'Convención Internacional sobre los Derechos de las Personas con Discapacidad de la ONU, de la que Cuba es Estado parte, en especial su artículo 9 sobre accesibilidad.',
  'Pautas de Accesibilidad para el Contenido Web (WCAG) 2.2, nivel AA, del W3C, como referencia técnica principal.',
  'Norma europea EN 301 549 y Section 508 de Estados Unidos, cuando resulten aplicables a usuarios de esas jurisdicciones.',
];

export function AccessibilityPage() {
  useEffect(() => {
    setPageMeta({
      title: 'Declaración de accesibilidad — Patitas',
      description:
        'Compromiso de accesibilidad de Patitas: medidas implementadas, limitaciones conocidas, compatibilidad con lectores de pantalla y cómo reportar una barrera.',
      canonicalPath: '/accesibilidad',
    });
  }, []);

  return (
    <LegalPage
      eyebrow="Documento legal"
      title="Declaración de accesibilidad"
      intro="Patitas busca que cualquier persona pueda publicar o encontrar una mascota, también si usa lector de pantalla, teclado, zoom o movimiento reducido. Esta página explica qué hacemos, qué falta y cómo avisarnos."
      updated="20 de octubre de 2026"
      icon={Accessibility}
      accent="found"
      sections={SECTIONS}
      related={RELATED}
    >
      <LegalCallout icon={BadgeCheck} title="Objetivo: WCAG 2.2 nivel AA" tone="success">
        Trabajamos para cumplir las pautas WCAG 2.2 en nivel AA en las funciones principales:
        publicar, buscar, ver un caso, contactar y adoptar.
      </LegalCallout>

      <LegalSection id="compromiso" title="1. Nuestro compromiso">
        <p>
          La accesibilidad no es un extra: si una persona con discapacidad no puede publicar el caso
          de su mascota, la plataforma falla en su propósito. Por eso revisamos el diseño y el código
          con criterios de accesibilidad y corregimos las barreras que conocemos.
        </p>
        <p>
          Reconocemos que no somos perfectos y que parte del contenido lo aportan usuarios y fuentes
          externas. Preferimos declarar las limitaciones con claridad antes que afirmar un
          cumplimiento total que no podemos garantizar.
        </p>
      </LegalSection>

      <LegalSection id="medidas" title="2. Medidas implementadas">
        <div className="grid gap-4 sm:grid-cols-2">
          {MEASURES.map((measure) => (
            <div
              key={measure.title}
              className="rounded-2xl border-2 border-foreground/10 bg-surface p-5 shadow-sm"
            >
              <h3 className="mb-1.5 font-display text-base font-bold text-foreground">
                {measure.title}
              </h3>
              <p className="text-sm leading-relaxed text-foreground/75">{measure.text}</p>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection id="limitaciones" title="3. Limitaciones conocidas">
        <p>Estas son las barreras que identificamos hoy y cómo las compensamos:</p>
        <LegalBullets items={LIMITATIONS} />
        <LegalCallout icon={TriangleAlert} title="Si una barrera te impide usar Patitas" tone="warning">
          Escríbenos y buscamos una alternativa, incluida la publicación del caso por nuestra parte
          con la información que nos facilites por correo.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="compatibilidad" title="4. Compatibilidad y tecnologías de asistencia">
        <p>
          El sitio está pensado para las versiones recientes de Chrome, Edge, Firefox y Safari, en
          escritorio y en móvil. Usamos HTML semántico y atributos ARIA puntuales, de modo que debería
          funcionar con lectores de pantalla como NVDA, JAWS, VoiceOver y TalkBack, y con navegación
          por teclado o control por voz.
        </p>
        <p>
          No hemos realizado una auditoría exhaustiva con todos los productos de apoyo existentes. Si
          usas una combinación concreta y algo no funciona, cuéntanoslo: es la forma más rápida de
          corregirlo.
        </p>
      </LegalSection>

      <LegalSection id="evaluacion" title="5. Cómo evaluamos la accesibilidad">
        <LegalBullets
          items={[
            'Revisión manual con navegación solo por teclado en las rutas principales: inicio, buscador, mapa, publicar, perfil, adopciones y legales.',
            'Comprobación de contraste, foco visible y jerarquía de encabezados con las herramientas del navegador.',
            'Revisión del comportamiento con zoom y en pantallas pequeñas.',
            'Revisión de la preferencia de movimiento reducido y del cambio de tema.',
            'Revisión de formularios y mensajes de error para que no dependan solo del color.',
          ]}
        />
        <p>
          No contamos con una certificación externa de accesibilidad. Esta declaración refleja una
          revisión interna honesta, no un sello de conformidad.
        </p>
      </LegalSection>

      <LegalSection id="reportar" title="6. Cómo reportar una barrera">
        <p>
          Si encuentras un problema de accesibilidad, escríbenos a <LegalContactLink /> con el asunto
          «Accesibilidad». Incluye, si puedes:
        </p>
        <LegalBullets
          items={[
            'La URL o la pantalla donde ocurre.',
            'Qué intentabas hacer y qué esperabas.',
            'El navegador, el dispositivo y, si usas uno, el producto de apoyo (NVDA, VoiceOver, etc.).',
            'Una descripción del problema; si es visual, una captura ayuda.',
          ]}
        />
        <p>
          Respondemos en un plazo de hasta 10 días hábiles. Si la corrección requiere más tiempo, te
          lo diremos y te ofreceremos una alternativa mientras tanto. También puedes abrir un issue en
          el repositorio del proyecto, pero evita incluir datos personales en un espacio público.
        </p>
      </LegalSection>

      <LegalSection id="marco" title="7. Marco normativo">
        <p>
          Nuestro compromiso se apoya en estas referencias, aplicadas con especial atención a Cuba y a
          los usuarios de otras jurisdicciones:
        </p>
        <LegalBullets items={frameWork} />
        <p>
          La accesibilidad también se relaciona con el derecho a la igualdad y a la no discriminación.
          Si consideras que una barrera vulnera tus derechos, además de escribirnos puedes acudir a los
          mecanismos de protección que reconoce la ley cubana y, si resides fuera de Cuba, a la
          autoridad de tu país.
        </p>
      </LegalSection>

      <LegalSection id="cambios" title="8. Actualizaciones de esta declaración">
        <p>
          Actualizaremos esta página cuando cambien las medidas, las limitaciones o los resultados de
          una revisión. La fecha al inicio indica la última versión. Si quieres conocer el detalle de
          una corrección concreta, pregúntanos.
        </p>
        <LegalCallout icon={HandHeart} title="La accesibilidad se construye con tu ayuda" tone="info">
          Cada reporte sobre una barrera real nos permite mejorar para la siguiente persona. Gracias
          por tomarte el tiempo de contarlo.
        </LegalCallout>
      </LegalSection>
    </LegalPage>
  );
}

export default AccessibilityPage;
