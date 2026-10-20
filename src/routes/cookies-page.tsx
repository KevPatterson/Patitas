import { useEffect } from 'react';
import { Cookie, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import {
  LegalBullets,
  LegalCallout,
  LegalContactLink,
  LegalPage,
  LegalSection,
} from '../components/legal/legal-page';
import { setPageMeta } from '../lib/seo/page-meta';

const SECTIONS = [
  { id: 'que-son', label: 'Qué son y qué no usamos' },
  { id: 'base', label: 'Base legal y consentimiento' },
  { id: 'propias', label: 'Almacenamiento propio' },
  { id: 'terceros', label: 'Recursos de terceros' },
  { id: 'servidor', label: 'Contadores en el servidor' },
  { id: 'gestion', label: 'Cómo borrarlas o bloquearlas' },
  { id: 'cambios', label: 'Cambios en esta política' },
  { id: 'contacto', label: 'Contacto' },
];

const RELATED = [
  { href: '/privacidad', label: 'Política de privacidad' },
  { href: '/terminos', label: 'Términos de uso' },
  { href: '/accesibilidad', label: 'Accesibilidad' },
];

const STORAGE_ROWS = [
  {
    name: 'sb-<proyecto>-auth-token',
    type: 'localStorage',
    purpose: 'Mantener tu sesión iniciada: guarda el token de acceso y el de refresco que emite Supabase Auth.',
    duration: 'Hasta que cierres sesión o caduque el token.',
  },
  {
    name: 'patitas-theme',
    type: 'localStorage',
    purpose: 'Recordar si prefieres el tema claro u oscuro.',
    duration: 'Hasta que borres los datos del sitio.',
  },
  {
    name: 'userLocation',
    type: 'localStorage',
    purpose: 'Recordar la última ubicación que autorizaste para calcular distancias y ordenar casos cercanos en tu navegador.',
    duration: 'Hasta que la borres o elimines los datos del sitio.',
  },
  {
    name: 'patitas:auth-next',
    type: 'sessionStorage',
    purpose: 'Volver a la página donde estabas después de iniciar sesión, incluso si entras con Google.',
    duration: 'Se borra al usarla o al cerrar la pestaña.',
  },
];

export function CookiesPage() {
  useEffect(() => {
    setPageMeta({
      title: 'Política de cookies — Patitas',
      description:
        'Patitas no usa cookies de publicidad ni de analítica. Aquí tienes qué guarda en tu navegador, para qué sirve y cómo eliminarlo.',
      canonicalPath: '/cookies',
    });
  }, []);

  return (
    <LegalPage
      eyebrow="Documento legal"
      title="Política de cookies"
      intro="Qué guarda Patitas en tu navegador y por qué. Sin publicidad, sin analítica y sin seguimiento entre sitios: solo lo necesario para que la plataforma funcione."
      updated="20 de octubre de 2026"
      icon={Cookie}
      accent="purple"
      sections={SECTIONS}
      related={RELATED}
    >
      <LegalCallout icon={ShieldCheck} title="Sin banner porque no hay cookies opcionales" tone="success">
        Patitas no instala cookies de publicidad, analítica ni seguimiento. Solo usa almacenamiento
        técnico necesario para la sesión y tus preferencias, por lo que no mostramos un aviso de
        consentimiento.
      </LegalCallout>

      <LegalSection id="que-son" title="1. Qué son las cookies y qué usamos aquí">
        <p>
          Las cookies son pequeños archivos que un sitio guarda en tu navegador. Junto a ellas
          existen tecnologías parecidas, como <code className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-xs">localStorage</code> y{' '}
          <code className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-xs">sessionStorage</code>, que guardan datos sin enviarlos
          automáticamente en cada petición.
        </p>
        <p>
          Patitas no utiliza cookies de publicidad, analítica, píxeles de seguimiento, huellas
          digitales (<em>fingerprinting</em>) ni redes sociales integradas. No hay Google Analytics,
          Meta Pixel ni herramientas equivalentes.
        </p>
      </LegalSection>

      <LegalSection id="base" title="2. Base legal y por qué no pedimos consentimiento">
        <p>
          Solo usamos almacenamiento estrictamente necesario para prestarte un servicio que tú
          solicitas: mantener la sesión, recordar el tema y conservar tu última ubicación si la
          autorizas. Este almacenamiento técnico está exento del consentimiento previo en el RGPD
          (artículo 5.3 de la Directiva ePrivacy) y se ampara en la ejecución del servicio conforme a
          la Ley 149/2022 de Cuba.
        </p>
        <p>
          Si en el futuro incorporamos cookies opcionales, pediremos tu consentimiento antes de
          activarlas y actualizaremos esta página. Puedes retirarlo en cualquier momento.
        </p>
      </LegalSection>

      <LegalSection id="propias" title="3. Almacenamiento propio">
        <div className="overflow-x-auto rounded-2xl border-2 border-foreground/10">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">
              Almacenamiento local que usa Patitas, con su finalidad y duración
            </caption>
            <thead className="bg-foreground/5">
              <tr>
                <th scope="col" className="px-4 py-3 font-display font-bold text-foreground">
                  Nombre
                </th>
                <th scope="col" className="px-4 py-3 font-display font-bold text-foreground">
                  Tipo
                </th>
                <th scope="col" className="px-4 py-3 font-display font-bold text-foreground">
                  Para qué sirve
                </th>
                <th scope="col" className="px-4 py-3 font-display font-bold text-foreground">
                  Duración
                </th>
              </tr>
            </thead>
            <tbody>
              {STORAGE_ROWS.map((row) => (
                <tr key={row.name} className="border-t border-foreground/10 align-top">
                  <th scope="row" className="px-4 py-3 text-left font-mono text-xs font-semibold text-foreground">
                    {row.name}
                  </th>
                  <td className="px-4 py-3 text-foreground/70">{row.type}</td>
                  <td className="px-4 py-3 text-foreground/80">{row.purpose}</td>
                  <td className="px-4 py-3 text-foreground/70">{row.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          El nombre exacto de la clave de sesión incluye un identificador del proyecto de Supabase.
          Esa clave la gestiona la librería oficial de Supabase y solo contiene los tokens de tu
          sesión; no se usa para publicidad.
        </p>
        <p>
          La ubicación de <code className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-xs">userLocation</code> se guarda solo en tu
          dispositivo. Se usa en tu navegador para calcular distancias y ordenar resultados; no se
          envía junto con tus publicaciones. Las publicaciones siempre usan una zona aproximada, no
          la coordenada que guarda tu navegador.
        </p>
      </LegalSection>

      <LegalSection id="terceros" title="4. Recursos de terceros">
        <p>
          Al abrir Patitas, tu navegador solicita recursos a servidores de terceros. No son cookies
          de Patitas, pero esos servidores reciben tu IP y datos técnicos de la petición:
        </p>
        <LegalBullets
          items={[
            <>
              <strong>Google Fonts</strong> (<code className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-xs">fonts.googleapis.com</code> y{' '}
              <code className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-xs">fonts.gstatic.com</code>): carga las tipografías del sitio.
            </>,
            <>
              <strong>OpenStreetMap</strong> (<code className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-xs">tile.openstreetmap.org</code>): sirve las teselas del mapa
              cuando abres el mapa o eliges una ubicación.
            </>,
            <>
              <strong>Google Identity</strong>: solo si eliges «Continuar con Google». Google puede
              instalar sus propias cookies en su dominio durante el proceso de acceso, conforme a su
              política.
            </>,
            <>
              <strong>GitHub</strong>: la foto del desarrollador se carga desde GitHub y recibe tu IP
              al mostrarse.
            </>,
            <>
              <strong>Supabase y Vercel</strong>: reciben las peticiones del sitio y de la API; no
              instalan cookies de seguimiento en tu navegador.
            </>,
          ]}
        />
        <p>
          No tenemos control sobre las cookies que estos proveedores puedan usar en sus propios
          dominios. Consulta sus políticas para más información.
        </p>
      </LegalSection>

      <LegalSection id="servidor" title="5. Contadores en el servidor">
        <p>
          Para frenar abusos, las funciones del servidor aplican límites de peticiones. Si el
          almacenamiento distribuido está configurado (Upstash o Vercel KV), se guardan contadores
          temporales asociados a tu cuenta o a tu IP. No son cookies, no se instalan en tu navegador y
          se eliminan al terminar la ventana de tiempo del límite.
        </p>
        <p>
          Estos contadores se usan solo para seguridad y disponibilidad, no para elaborar perfiles ni
          para publicidad. Encontrarás más detalle en la{' '}
          <a className="font-semibold text-orange-dark underline decoration-orange/40 underline-offset-4 hover:text-orange" href="/privacidad">
            política de privacidad
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="gestion" title="6. Cómo borrarlas o bloquearlas">
        <p>
          Puedes eliminar el almacenamiento local y de sesión desde los ajustes de tu navegador, en la
          sección de privacidad o de datos de sitios. También puedes navegar en modo privado o
          incógnito, aunque la sesión no se conservará al cerrar la ventana.
        </p>
        <p>Si borras estos datos:</p>
        <LegalBullets
          items={[
            'Se cerrará tu sesión y tendrás que iniciar sesión de nuevo.',
            'Se perderá tu preferencia de tema claro u oscuro.',
            'Se olvidará la última ubicación guardada para ordenar por cercanía.',
          ]}
        />
        <p>
          Bloquear los recursos de Google, OpenStreetMap o GitHub puede afectar a las tipografías, al
          mapa o a la foto del equipo, pero no impide publicar ni buscar casos.
        </p>
        <p className="flex items-start gap-2 text-sm font-semibold text-foreground/70">
          <MonitorSmartphone className="mt-0.5 size-4 shrink-0 text-purple" aria-hidden="true" />
          Si usas el sitio desde un dispositivo compartido, cierra sesión y borra los datos del sitio
          al terminar.
        </p>
      </LegalSection>

      <LegalSection id="cambios" title="7. Cambios en esta política">
        <p>
          Si añadimos o cambiamos tecnologías de almacenamiento, actualizaremos esta página y su
          fecha. Si el cambio requiere consentimiento, lo pediremos antes de activarlo.
        </p>
      </LegalSection>

      <LegalSection id="contacto" title="8. Contacto">
        <p>
          Si tienes dudas sobre esta política o quieres ejercer tus derechos de protección de datos,
          escribe a <LegalContactLink /> o usa la página de{' '}
          <a className="font-semibold text-orange-dark underline decoration-orange/40 underline-offset-4 hover:text-orange" href="/contacto">
            contacto
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}

export default CookiesPage;
