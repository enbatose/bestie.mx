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
              <strong>Datos de identificación y contacto:</strong> nombre o nombre para mostrar y
              dirección de correo electrónico.
            </>,
            <>
              <strong>Datos de cuenta y autenticación:</strong> contraseña cifrada (solo cuentas con
              correo/contraseña), fecha de verificación de correo, identificadores de tu sesión y, en su
              caso, foto de perfil.
            </>,
            <>
              <strong>Datos de proveedores de identidad:</strong> cuando usas Google o Facebook,
              recibimos tu identificador de cuenta del proveedor, nombre, correo electrónico y foto de
              perfil (ver sección 5).
            </>,
            <>
              <strong>Datos de tus anuncios y actividad:</strong> información de las propiedades o
              habitaciones que publicas, mensajes (incluidos los que envías a Soporte de Bestie desde el
              chat directo en Contacto y los archivos que adjuntes, por ejemplo capturas de pantalla),
              y tus interacciones en la Plataforma.
            </>,
            <>
              <strong>Datos técnicos y de uso:</strong> identificadores técnicos, cookies, tipo de
              navegador y dispositivo, y métricas de uso agregadas para operar y mejorar el Servicio.
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
              anuncios o nos contactas.
            </>,
            <>
              <strong>De terceros:</strong> de los proveedores de inicio de sesión (Google, Facebook)
              cuando eliges autenticarte con ellos.
            </>,
            <>
              <strong>Automáticamente:</strong> mediante cookies y tecnologías similares al navegar el
              Servicio.
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
            "Crear, autenticar y administrar tu cuenta.",
            "Permitir la publicación y consulta de anuncios y el contacto entre usuarios.",
            "Brindarte soporte y dar seguimiento a los mensajes que envías a Soporte de Bestie, incluidos los archivos que adjuntes.",
            "Enviar comunicaciones operativas y de seguridad (verificación de correo, restablecimiento de contraseña, notificaciones del servicio).",
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
            "Envío de comunicaciones informativas o promocionales sobre Bestie.",
          ]}
        />
        <p>
          Si no deseas que tus datos se traten para las finalidades secundarias, puedes manifestarlo
          escribiendo a <LegalMail />. Tu negativa no será motivo para negarte el Servicio.
        </p>
      </LegalSection>

      <LegalSection id="cookies" index={7} title="Cookies y tecnologías similares">
        <p>
          Usamos cookies y tecnologías similares para mantener tu sesión iniciada, recordar preferencias
          y medir el uso del Servicio. Algunas cookies son estrictamente necesarias para el
          funcionamiento (por ejemplo, la cookie de sesión y la cookie de estado de inicio de sesión con
          Google/Facebook). También usamos cookies y almacenamiento local de herramientas de analítica
          de producto (PostHog) para entender cómo se usa Bestie (páginas visitadas, embudos de búsqueda
          y publicación, y eventos de interacción), con el fin de mejorar el Servicio. Puedes gestionar o
          eliminar las cookies desde la configuración de tu navegador; deshabilitarlas puede afectar el
          funcionamiento del Servicio. Los mapas pueden cargar teselas desde proveedores externos
          conforme a sus propias políticas.
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
            "Proveedor de envío de correos electrónicos transaccionales.",
            "Proveedores de mapas y teselas (por ejemplo, OpenStreetMap).",
            "Proveedor de analítica de producto (PostHog, Inc.), que puede tratar identificadores técnicos, eventos de uso y, si inicias sesión, un identificador de usuario asociado a tu cuenta.",
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

      <LegalSection id="menores" index={13} title="Menores de edad">
        <p>
          El Servicio está dirigido a personas mayores de 18 años. No recabamos intencionalmente datos
          de menores de edad. Si detectamos que se creó una cuenta por un menor, la eliminaremos.
        </p>
      </LegalSection>

      <LegalSection id="cambios" index={14} title="Cambios al aviso de privacidad">
        <p>
          Podemos actualizar este Aviso de Privacidad para reflejar cambios en el Servicio o en la
          normativa. Publicaremos la versión vigente en esta página con su fecha de actualización y, en
          cambios sustanciales, procuraremos notificarte por los medios disponibles.
        </p>
      </LegalSection>

      <LegalSection id="autoridad" index={15} title="Autoridad y contacto">
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
