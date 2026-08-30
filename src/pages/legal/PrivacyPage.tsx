import { Link } from "react-router-dom";
import {
  LegalList,
  LegalMail,
  LegalOperatorReference,
  LegalSection,
  LegalShell,
  LEGAL_OPERATOR,
  type LegalTocItem,
} from "./legalUi";

const TOC: LegalTocItem[] = [
  { id: "responsable", label: "Responsable de tus datos" },
  { id: "datos", label: "Datos personales que recabamos" },
  { id: "sensibles", label: "Datos sensibles" },
  { id: "fuentes", label: "Cómo obtenemos tus datos" },
  { id: "google-facebook", label: "Datos de Google y Facebook" },
  { id: "finalidades", label: "Finalidades del tratamiento" },
  { id: "cookies", label: "Cookies y tecnologías similares" },
  { id: "transferencias", label: "Transferencias y encargados" },
  { id: "arco", label: "Derechos ARCO" },
  { id: "eliminacion-de-datos", label: "Eliminación de datos" },
  { id: "conservacion", label: "Conservación de datos" },
  { id: "seguridad", label: "Medidas de seguridad" },
  { id: "incidentes", label: "Incidentes de seguridad" },
  { id: "menores", label: "Menores de edad" },
  { id: "cambios", label: "Cambios al aviso" },
  { id: "autoridad", label: "Autoridad y contacto" },
];

export function PrivacyPage() {
  return (
    <LegalShell
      kicker="Aviso de Privacidad"
      title="Aviso de Privacidad de Bestie"
      intro={
        <>
          <p>
            Este Aviso de Privacidad describe cómo <strong>Bestie</strong> recaba, usa, almacena,
            comparte y protege tus datos personales, en cumplimiento de la{" "}
            <strong>
              Ley Federal de Protección de Datos Personales en Posesión de los Particulares
            </strong>{" "}
            (LFPDPPP), su Reglamento y demás normativa aplicable en México, así como de las políticas de
            datos de Google y de Meta (Facebook).
          </p>
          <p>
            Al usar {LEGAL_OPERATOR.site}, crear una cuenta o iniciar sesión con Google o Facebook,
            aceptas las prácticas descritas en este Aviso.
          </p>
        </>
      }
      toc={TOC}
    >
      <LegalSection id="responsable" index={1} title="Responsable de tus datos">
        <p>
          El responsable del tratamiento de tus datos personales es{" "}
          <strong>{LEGAL_OPERATOR.responsible}</strong>, persona física con actividad empresarial bajo
          el {LEGAL_OPERATOR.fiscalRegime}, quien opera la Plataforma bajo la marca{" "}
          <strong>Bestie</strong>.
        </p>
        <LegalOperatorReference />
      </LegalSection>

      <LegalSection id="datos" index={2} title="Datos personales que recabamos">
        <p>Dependiendo de cómo uses el Servicio, podemos recabar las siguientes categorías de datos:</p>
        <LegalList
          items={[
            <>
              <strong>Datos de identificación y contacto:</strong> nombre o nombre para mostrar,
              dirección de correo electrónico y número de teléfono móvil. El teléfono de perfil
              (identificador de cuenta) es un celular mexicano (+52) que verificas con un código SMS.
              El teléfono de contacto de un anuncio puede ser de otro país y no se verifica; no se
              muestra en la ficha pública (se revela, si el publicador lo activa, a quien inicia sesión).
            </>,
            <>
              <strong>Datos de cuenta y autenticación:</strong> contraseña cifrada (cuentas con
              correo/contraseña o celular/contraseña), fecha de verificación de correo, fecha de
              verificación de teléfono, identificadores de tu sesión y, en su
              caso, foto de perfil, así como tus preferencias de contacto telefónico (avisos/WhatsApp de Bestie, promociones) y el registro de si descartaste el recordatorio de completar tu perfil.
            </>,
            <>
              <strong>Datos de proveedores de identidad:</strong> cuando usas Google o Facebook,
              recibimos tu identificador de cuenta del proveedor, nombre, correo electrónico y foto de
              perfil (ver sección 5).
            </>,
            <>
              <strong>Datos de tus anuncios y actividad:</strong> información de las propiedades o
              habitaciones que publicas, reportes de anuncios, fotos o conversaciones privadas que envías desde la Plataforma, comentarios y reportes que envías en el blog, mensajes (incluidos los que envías a Soporte de Bestie, Reporte de Bestie o a
              Feedback de Bestie desde el chat directo, el menú Feedback, el mapa de búsqueda o las
              invitaciones a calificar el producto, y los archivos que adjuntes, por ejemplo capturas
              de pantalla), calificaciones (por ejemplo de 1 a 5 estrellas) y comentarios opcionales
              asociados a ese feedback, textos sugeridos para compartir tu anuncio (generados con
              ayuda de IA a partir de datos estructurados del anuncio y editables por ti), la
              aceptación del aviso de seguridad al usar mensajes entre usuarios o al revelar el teléfono
              de un anuncio (fecha, versión del aviso y, en su caso, el hilo o anuncio que lo disparó) y tus
              interacciones en la Plataforma. Si un admin publica un borrador de crecimiento sin dueño,
              guardamos internamente la captura de consentimiento y una nota opcional; esa evidencia no
              forma parte de las fotos del anuncio y no se muestra al público ni al dueño que lo reclame
              después.
            </>,
            <>
              <strong>Datos técnicos y de uso:</strong> identificadores técnicos, cookies, tipo de
              navegador y dispositivo, métricas de uso y, cuando está activo, grabaciones de sesión
              (reproducción de la interacción con la interfaz: clics, desplazamiento y navegación,
              con campos de formulario enmascarados) para operar y mejorar el Servicio.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection id="sensibles" index={3} title="Datos sensibles">
        <p>
          Bestie <strong>no recaba datos personales sensibles</strong> (como origen racial, estado de
          salud, creencias religiosas, preferencias sexuales o afiliación política). Te pedimos no
          incluir este tipo de información en tus anuncios, perfil, mensajes o archivos que adjuntes.
        </p>
      </LegalSection>

      <LegalSection id="fuentes" index={4} title="Cómo obtenemos tus datos">
        <LegalList
          items={[
            <>
              <strong>Directamente de ti:</strong> cuando te registras, completas tu perfil, publicas
              anuncios o nos contactas. Si usas la publicación asistida de un cuarto o una propiedad, el texto y las
              imágenes (fotos e infográficos) que pegas o subes para armar el borrador.
            </>,
            <>
              <strong>De terceros:</strong> de los proveedores de inicio de sesión (Google, Facebook)
              cuando eliges autenticarte con ellos.
            </>,
            <>
              <strong>Automáticamente:</strong> mediante cookies y tecnologías similares al navegar el
              Servicio.
            </>,
            <>
              <strong>De publicaciones públicas (borradores asistidos de crecimiento):</strong> el
              Titular o su equipo puede capturar de forma <strong>manual</strong> (copiar y pegar
              texto e imágenes) información ya publicada por terceros en grupos de Facebook u otros
              canales públicos de renta compartida, únicamente para crear un borrador interno y
              ofrecerle al propietario un enlace de reclamación. Ese borrador{" "}
              <strong>no se publica</strong> hasta que el propietario lo reclame, revise y confirme, o,
              de forma excepcional, hasta que un admin lo publique con evidencia de consentimiento
              (captura aparte y nota opcional, almacenadas internamente y nunca mostradas en el anuncio
              público ni al dueño posterior). Si se comparte el enlace de reclamación, Facebook, WhatsApp
              u otras apps de mensajería pueden mostrar una vista previa con la foto de portada, el
              título, la zona y, si el anuncio muestra precio, la renta (sin el teléfono ni otros datos de contacto). Si quien publica oculta renta y depósito, la vista previa no incluye esos montos. Si no se reclama ni se publica con evidencia, se elimina
              automáticamente a los <strong>7 días</strong>. También
              puedes crear tú un borrador pegando el texto o un infográfico de tu propia publicación;
              en ese caso los datos salen de ti, no de un tercero.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection id="google-facebook" index={5} title="Datos obtenidos a través de Google y Facebook">
        <p>
          Cuando eliges iniciar sesión con Google o con Facebook, solicitamos únicamente los permisos
          mínimos para autenticarte y crear tu cuenta.
        </p>
        <p className="font-semibold text-primary">Google</p>
        <LegalList
          items={[
            <>
              <strong>Qué accedemos:</strong> solicitamos los ámbitos (scopes) básicos{" "}
              <code className="rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">openid</code>,{" "}
              <code className="rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">email</code> y{" "}
              <code className="rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">profile</code>.
              No solicitamos ámbitos sensibles ni restringidos.
            </>,
            <>
              <strong>Cómo lo usamos:</strong> exclusivamente para crear y autenticar tu cuenta de
              Bestie e identificarte al iniciar sesión.
            </>,
            <>
              <strong>Cómo lo almacenamos:</strong> guardamos tu identificador de Google, nombre, correo
              y foto de perfil vinculados a tu cuenta de Bestie.
            </>,
            <>
              <strong>Cómo lo compartimos:</strong> no vendemos ni compartimos datos de usuarios de
              Google con terceros para publicidad. El uso de la información recibida de las API de Google
              se ajusta a la{" "}
              <a
                className="font-medium text-primary underline-offset-2 hover:underline"
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
              >
                Política de Datos de Usuario de los Servicios de API de Google
              </a>
              , incluidos sus requisitos de Uso Limitado.
            </>,
          ]}
        />
        <p className="font-semibold text-primary">Facebook (Meta)</p>
        <LegalList
          items={[
            <>
              <strong>Qué accedemos:</strong> los permisos{" "}
              <code className="rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">public_profile</code>{" "}
              y <code className="rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">email</code>.
            </>,
            <>
              <strong>Qué recibimos:</strong> tu identificador de Facebook, nombre, correo electrónico y
              foto de perfil.
            </>,
            <>
              <strong>Cómo lo usamos y almacenamos:</strong> únicamente para crear y autenticar tu
              cuenta de Bestie; se almacena vinculado a tu cuenta.
            </>,
            <>
              <strong>Eliminación:</strong> puedes solicitar la eliminación de estos datos conforme a la
              sección{" "}
              <a href="#eliminacion-de-datos" className="font-medium text-primary underline-offset-2 hover:underline">
                Eliminación de datos
              </a>
              .
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection id="finalidades" index={6} title="Finalidades del tratamiento">
        <p>
          <strong>Finalidades primarias</strong> (necesarias para prestarte el Servicio):
        </p>
        <LegalList
          items={[
            "Crear, autenticar y administrar tu cuenta, incluido el envío de un código SMS de un solo uso a un celular mexicano (+52) para registrarte, verificar o cambiar el teléfono de perfil, restablecer la contraseña de una cuenta con celular verificado, o reclamar un anuncio asociado a ese número.",
            "Permitir la publicación y consulta de anuncios y el contacto entre usuarios.",
            "Generar y almacenar, a tu beneficio, un texto sugerido para compartir tu anuncio en redes o mensajería (editable por ti; no sustituye la descripción pública del anuncio).",
            "Brindarte soporte y dar seguimiento a los mensajes que envías a Soporte de Bestie o a Feedback de Bestie, incluidos los archivos que adjuntes y las calificaciones o comentarios de feedback.",
            "Moderar el blog: revisar comentarios reportados y gestionar contenido inapropiado en los artículos.",
            "Moderar anuncios y conversaciones: revisar reportes de usuarios, pausar o retirar publicaciones y restringir cuentas que incumplan las reglas.",
            "Enviar comunicaciones operativas y de seguridad (verificación de correo, restablecimiento de contraseña por correo o por SMS, notificaciones del servicio).",
            "Enviar, si agregas tu teléfono y mantienes activa la preferencia correspondiente, comunicaciones transaccionales por SMS o WhatsApp relacionadas con tu cuenta, soporte, actividad en la Plataforma o seguimiento operativo del Servicio.",
            "Enviarte correos de aviso cuando tengas mensajes nuevos en Bestie (como máximo uno cada 3 horas; el correo no incluye el contenido de los mensajes). Si en ese periodo también se crearon notificaciones en la app, podemos resumirlas en el mismo correo.",
            "Prevenir fraudes, abusos y garantizar la seguridad de la Plataforma.",
            "Cumplir obligaciones legales y fiscales aplicables.",
          ]}
        />
        <p>
          <strong>Finalidades secundarias</strong> (no necesarias, puedes oponerte):
        </p>
        <LegalList
          items={[
            "Analítica y mejora del Servicio mediante métricas de uso.",
            "Envío de comunicaciones informativas o promocionales sobre Bestie por correo, SMS o WhatsApp, cuando no te hayas opuesto o retires ese consentimiento desde tu perfil.",
          ]}
        />
        <p>
          Si no deseas que tus datos se traten para las finalidades secundarias, puedes manifestarlo
          escribiendo a <LegalMail /> o desactivando esas preferencias en tu perfil cuando estén disponibles. Tu negativa no será motivo para negarte el Servicio.
        </p>
      </LegalSection>

      <LegalSection id="cookies" index={7} title="Cookies y tecnologías similares">
        <p>
          Usamos cookies y tecnologías similares para mantener tu sesión iniciada, recordar preferencias
          y, si lo autorizas, medir el uso del Servicio. Algunas cookies son estrictamente necesarias para el
          funcionamiento (por ejemplo, la cookie de sesión y la cookie de estado de inicio de sesión con
          Google/Facebook); estas no requieren consentimiento adicional.
        </p>
        <p>
          Con tu consentimiento explícito (banner de cookies o preferencias en el pie de página), podemos
          usar: (i) analítica de producto (PostHog) — páginas visitadas, embudos de búsqueda y
          publicación, eventos de interacción, métricas de rendimiento, mapas de calor / clics sin
          respuesta, errores de la interfaz y, cuando está habilitado, grabaciones de sesión con campos
          sensibles y contenido de chat enmascarados o excluidos; y (ii) el píxel de medición de Meta
          (Facebook/Instagram Ads) en producción, para medir visitas y conversiones relacionadas con
          anuncios, optimizar campañas y limitar la repetición de anuncios. Si rechazas estas
          categorías, no cargamos PostHog ni el píxel de Meta. Puedes cambiar tu elección en cualquier
          momento desde el enlace <strong>Cookies</strong> del pie de página. También puedes gestionar
          cookies desde tu navegador; deshabilitar las necesarias puede afectar el funcionamiento del
          Servicio. Los mapas pueden cargar teselas desde proveedores externos conforme a sus propias
          políticas.
        </p>
      </LegalSection>

      <LegalSection id="transferencias" index={8} title="Transferencias y encargados">
        <p>
          Para operar el Servicio compartimos datos con proveedores que actúan como encargados y tratan
          los datos por cuenta de Bestie, entre ellos:
        </p>
        <LegalList
          items={[
            "Proveedores de inicio de sesión e identidad (Google LLC y Meta Platforms, Inc.).",
            "Proveedor de infraestructura y alojamiento de la aplicación.",
            "Proveedor de almacenamiento de respaldos de la base de datos y archivos del Servicio (copias de seguridad cifradas en tránsito, separadas del volumen de producción).",
            "Proveedor de envío de correos electrónicos transaccionales.",
            "Proveedor de envío de mensajes SMS de verificación (SMS Masivos) para códigos de un solo uso a celulares mexicanos (+52) al registrarte, verificar o cambiar el teléfono de perfil, restablecer la contraseña, o reclamar un anuncio cuyo contacto es ese número.",
            "Proveedores de mapas y teselas (por ejemplo, OpenStreetMap).",
            "Proveedor de analítica de producto (PostHog, Inc.), que puede tratar identificadores técnicos, eventos de uso, métricas de rendimiento, mapas de calor, errores de la interfaz, grabaciones de sesión de la interfaz (con campos sensibles y contenido de chat enmascarados o excluidos) y, si inicias sesión, un identificador de usuario asociado a tu cuenta.",
            "Proveedor de publicidad y medición de anuncios (Meta Platforms, Inc.), a través del píxel de Meta en el sitio, que puede tratar identificadores técnicos, páginas visitadas y eventos de conversión (por ejemplo, registro o publicación) para medir y optimizar campañas en Facebook e Instagram.",
            "Proveedor de modelos de inteligencia artificial (Google LLC, Gemini API) para, a tu solicitud: (i) extraer campos de un anuncio (por ejemplo zona, renta, tipo de espacio, recámaras y etiquetas) a partir del texto o infográfico que proporcionas al publicar un cuarto o una propiedad; y (ii) generar un texto sugerido de compartir basado en los datos estructurados de tu anuncio. El texto de compartir no sustituye la descripción pública del anuncio ni se usa como vista previa Open Graph; puedes editarlo antes de compartirlo. El borrador extraído no se publica hasta que lo revisas y confirmas.",
          ]}
        />
        <p>
          Algunos de estos proveedores pueden ubicarse fuera de México. No vendemos tus datos
          personales. No realizamos transferencias que requieran tu consentimiento salvo las necesarias
          para prestar el Servicio o las permitidas por el artículo 37 de la LFPDPPP.
        </p>
      </LegalSection>

      <LegalSection id="arco" index={9} title="Derechos ARCO">
        <p>
          Tienes derecho a <strong>Acceder</strong> a tus datos personales, a <strong>Rectificarlos</strong>{" "}
          cuando sean inexactos, a <strong>Cancelarlos</strong> cuando consideres que no se requieren para
          las finalidades señaladas, y a <strong>Oponerte</strong> a su tratamiento para fines
          específicos (derechos ARCO). También puedes revocar tu consentimiento y limitar el uso o
          divulgación de tus datos.
        </p>
        <p>
          Para ejercer estos derechos, envía tu solicitud a <LegalMail /> indicando: (i) tu nombre y
          medio para recibir respuesta; (ii) los datos o cuenta a los que se refiere; y (iii) la
          descripción clara de tu solicitud. Responderemos en los plazos previstos por la LFPDPPP.
        </p>
      </LegalSection>

      <LegalSection id="eliminacion-de-datos" index={10} title="Eliminación de datos y revocación de acceso">
        <p>
          Puedes solicitar en cualquier momento la <strong>eliminación de tu cuenta y de tus datos
          personales</strong>, incluidos los obtenidos a través de Google o Facebook, siguiendo
          cualquiera de estas opciones:
        </p>
        <LegalList
          items={[
            <>
              <strong>Por correo:</strong> escribe a <LegalMail /> desde la dirección asociada a tu
              cuenta con el asunto “Eliminar mis datos”. Procesaremos la eliminación de tus datos
              personales conforme a la ley y a los plazos de conservación aplicables.
            </>,
            <>
              <strong>Desde Facebook:</strong> puedes retirar el acceso de Bestie desde{" "}
              <em>Configuración y privacidad → Configuración → Apps y sitios web</em> en tu cuenta de
              Facebook, y usar la opción “Enviar solicitud” para pedir la eliminación de datos.
            </>,
            <>
              <strong>Desde Google:</strong> puedes revocar el acceso de Bestie desde la página de{" "}
              <a
                className="font-medium text-primary underline-offset-2 hover:underline"
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
              >
                permisos de tu Cuenta de Google
              </a>
              .
            </>,
          ]}
        />
        <p>
          Una vez recibida tu solicitud, eliminaremos o anonimizaremos los datos personales asociados a
          tu cuenta, salvo aquellos que debamos conservar por obligaciones legales o fiscales. Te
          confirmaremos por correo cuando la solicitud haya sido atendida.
        </p>
      </LegalSection>

      <LegalSection id="conservacion" index={11} title="Conservación de datos">
        <p>
          Conservamos tus datos personales mientras mantengas una cuenta activa y por el tiempo
          necesario para cumplir las finalidades descritas, así como los plazos legales, contables y
          fiscales aplicables. Cuando ya no sean necesarios, los eliminaremos o anonimizaremos de forma
          segura.
        </p>
      </LegalSection>

      <LegalSection id="seguridad" index={12} title="Medidas de seguridad">
        <p>
          Implementamos medidas de seguridad administrativas, técnicas y físicas razonables para
          proteger tus datos contra pérdida, uso indebido y acceso no autorizado, incluyendo el cifrado
          de contraseñas y el uso de conexiones seguras (HTTPS). Ningún sistema es completamente
          infalible, por lo que no podemos garantizar seguridad absoluta.
        </p>
      </LegalSection>

      <LegalSection id="incidentes" index={13} title="Incidentes de seguridad">
        <p>
          Si tenemos conocimiento de un incidente de seguridad que afecte de forma relevante tus datos
          personales (por ejemplo, acceso no autorizado, filtración o pérdida de información),
          actuaremos de buena fe para: (i) investigar y contener el incidente en la medida razonable;
          (ii) evaluar el riesgo para los titulares afectados; y (iii) notificarte por los medios
          disponibles (incluido el correo asociado a tu cuenta o <LegalMail />) cuando la ley o el
          nivel de riesgo lo hagan procedente, con la información que sea razonable comunicar en ese
          momento. También podremos informar a las autoridades competentes cuando corresponda.
        </p>
        <p>
          Este compromiso no garantiza que todo incidente sea detectado de inmediato ni que no puedan
          ocurrir fallas técnicas. Si sospechas un acceso indebido a tu cuenta, escríbenos de inmediato
          a <LegalMail />.
        </p>
      </LegalSection>

      <LegalSection id="menores" index={14} title="Menores de edad">
        <p>
          El Servicio está dirigido a personas mayores de 18 años. No recabamos intencionalmente datos
          de menores de edad. Si detectamos que se creó una cuenta por un menor, la eliminaremos.
        </p>
      </LegalSection>

      <LegalSection id="cambios" index={15} title="Cambios al aviso de privacidad">
        <p>
          Podemos actualizar este Aviso de Privacidad para reflejar cambios en el Servicio o en la
          normativa. Publicaremos la versión vigente en esta página con su fecha de actualización y, en
          cambios sustanciales, procuraremos notificarte por los medios disponibles.
        </p>
      </LegalSection>

      <LegalSection id="autoridad" index={16} title="Autoridad y contacto">
        <p>
          Si consideras que tu derecho a la protección de datos personales ha sido vulnerado, puedes
          acudir ante la autoridad competente en México. Para cualquier duda sobre este Aviso o sobre el
          tratamiento de tus datos, contáctanos en <LegalMail /> o visita nuestra página de{" "}
          <Link to="/contacto" className="font-medium text-primary underline-offset-2 hover:underline">
            Contacto
          </Link>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
