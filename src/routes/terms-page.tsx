import { useEffect } from 'react';
import { FileText, Scale, TriangleAlert } from 'lucide-react';
import {
  LegalBullets,
  LegalCallout,
  LegalContactLink,
  LegalPage,
  LegalSection,
} from '../components/legal/legal-page';
import { setPageMeta } from '../lib/seo/page-meta';

const SECTIONS = [
  { id: 'aceptacion', label: 'Aceptación' },
  { id: 'servicio', label: 'Qué es Patitas' },
  { id: 'cuenta', label: 'Tu cuenta' },
  { id: 'publicaciones', label: 'Tus publicaciones' },
  { id: 'normas', label: 'Normas de la comunidad' },
  { id: 'moderacion', label: 'Moderación y retiradas' },
  { id: 'propiedad', label: 'Propiedad intelectual' },
  { id: 'uso', label: 'Uso aceptable' },
  { id: 'terceros', label: 'Servicios de terceros' },
  { id: 'responsabilidad', label: 'Responsabilidad' },
  { id: 'terminacion', label: 'Suspensión y eliminación' },
  { id: 'cambios', label: 'Cambios' },
  { id: 'ley', label: 'Ley aplicable' },
  { id: 'general', label: 'Disposiciones generales' },
  { id: 'contacto', label: 'Contacto' },
];

const RELATED = [
  { href: '/privacidad', label: 'Política de privacidad' },
  { href: '/cookies', label: 'Política de cookies' },
  { href: '/seguridad', label: 'Consejos de seguridad' },
];

export function TermsPage() {
  useEffect(() => {
    setPageMeta({
      title: 'Términos de uso — Patitas',
      description:
        'Condiciones para usar Patitas: publicar casos, contactar con otros usuarios, adoptar y moderar contenido, con arreglo a la ley cubana y a los derechos de usuarios de otros países.',
      canonicalPath: '/terminos',
    });
  }, []);

  return (
    <LegalPage
      eyebrow="Documento legal"
      title="Términos de uso"
      intro="Las reglas para publicar, buscar, contactar y adoptar en Patitas. Están pensadas para proteger a los animales, a quien los busca y a quien ayuda a encontrarlos."
      updated="20 de octubre de 2026"
      icon={FileText}
      accent="turquoise"
      sections={SECTIONS}
      related={RELATED}
    >
      <LegalCallout icon={Scale} title="En resumen" tone="info">
        Patitas es gratis y no cobra comisiones. No somos un refugio, no verificamos la propiedad de
        los animales y no organizamos entregas: ayudamos a que las personas se encuentren y decidan
        con la información correcta.
      </LegalCallout>

      <LegalSection id="aceptacion" title="1. Aceptación de estos términos">
        <p>
          Al acceder a Patitas, crear una cuenta o publicar un caso, aceptas estos términos y la{' '}
          <a className="font-semibold text-orange-dark underline decoration-orange/40 underline-offset-4 hover:text-orange" href="/privacidad">
            política de privacidad
          </a>
          . Si no estás de acuerdo, no uses la plataforma.
        </p>
        <p>
          Estos términos se aplican a todas las personas, estén en Cuba o en otro país, y a todas las
          funciones del sitio, incluidas las publicaciones importadas de fuentes públicas.
        </p>
      </LegalSection>

      <LegalSection id="servicio" title="2. Qué es Patitas y qué no es">
        <p>
          Patitas es una plataforma comunitaria y gratuita para publicar y buscar mascotas perdidas,
          encontradas, avistadas y en adopción. Permite añadir fotos y una zona aproximada, recibir
          avistamientos y comentarios, revelar datos de contacto con control de acceso y enviar
          solicitudes de adopción.
        </p>
        <p>
          Patitas <strong>no es</strong> un servicio de emergencias, un refugio, una perrera, una
          clínica veterinaria, una agencia de adopción ni una empresa de transporte de animales.
          Tampoco verifica la propiedad del animal, su estado de salud, sus vacunas o la identidad de
          los usuarios, ni intermedia en pagos.
        </p>
        <p>
          No garantizamos que un caso se resuelva ni que un avistamiento sea exacto. La decisión de
          quedar, entregar o adoptar es siempre de las personas implicadas. Ante una emergencia,
          acude a las autoridades locales y a los servicios veterinarios.
        </p>
        <LegalCallout icon={TriangleAlert} title="Gratuidad" tone="warning">
          Patitas no cobra por publicar, buscar ni adoptar. Si alguien te pide dinero en nombre de
          Patitas, o te exige un pago para «liberar» una mascota o una publicación, desconfía y
          repórtalo.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="cuenta" title="3. Tu cuenta">
        <LegalBullets
          items={[
            'Debes tener al menos 18 años. Si eres menor, necesitas autorización de tu madre, padre o tutor legal y no puedes publicar datos de contacto propios.',
            'La información que nos das debe ser veraz y estar actualizada. No suplantes a otra persona, entidad o refugio.',
            'Una persona, una cuenta principal. Crear cuentas adicionales para eludir límites, sanciones o cuotas está prohibido.',
            'Eres responsable de tu contraseña y de la actividad de tu cuenta. Si detectas un acceso no autorizado, cámbiala y avísanos.',
            'Podemos pedirte que verifiques tu correo o tu identidad cuando exista un riesgo razonable de fraude.',
          ]}
        />
        <p>
          Puedes eliminar tu cuenta solicitándolo por correo. Al hacerlo, se eliminarán o anonimizarán
          tus datos conforme a la política de privacidad, aunque podemos conservar registros mínimos
          de moderación o seguridad cuando la ley lo permita.
        </p>
      </LegalSection>

      <LegalSection id="publicaciones" title="4. Tus publicaciones y el contenido que subes">
        <p>
          Conservas la titularidad de tus fotos y textos. Al publicarlos nos concedes una licencia
          mundial, no exclusiva y gratuita para alojarlos, reproducirlos, adaptarlos técnicamente
          (redimensionar, comprimir o convertir formatos), mostrarlos y distribuirlos dentro de
          Patitas y en los resultados de búsqueda y enlaces compartidos de la plataforma. Esta licencia
          termina cuando eliminas el contenido, salvo las copias de seguridad y los enlaces ya
          compartidos por terceros.
        </p>
        <p>
          Al subir una imagen declaras que tienes derecho a hacerlo. No publiques fotos de otras
          personas sin permiso, documentos de identidad, matrículas, direcciones exactas ni imágenes
          de menores identificables.
        </p>
        <p>
          Las publicaciones deben describir un caso real. No se permite duplicar el mismo caso de
          forma masiva, publicar avisos falsos, usar fotos de otros casos ni manipular la ubicación o
          la fecha para obtener más visibilidad.
        </p>
      </LegalSection>

      <LegalSection id="normas" title="5. Normas de la comunidad">
        <p>Está prohibido publicar o difundir:</p>
        <LegalBullets
          items={[
            'Venta, compra, trueque o explotación comercial de animales. Patitas es para pérdidas, hallazgos, avistamientos y adopción responsable.',
            'Ofertas de cría, camadas, «reservas» o pagos por adelantado, incluidos los falsos rescates.',
            'Maltrato, abandono, peleas de animales, mutilaciones o contenido que los promueva.',
            'Comercio o traslado ilegal de especies protegidas o reguladas. Debes cumplir la normativa cubana de bienestar animal, tenencia responsable, sanidad y protección de especies, y las leyes de tu país si publicas desde fuera de Cuba.',
            'Datos personales de terceros, documentos, matrículas, direcciones exactas, teléfonos ajenos o información que permita localizar a una persona.',
            'Acoso, amenazas, discriminación, discurso de odio, contenido sexual o violento explícito.',
            'Suplantación de identidad, estafas, solicitudes de dinero, donaciones fraudulentas o publicidad engañosa.',
            'Spam, enlaces maliciosos, malware, contenido generado masivamente o manipulación de resultados.',
            'Cualquier contenido ilícito conforme a la ley cubana o a la ley aplicable al usuario.',
          ]}
        />
      </LegalSection>

      <LegalSection id="moderacion" title="6. Moderación, reportes y retiradas">
        <p>
          Cualquier persona puede reportar una publicación. Revisamos los reportes y podemos ocultar,
          editar o retirar contenido, limitar funciones o suspender cuentas. Las decisiones quedan
          registradas en un historial de auditoría.
        </p>
        <p>
          No estamos obligados a revisar todo el contenido antes de publicarlo, pero podemos hacerlo y
          actuaremos con rapidez ante reportes de riesgo, contenido ilícito o datos personales
          expuestos. Si una publicación infringe derechos de autor o privacidad, puedes solicitar su
          retirada mediante el enlace del caso o escribiendo a <LegalContactLink /> indicando la URL y
          el motivo.
        </p>
        <p>
          Si no estás de acuerdo con una decisión de moderación, escríbenos y la revisaremos. La
          reincidencia en infracciones graves puede suponer la suspensión definitiva. Cooperamos con
          las autoridades cuando exista una orden válida.
        </p>
      </LegalSection>

      <LegalSection id="propiedad" title="7. Propiedad intelectual">
        <p>
          El nombre Patitas, el logotipo, el diseño y los contenidos propios de la plataforma
          pertenecen a su autor o se usan con autorización. El código fuente se publica bajo licencia
          MIT, por lo que puedes reutilizarlo conforme a esa licencia; las marcas, el logotipo y los
          contenidos de la comunidad no están cubiertos por ella.
        </p>
        <p>
          El contenido que publicas sigue siendo tuyo. El contenido importado de Telegram o Facebook
          pertenece a sus autores originales y se muestra con atribución y enlace a la fuente. Si eres
          titular de derechos y crees que se ha usado sin permiso, solicita la retirada y lo
          revisaremos.
        </p>
        <p>
          En Cuba, la protección del derecho de autor se rige por la Ley No. 5/1977 y sus
          modificaciones, y por los convenios internacionales de los que Cuba es parte, incluido el
          Convenio de Berna.
        </p>
      </LegalSection>

      <LegalSection id="uso" title="8. Uso aceptable y límites técnicos">
        <LegalBullets
          items={[
            'No extraigas datos de forma automatizada (scraping), no coseches contactos ni revendas la información obtenida en Patitas.',
            'No intentes eludir cuotas, límites de peticiones, controles de acceso ni medidas de seguridad.',
            'No crees cuentas múltiples para saltarte sanciones o límites.',
            'No sobrecargues la infraestructura con pruebas de carga, ataques o automatizaciones no autorizadas.',
            'No introduzcas código malicioso ni intentes acceder a datos de otras personas.',
            'No uses la plataforma para fines comerciales no autorizados ni para enviar publicidad masiva.',
          ]}
        />
        <p>
          Podemos aplicar límites razonables de uso para proteger el servicio y a la comunidad. Si
          necesitas un uso especial, escríbenos antes.
        </p>
      </LegalSection>

      <LegalSection id="terceros" title="9. Servicios y enlaces de terceros">
        <p>
          Patitas se apoya en servicios de terceros: Supabase (cuenta y datos), Vercel (alojamiento),
          Google (inicio de sesión opcional y tipografías), OpenStreetMap (mapas) y GitHub (avatares).
          Al usarlos, también se aplican sus términos y políticas.
        </p>
        <p>
          Los enlaces a sitios externos se ofrecen como ayuda. No controlamos su contenido ni
          respondemos por lo que hagan con tus datos. Revisa sus políticas antes de facilitar
          información.
        </p>
      </LegalSection>

      <LegalSection id="responsabilidad" title="10. Responsabilidad">
        <p>
          El servicio se presta «tal cual» y «según disponibilidad». Podemos suspenderlo por
          mantenimiento, por causas técnicas o por decisiones de moderación. No garantizamos
          disponibilidad ininterrumpida, exactitud de los datos publicados por terceros ni resultado
          de un caso.
        </p>
        <p>
          En la medida permitida por la ley, no respondemos por daños indirectos, lucro cesante,
          pérdida de datos, actos de otros usuarios, fraude, estado de salud de un animal ni acuerdos
          entre particulares. Tampoco respondemos por el contenido publicado por usuarios o por
          terceros ajenos a Patitas.
        </p>
        <p>
          Nada en estos términos excluye la responsabilidad por dolo o culpa grave, ni los derechos
          que la ley reconozca de forma imperativa al consumidor o al titular de datos personales. Si
          resides en el EEE, se respetan las normas imperativas de tu país de residencia.
        </p>
      </LegalSection>

      <LegalSection id="terminacion" title="11. Suspensión y eliminación">
        <p>
          Puedes dejar de usar Patitas en cualquier momento y solicitar la eliminación de tu cuenta.
          Nosotros podemos suspender o cancelar cuentas que infrinjan estos términos, que pongan en
          riesgo a otras personas o que debamos atender por mandato legal. Cuando sea posible,
          avisaremos y explicaremos el motivo.
        </p>
        <p>
          Tras la eliminación, el contenido puede desaparecer de la vista pública, pero conservamos
          registros mínimos de moderación y seguridad durante los plazos indicados en la política de
          privacidad.
        </p>
      </LegalSection>

      <LegalSection id="cambios" title="12. Cambios en el servicio y en los términos">
        <p>
          Podemos añadir, modificar o retirar funciones. Si cambiamos estos términos, publicaremos la
          nueva versión con su fecha y, si el cambio es relevante, lo anunciaremos en el sitio. Seguir
          usando Patitas después de la entrada en vigor supone aceptar la versión actualizada.
        </p>
        <p>
          Si no estás de acuerdo con un cambio sustancial, puedes dejar de usar el servicio y solicitar
          la eliminación de tu cuenta.
        </p>
      </LegalSection>

      <LegalSection id="ley" title="13. Ley aplicable y resolución de conflictos">
        <p>
          Estos términos se rigen por la ley cubana. Antes de acudir a un tribunal, te pedimos que nos
          escribas para intentar resolver el problema de buena fe en un plazo razonable.
        </p>
        <p>
          Si no se resuelve, las controversias se someterán a los tribunales competentes de Cuba, sin
          perjuicio de:
        </p>
        <LegalBullets
          items={[
            'Las normas imperativas de protección al consumidor de tu país de residencia.',
            'Tu derecho a reclamar por protección de datos ante la autoridad de control o los tribunales de tu país.',
            'La competencia de los tribunales del domicilio del consumidor en la Unión Europea, cuando resulte aplicable.',
          ]}
        />
      </LegalSection>

      <LegalSection id="general" title="14. Disposiciones generales">
        <LegalBullets
          items={[
            'Si alguna cláusula se declara inválida, las demás seguirán vigentes y la cláusula se interpretará del modo más cercano a su finalidad.',
            'No renunciamos a ningún derecho por el hecho de no ejercerlo en un caso concreto.',
            'Estos términos y la política de privacidad forman el acuerdo completo sobre el uso del servicio.',
            'No puedes ceder tus derechos u obligaciones sin nuestro consentimiento; nosotros podemos cederlos a quien continúe el proyecto, avisando en el sitio.',
            'La versión en español es la que prevalece. Las traducciones, si existen, son solo informativas.',
            'Los títulos de las secciones son orientativos y no afectan al contenido.',
          ]}
        />
      </LegalSection>

      <LegalSection id="contacto" title="15. Contacto">
        <p>
          Para cualquier duda sobre estos términos, escribe a <LegalContactLink /> o usa la página de{' '}
          <a className="font-semibold text-orange-dark underline decoration-orange/40 underline-offset-4 hover:text-orange" href="/contacto">
            contacto
          </a>
          . Incluye tu nombre de usuario y el enlace del caso si la consulta se refiere a una
          publicación concreta.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

export default TermsPage;
