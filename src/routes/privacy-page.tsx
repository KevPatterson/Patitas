import { useEffect } from 'react';
import { Building2, Eye, Globe2, Lock, ShieldCheck } from 'lucide-react';
import {
  LegalBullets,
  LegalCallout,
  LegalContactLink,
  LegalPage,
  LegalSection,
} from '../components/legal/legal-page';
import { setPageMeta } from '../lib/seo/page-meta';

const SECTIONS = [
  { id: 'responsable', label: 'Quién trata tus datos' },
  { id: 'alcance', label: 'A qué se aplica' },
  { id: 'datos', label: 'Qué datos recogemos' },
  { id: 'finalidades', label: 'Para qué y con qué base legal' },
  { id: 'visibilidad', label: 'Quién puede ver qué' },
  { id: 'ubicacion', label: 'Ubicación y datos sensibles' },
  { id: 'conservacion', label: 'Cuánto tiempo los guardamos' },
  { id: 'destinatarios', label: 'Proveedores y destinatarios' },
  { id: 'internacional', label: 'Transferencias internacionales' },
  { id: 'seguridad', label: 'Cómo los protegemos' },
  { id: 'derechos', label: 'Tus derechos' },
  { id: 'menores', label: 'Menores de edad' },
  { id: 'externos', label: 'Contenido importado y retiradas' },
  { id: 'cambios', label: 'Cambios en esta política' },
  { id: 'contacto', label: 'Contacto y autoridad' },
];

const RELATED = [
  { href: '/terminos', label: 'Términos de uso' },
  { href: '/cookies', label: 'Política de cookies' },
  { href: '/accesibilidad', label: 'Accesibilidad' },
];

export function PrivacyPage() {
  useEffect(() => {
    setPageMeta({
      title: 'Política de privacidad — Patitas',
      description:
        'Qué datos recoge Patitas, para qué se usan, quién puede verlos y cómo ejercer tus derechos de protección de datos en Cuba y en el resto del mundo.',
      canonicalPath: '/privacidad',
    });
  }, []);

  return (
    <LegalPage
      eyebrow="Documento legal"
      title="Política de privacidad"
      intro="Cómo recopilamos, usamos y protegemos tus datos cuando publicas, buscas o adoptas en Patitas. Redactada para Cuba y para quienes nos usan desde cualquier parte del mundo."
      updated="20 de octubre de 2026"
      icon={ShieldCheck}
      accent="orange"
      sections={SECTIONS}
      related={RELATED}
    >
      <LegalCallout icon={Lock} title="La idea, en una frase">
        Patitas solo pide los datos necesarios para que un caso pueda encontrarse: tu cuenta, los
        datos del animal, una zona aproximada y un contacto que nadie ve sin tu permiso y sin dejar
        registro.
      </LegalCallout>

      <LegalSection id="responsable" title="1. Quién trata tus datos">
        <p>
          Patitas es una plataforma comunitaria y gratuita para publicar y buscar mascotas perdidas,
          encontradas, avistadas y en adopción. Está desarrollada y mantenida por Kevin Reinaldo
          Patterson Forján desde Cuba. A los efectos de esta política, el responsable del tratamiento
          es el equipo de Patitas, que puedes contactar en <LegalContactLink />.
        </p>
        <p>
          Esta política cubre el sitio web y todas sus funciones: cuenta, publicaciones, buscador,
          mapa, comentarios, avistamientos, solicitudes de adopción, notificaciones, revelación de
          contactos y contenido importado de fuentes públicas. No cubre los servicios de terceros a
          los que accedas por tu cuenta, que tienen sus propias políticas.
        </p>
      </LegalSection>

      <LegalSection id="alcance" title="2. A qué se aplica y qué leyes seguimos">
        <p>
          Tratamos datos desde Cuba y en infraestructura de proveedores internacionales. Aplicamos la{' '}
          <strong>Ley No. 149/2022, de Protección de Datos Personales</strong>, y el derecho a la
          intimidad y a la protección de datos que reconoce el artículo 48 de la Constitución de la
          República de Cuba.
        </p>
        <p>
          Si resides en el Espacio Económico Europeo o en el Reino Unido, también aplicamos el
          Reglamento (UE) 2016/679 (RGPD) en lo que te resulte más favorable. Si resides en
          California, aplicamos los derechos de la CPRA. Si resides en otro país con ley propia
          (Argentina, Brasil, México, Chile, Colombia, etc.), respetamos los derechos que esa ley te
          reconozca y los hacemos valer a través del mismo canal de contacto.
        </p>
        <p>
          Patitas no es un servicio de emergencias, no sustituye a la policía, a los servicios
          veterinarios ni a las autoridades sanitarias, y no está pensada para alojar datos de salud,
          ideología, religión, orientación sexual, datos biométricos ni documentos de identidad.
        </p>
      </LegalSection>

      <LegalSection id="datos" title="3. Qué datos recogemos">
        <p>Recogemos únicamente lo que tú decides aportar y lo mínimo técnico para operar:</p>
        <LegalBullets
          items={[
            <>
              <strong>Cuenta.</strong> Correo electrónico, contraseña (guardada como hash por
              Supabase; Patitas nunca la ve), nombre, nombre de usuario, foto de perfil, ciudad,
              país, biografía y fechas de creación y actualización.
            </>,
            <>
              <strong>Inicio de sesión con Google.</strong> Si lo eliges, recibimos el identificador
              de tu cuenta de Google, tu correo, tu nombre y tu foto según la configuración que
              tengas en Google. Nunca recibimos tu contraseña de Google.
            </>,
            <>
              <strong>Publicaciones y mascotas.</strong> Tipo de caso, título, descripción, especie,
              raza, sexo, tamaño, edad aproximada, color, características, collar o placa,
              recompensa, fotos, fecha del evento, estado y datos de la mascota como su nombre o su
              número de microchip.
            </>,
            <>
              <strong>Contacto.</strong> Teléfono, WhatsApp, correo y modo de contacto. Son datos
              privados por diseño: no se pueden leer directamente desde la API y solo se muestran
              cuando alguien pulsa «revelar contacto», con cuota y registro de cada acceso.
            </>,
            <>
              <strong>Ubicación.</strong> Provincia, municipio, zona, nombre del lugar y coordenadas
              aproximadas. No pedimos ni almacenamos la dirección exacta.
            </>,
            <>
              <strong>Actividad.</strong> Comentarios, avistamientos, solicitudes de adopción,
              reportes, notificaciones, historial de contactos revelados y actuaciones de moderación.
            </>,
            <>
              <strong>Datos técnicos.</strong> Dirección IP, fecha y hora, agente de usuario y ruta
              solicitada en las funciones del servidor, además de registros de errores y contadores
              de límite de peticiones. Nuestros proveedores de alojamiento y autenticación pueden
              registrar accesos por seguridad.
            </>,
            <>
              <strong>Fuentes externas.</strong> Cuando importamos un aviso publicado en un canal
              público de Telegram o en una página pública de Facebook, guardamos el texto, las
              imágenes, la URL original y la fecha. Si pides una retirada, guardamos el correo que
              facilites para responderte.
            </>,
          ]}
        />
        <p>
          No usamos cookies de analítica, publicidad ni seguimiento, y no elaboramos perfiles
          publicitarios. Puedes leer el detalle en la <a className="font-semibold text-orange-dark underline decoration-orange/40 underline-offset-4 hover:text-orange" href="/cookies">política de cookies</a>.
        </p>
      </LegalSection>

      <LegalSection id="finalidades" title="4. Para qué usamos los datos y con qué base legal">
        <LegalBullets
          items={[
            <>
              <strong>Prestar el servicio.</strong> Crear tu cuenta, publicar casos, mostrarlos en el
              buscador y el mapa, enviar notificaciones y permitir el contacto entre usuarios. Base:
              ejecución de la relación contigo y tu consentimiento al registrarte (en el RGPD,
              artículo 6.1.b).
            </>,
            <>
              <strong>Seguridad y prevención de abuso.</strong> Límites de peticiones, detección de
              scraping, cuentas duplicadas y fraude. Base: interés legítimo en proteger la plataforma
              y a la comunidad, y cumplimiento de obligaciones legales cuando corresponda.
            </>,
            <>
              <strong>Moderación.</strong> Revisar reportes, retirar contenido ilícito y conservar un
              registro de las decisiones. Base: interés legítimo y obligaciones legales de respuesta
              ante contenidos ilícitos.
            </>,
            <>
              <strong>Comunicaciones necesarias.</strong> Confirmación de correo, restablecimiento de
              contraseña y avisos relacionados con tu cuenta. Base: ejecución del servicio.
            </>,
            <>
              <strong>Atención de derechos y reclamaciones.</strong> Responder a solicitudes de
              acceso, supresión o retirada. Base: obligación legal.
            </>,
            <>
              <strong>Mejora del servicio.</strong> Métricas agregadas y depuración de errores, sin
              identificar a personas concretas. Base: interés legítimo.
            </>,
            <>
              <strong>Funciones de inteligencia artificial.</strong> Solo si están habilitadas y tú
              las usas: autocompletar un formulario o sugerir coincidencias. Están desactivadas por
              defecto; si se activan, se te informará en la propia función. Base: tu consentimiento o
              tu acción expresa.
            </>,
          ]}
        />
        <p>
          No tomamos decisiones automatizadas que produzcan efectos jurídicos sobre ti. Las
          sugerencias de coincidencias son orientativas y siempre las revisa una persona.
        </p>
        <LegalCallout icon={Eye} title="Lo que nunca hacemos" tone="success">
          No vendemos tus datos, no los cedemos a corredores de datos y no los usamos para publicidad
          comportamental. Los datos de contacto y el microchip no se sirven por la API pública.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="visibilidad" title="5. Quién puede ver qué">
        <LegalBullets
          items={[
            <>
              <strong>Público, sin cuenta:</strong> las publicaciones activas, sus fotos, la zona
              aproximada, los comentarios y los avistamientos visibles.
            </>,
            <>
              <strong>Con cuenta:</strong> revelar el contacto de una publicación. Cada cuenta tiene
              una cuota de 30 revelaciones cada 24 horas; el dueño de la publicación y el equipo de
              moderación no consumen cuota y cada acceso queda registrado.
            </>,
            <>
              <strong>Solo tú:</strong> tu correo, los datos completos de tu perfil, tu historial de
              contactos revelados y tus publicaciones ocultas o eliminadas.
            </>,
            <>
              <strong>Moderación:</strong> puede ver más datos para investigar reportes o retiradas,
              y sus acciones quedan en un registro de auditoría.
            </>,
          ]}
        />
        <p>
          La base de datos aplica seguridad a nivel de fila y permisos por columna, de modo que
          incluso una consulta directa a la API no devuelve los campos privados. El microchip y los
          datos de contacto solo se leen mediante funciones controladas.
        </p>
      </LegalSection>

      <LegalSection id="ubicacion" title="6. Ubicación y datos sensibles">
        <p>
          Entre el punto que marcas y lo que se guarda hay dos desplazamientos: uno de hasta 50
          metros al seleccionar la ubicación y otro determinista de hasta unos 330 metros aplicado por
          la base de datos sobre una rejilla de aproximadamente 1,1 kilómetros. Repetir el guardado no
          permite promediar y reconstruir el punto exacto, y el mapa nunca muestra la dirección real.
        </p>
        <p>
          El número de microchip es un dato privado y no se puede consultar desde la API. Si lo
          incluyes, solo se usará para verificar la identidad del animal en un encuentro.
        </p>
        <p>
          No publiques datos personales de otras personas sin su permiso: documentos, matrículas,
          direcciones exactas, teléfonos ajenos o imágenes de menores. Si detectamos ese contenido,
          podemos retirarlo y suspender la cuenta.
        </p>
      </LegalSection>

      <LegalSection id="conservacion" title="7. Cuánto tiempo los guardamos">
        <LegalBullets
          items={[
            'Cuenta: mientras esté activa. Si pides eliminarla, borramos o anonimizamos tus datos en un plazo de hasta 30 días, salvo lo que debamos conservar por ley o para atender reclamaciones.',
            'Publicaciones: hasta que las elimines o se resuelvan. Pueden quedar enlaces mínimos o registros anonimizados para no romper referencias.',
            'Revelaciones de contacto y auditoría: el tiempo necesario para prevenir abusos y atender reclamaciones, y después se eliminan o anonimizan.',
            'Reportes y solicitudes de retirada: mientras dure la revisión y el plazo necesario para acreditar la actuación.',
            'Registros técnicos y de seguridad: el tiempo mínimo necesario para operar y proteger el servicio.',
            'Copias de seguridad: se rotan periódicamente; un dato eliminado puede persistir en una copia hasta que esta se sobrescriba.',
          ]}
        />
        <p>
          Si la ley aplicable exige un plazo distinto o una conservación obligatoria, prevalece ese
          plazo y te lo informaremos al responder tu solicitud.
        </p>
      </LegalSection>

      <LegalSection id="destinatarios" title="8. Proveedores y destinatarios">
        <p>
          No vendemos datos. Solo acceden a ellos los proveedores que necesitamos para operar,
          como encargados del tratamiento y con acceso limitado a lo imprescindible:
        </p>
        <LegalBullets
          items={[
            <>
              <strong>Supabase:</strong> autenticación, base de datos y almacenamiento de imágenes.
            </>,
            <>
              <strong>Vercel:</strong> alojamiento del sitio y funciones del servidor, con registros
              técnicos de acceso.
            </>,
            <>
              <strong>Upstash o Vercel KV:</strong> si están configurados, contadores de límite de
              peticiones (IP y cuenta) para frenar abusos.
            </>,
            <>
              <strong>Google:</strong> solo si eliges iniciar sesión con Google; además, las
              tipografías del sitio se cargan desde servidores de Google, que reciben tu IP.
            </>,
            <>
              <strong>OpenStreetMap:</strong> el mapa carga teselas desde sus servidores, que reciben
              tu IP al abrirlo.
            </>,
            <>
              <strong>GitHub:</strong> la foto del desarrollador se carga desde GitHub, que recibe tu
              IP al mostrarla.
            </>,
            <>
              <strong>Proveedores de IA:</strong> solo si las funciones de IA se habilitan y las usas
              (por ejemplo, Google Cloud Vision o Cloudflare). Hoy están desactivadas por defecto.
            </>,
            <>
              <strong>Autoridades:</strong> solo cuando exista una obligación legal o una orden
              válida, y limitándonos a lo requerido.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection id="internacional" title="9. Transferencias internacionales">
        <p>
          Nuestros proveedores alojan datos fuera de Cuba, principalmente en Estados Unidos y en la
          Unión Europea, según la región contratada. Eso implica una transferencia internacional
          necesaria para que el servicio funcione.
        </p>
        <p>
          Adoptamos medidas contractuales y organizativas para proteger los datos en esas
          transferencias. Cuando la ley cubana exija autorización o consentimiento específico para
          una transferencia, lo recabaremos antes de realizarla. Si resides en el EEE, aplicamos las
          garantías del RGPD (cláusulas contractuales tipo o decisiones de adecuación cuando
          correspondan).
        </p>
        <p>
          Al cargar el sitio también se conectan recursos de Google, OpenStreetMap y GitHub, que
          reciben tu IP. Puedes bloquearlos con extensiones o ajustes de tu navegador, aunque algunas
          funciones —mapa, tipografías o inicio de sesión con Google— dejarán de funcionar.
        </p>
      </LegalSection>

      <LegalSection id="seguridad" title="10. Cómo protegemos los datos">
        <LegalBullets
          items={[
            'Conexiones cifradas con TLS entre tu navegador y el sitio.',
            'Seguridad a nivel de fila y permisos por columna en todas las tablas; los secretos del servidor nunca llegan al navegador.',
            'Contraseñas gestionadas como hash por Supabase; Patitas no conoce tu contraseña.',
            'Funciones controladas para leer contactos, con cuota diaria y registro de cada revelación.',
            'Límites de peticiones por IP y por cuenta para frenar fuerza bruta, scraping y cosecha de contactos.',
            'Rechazo de imágenes con GPS incrustado y eliminación de metadatos EXIF antes de publicar.',
            'Validación de archivos, revisión de dependencias y registro de auditoría de las acciones de moderación.',
          ]}
        />
        <p>
          Ningún sistema es invulnerable. Si ocurre una brecha que afecte a tus derechos, la
          notificaremos a las personas afectadas y a la autoridad competente cuando la ley lo exija.
        </p>
      </LegalSection>

      <LegalSection id="derechos" title="11. Tus derechos y cómo ejercerlos">
        <p>Puedes solicitar en cualquier momento:</p>
        <LegalBullets
          items={[
            'Información sobre qué datos tuyos tratamos y con qué finalidad.',
            'Acceso a una copia de esos datos.',
            'Rectificación de datos inexactos o incompletos.',
            'Supresión («derecho al olvido») cuando ya no sean necesarios.',
            'Oposición o limitación del tratamiento en los casos que permita la ley.',
            'Portabilidad de los datos que nos diste, en un formato legible por máquina.',
            'Retirada del consentimiento, sin afectar a lo ya realizado.',
            'No ser discriminado por ejercer estos derechos.',
          ]}
        />
        <p>
          Escríbenos a <LegalContactLink /> con el asunto «Derechos de protección de datos» desde el
          correo de tu cuenta e indícanos qué quieres. Respondemos gratis en un plazo de hasta 30 días
          naturales; si necesitamos verificar tu identidad, te lo pediremos con un método que no
          implique enviar documentos sensibles.
        </p>
        <p>
          En Cuba, la Ley 149/2022 y el artículo 48 de la Constitución amparan estos derechos, y
          puedes reclamar ante la <strong>Autoridad de Protección de Datos Personales</strong> del
          Ministerio de Justicia. En el EEE puedes acudir a la autoridad de control de tu país (por
          ejemplo, la AEPD en España); en el Reino Unido, a la ICO; en California, a la CPPA. En otros
          países, a la autoridad de protección de datos que te corresponda.
        </p>
        <p>
          Algunos derechos tienen límites legales: por ejemplo, podemos conservar un registro mínimo
          de una publicación retirada o de un reporte si es necesario para acreditar el cumplimiento o
          defender reclamaciones.
        </p>
      </LegalSection>

      <LegalSection id="menores" title="12. Menores de edad">
        <p>
          Patitas está dirigida a personas mayores de 18 años, la mayoría de edad en Cuba. Si eres
          menor, no crees una cuenta sin la autorización de tu madre, padre o tutor legal. Si
          detectamos una cuenta de un menor sin autorización verificable, la suspenderemos y
          eliminaremos sus datos.
        </p>
        <p>
          No publiques fotos de menores identificables, ni siquiera como parte de un caso. Si
          aparecen, retiraremos la imagen a petición tuya o de su representante legal.
        </p>
      </LegalSection>

      <LegalSection id="externos" title="13. Contenido importado y solicitudes de retirada">
        <p>
          Parte de los avisos que ves pueden proceder de canales públicos de Telegram o de páginas
          públicas de Facebook. En esos casos conservamos el texto, las imágenes, la fecha y el enlace
          original, y mostramos la fuente. No controlamos esos servicios ni sus políticas.
        </p>
        <p>
          Si eres el autor de una foto o de un texto, o si tu información aparece sin tu permiso,
          escríbenos a <LegalContactLink /> con el enlace del caso. Revisaremos la solicitud y, si
          procede, retiraremos u ocultaremos la publicación y dejaremos constancia de la decisión.
          También puedes usar la página de contacto para cualquier otra incidencia.
        </p>
      </LegalSection>

      <LegalSection id="cambios" title="14. Cambios en esta política">
        <p>
          Podemos actualizar esta política para reflejar cambios en el servicio o en la ley. La fecha
          de la última actualización aparece al inicio. Si el cambio es relevante, lo anunciaremos en
          el sitio antes de que entre en vigor y, si afecta al tratamiento basado en tu consentimiento,
          te pediremos que lo renueves.
        </p>
        <p>
          Si necesitas una versión anterior, escríbenos y te la facilitamos.
        </p>
      </LegalSection>

      <LegalSection id="contacto" title="15. Contacto y autoridad de control">
        <p>
          Para cualquier duda, solicitud o reclamación sobre privacidad, escribe a{' '}
          <LegalContactLink />. También puedes usar la página de{' '}
          <a className="font-semibold text-orange-dark underline decoration-orange/40 underline-offset-4 hover:text-orange" href="/contacto">
            contacto
          </a>
          .
        </p>
        <p>
          Si consideras que no hemos atendido correctamente tu solicitud, puedes presentar una
          reclamación ante la autoridad de protección de datos de tu país o, en Cuba, ante la
          Autoridad de Protección de Datos Personales del Ministerio de Justicia.
        </p>
        <LegalCallout icon={Building2} title="Una nota sobre el alcance" tone="info">
          Patitas es un proyecto comunitario sin ánimo de lucro. No tiene sede física de atención al
          público; todo el contacto se gestiona por correo electrónico y por la página de contacto.
        </LegalCallout>
        <LegalCallout icon={Globe2} title="Fuera de Cuba" tone="info">
          Si tu ley local te reconoce derechos adicionales, escríbenos indicando tu país y los
          ejerceremos en la medida en que sean compatibles con el servicio.
        </LegalCallout>
      </LegalSection>
    </LegalPage>
  );
}

export default PrivacyPage;
