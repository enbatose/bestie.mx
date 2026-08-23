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
  { id: "identidad", label: "Identidad del titular" },
  { id: "aceptacion", label: "Aceptación de los términos" },
  { id: "servicio", label: "Descripción del servicio" },
  { id: "elegibilidad", label: "Elegibilidad y cuenta" },
  { id: "acceso-terceros", label: "Acceso con Google y Facebook" },
  { id: "conducta", label: "Uso aceptable y conducta prohibida" },
  { id: "contenido", label: "Contenido de los usuarios" },
  { id: "rol", label: "Rol de Bestie e intermediación" },
  { id: "propiedad", label: "Propiedad intelectual y marca" },
  { id: "terceros", label: "Servicios de terceros" },
  { id: "monetizacion", label: "Tarifas y monetización" },
  { id: "suspension", label: "Suspensión y terminación" },
  { id: "garantias", label: "Descargo de garantías" },
  { id: "responsabilidad", label: "Limitación de responsabilidad" },
  { id: "indemnizacion", label: "Indemnización" },
  { id: "privacidad", label: "Privacidad" },
  { id: "cambios", label: "Cambios a los términos" },
  { id: "ley-aplicable", label: "Ley aplicable y jurisdicción" },
  { id: "contacto", label: "Contacto" },
];

export function TermsPage() {
  return (
    <LegalShell
      kicker="Términos y Condiciones"
      title="Términos y Condiciones de uso de Bestie"
      intro={
        <>
          <p>
            Estos Términos y Condiciones (los <strong>“Términos”</strong>) regulan el acceso y uso del
            sitio web {LEGAL_OPERATOR.site} y de los servicios asociados de <strong>Bestie</strong> (el
            <strong> “Servicio”</strong> o la <strong>“Plataforma”</strong>). Al usar el Servicio
            aceptas estos Términos en su totalidad. Léelos con atención.
          </p>
          <p>
            Bestie es un marketplace que conecta a personas que buscan roomies y rentas compartidas con
            personas que ofrecen habitaciones o propiedades en renta en México. Bestie{" "}
            <strong>no es una agencia inmobiliaria, arrendador, corredor ni parte de ningún contrato de
            arrendamiento</strong> entre usuarios.
          </p>
        </>
      }
      toc={TOC}
    >
      <LegalSection id="identidad" index={1} title="Identidad del titular">
        <p>
          El Servicio es operado por <strong>{LEGAL_OPERATOR.responsible}</strong>, persona física con
          actividad empresarial bajo el {LEGAL_OPERATOR.fiscalRegime}, quien comercializa el Servicio
          bajo la marca <strong>“Bestie”</strong> (en lo sucesivo, indistintamente,{" "}
          <strong>“Bestie”</strong>, <strong>“nosotros”</strong> o el <strong>“Titular”</strong>).
        </p>
        <LegalOperatorReference />
        <p>
          La marca <strong>Bestie</strong> y el dominio <strong>{LEGAL_OPERATOR.domain}</strong> se
          encuentran en trámite de registro ante el Instituto Mexicano de la Propiedad Industrial
          (IMPI), bajo los expedientes <strong>3678152</strong> y <strong>3679467</strong> (clase 35),{" "}
          <strong>3679461</strong> (clase 36) y <strong>3679472</strong> (clase 42). El uso de la marca
          durante su trámite se realiza de conformidad con la legislación aplicable. No se emplea el
          símbolo ® mientras el registro no haya sido concedido.
        </p>
      </LegalSection>

      <LegalSection id="aceptacion" index={2} title="Aceptación de los términos">
        <p>
          Al crear una cuenta, iniciar sesión, publicar un anuncio, contactar a otro usuario o navegar
          el Servicio, declaras que has leído, entendido y aceptado estos Términos y el{" "}
          <Link to="/legal/privacidad" className="font-medium text-primary underline-offset-2 hover:underline">
            Aviso de Privacidad
          </Link>
          . Si no estás de acuerdo, debes abstenerte de usar el Servicio.
        </p>
        <p>
          Si usas el Servicio en representación de una persona moral o de un tercero, declaras contar
          con facultades suficientes para obligar a dicha entidad o persona a estos Términos.
        </p>
      </LegalSection>

      <LegalSection id="servicio" index={3} title="Descripción del servicio">
        <p>Bestie ofrece herramientas para:</p>
        <LegalList
          items={[
            "Publicar y consultar anuncios de habitaciones y propiedades en renta compartida. Puedes armar un anuncio de un cuarto o de una propiedad pegando el texto o un infográfico de una publicación (por ejemplo de Facebook); Bestie usa un modelo de inteligencia artificial para proponer los campos del borrador, incluidas las recámaras de una propiedad. La IA no publica por ti: el borrador permanece privado hasta que lo revisas, completas lo que falte y confirmas expresamente la publicación.",
            "Generar (con ayuda de inteligencia artificial) un texto sugerido para que compartas tu anuncio en redes o mensajería; puedes revisarlo y editarlo antes de enviarlo. Ese texto no forma parte de la ficha pública del anuncio ni de su vista previa al compartir el enlace.",
            "Administrar la disponibilidad de una propiedad y sus recámaras; al pausar una propiedad desde Mis anuncios, sus recámaras disponibles se marcan como ocupadas para retirarlas de la búsqueda. En publicaciones de propiedad, cada recámara se ofrece o se retira según su estado disponible/ocupada.",
            "Buscar y filtrar anuncios por ciudad, ubicación en mapa, precio y características.",
            "Contactar a otros usuarios mediante el chat directo en Bestie u otros canales habilitados.",
            "Crear y administrar un perfil de usuario.",
            "Escribir a Soporte de Bestie desde un chat directo en la app (sección Contacto) o desde el botón de ayuda en el mapa de búsqueda, para comentarios, preguntas sobre el producto o solicitudes, con la posibilidad de adjuntar imágenes. Este chat requiere iniciar sesión y las respuestas pueden tardar hasta 48 horas. Cuando tengas mensajes nuevos (incluido Soporte o Feedback), podemos enviarte un correo de aviso (como máximo uno cada 3 horas), sin incluir el contenido de los mensajes.",
            "Enviar feedback a Feedback de Bestie (calificación de 1 a 5 estrellas y comentario opcional) desde el menú Feedback, el botón de feedback en el mapa, o cuando te lo pidamos tras publicar un anuncio o tras abrir varios anuncios en una búsqueda. Requiere iniciar sesión; se crea un chat aparte de Soporte, con respuestas que pueden tardar hasta 48 horas.",
            "Consultar artículos del blog de Bestie y, al iniciar sesión, publicar comentarios en ellos. Los comentarios pueden recibir respuestas y están sujetos a moderación y reporte.",
          ]}
        />
        <p>
          El Servicio se ofrece “tal cual” y puede evolucionar, agregar, modificar o retirar funciones
          en cualquier momento. Algunas funciones pueden estar en etapa de prueba (MVP).
        </p>
      </LegalSection>

      <LegalSection id="elegibilidad" index={4} title="Elegibilidad y cuenta">
        <LegalList
          items={[
            "Debes ser mayor de edad (18 años cumplidos) y tener capacidad legal para contratar.",
            "La información que proporciones debe ser veraz, exacta y estar actualizada.",
            "Eres responsable de la confidencialidad de tus credenciales y de toda actividad realizada desde tu cuenta.",
            "Debes notificarnos de inmediato a contacto@bestie.mx sobre cualquier uso no autorizado de tu cuenta.",
            "Una persona no puede mantener cuentas duplicadas ni suplantar la identidad de terceros.",
          ]}
        />
      </LegalSection>

      <LegalSection id="acceso-terceros" index={5} title="Acceso con Google y Facebook">
        <p>
          Puedes crear tu cuenta o iniciar sesión mediante proveedores de identidad de terceros como{" "}
          <strong>Google</strong> y <strong>Facebook</strong>. Al hacerlo, autorizas a dichos
          proveedores a compartir con Bestie datos básicos de tu perfil (por ejemplo, nombre, dirección
          de correo electrónico, identificador de la cuenta y foto de perfil) para crear y autenticar tu
          cuenta.
        </p>
        <LegalList
          items={[
            "Bestie solo solicita los permisos mínimos necesarios para autenticarte (identidad, correo y perfil básico); no publicamos ni accedemos a tu actividad en dichas plataformas.",
            "El uso de tus datos obtenidos por estos medios se rige por nuestro Aviso de Privacidad y por las políticas del proveedor correspondiente.",
            "Puedes revocar el acceso de Bestie desde la configuración de tu cuenta de Google o Facebook en cualquier momento.",
          ]}
        />
        <p>
          El acceso mediante estos proveedores está sujeto además a los términos y políticas de Google y
          de Meta Platforms, Inc., respectivamente.
        </p>
      </LegalSection>

      <LegalSection id="conducta" index={6} title="Uso aceptable y conducta prohibida">
        <p>Al usar el Servicio te obligas a no:</p>
        <LegalList
          items={[
            "Publicar información falsa, engañosa, fraudulenta o anuncios de propiedades inexistentes.",
            "Solicitar anticipos, depósitos o pagos con fines fraudulentos o antes de cualquier verificación razonable.",
            "Publicar contenido ilegal, difamatorio, discriminatorio, violento, sexual explícito o que incite al odio.",
            "Discriminar por origen étnico, género, edad, discapacidad, condición social, religión, preferencia sexual o cualquier otra categoría protegida por la ley.",
            "Acosar, amenazar o dañar a otros usuarios, ni recopilar sus datos sin consentimiento.",
            "Vulnerar la seguridad del Servicio, usar bots, scraping no autorizado, o sobrecargar la infraestructura.",
            "Infringir derechos de propiedad intelectual o industrial de terceros.",
            "Usar el Servicio para fines distintos a la búsqueda u oferta genuina de vivienda compartida.",
            "Enviar reportes falsos o abusivos de forma reiterada.",
          ]}
        />
        <p>
          Bestie permite reportar anuncios, fotografías y conversaciones privadas. Los reportes pueden ser revisados por
          administradores, quienes podrán pausar anuncios, solicitar cambios o restringir cuentas que incumplan estas reglas.
          Las herramientas de reporte y los avisos de seguridad son medidas de prevención y moderación comunitaria:{" "}
          <strong>
            no garantizan que se detecte o evite toda conducta indebida, ni convierten a Bestie en garante de la
            identidad, veracidad o honestidad de los usuarios
          </strong>
          . El Titular no asume responsabilidad por daños derivados de fraudes o disputas entre usuarios, aunque exista o
          haya existido un reporte o un aviso de seguridad previo.
        </p>
      </LegalSection>

      <LegalSection id="contenido" index={7} title="Contenido de los usuarios">
        <p>
          Eres el único responsable del contenido que publicas (textos, fotografías, precios, datos de
          contacto y demás información de tus anuncios), de los comentarios que publiques en el blog, así como del contenido y archivos adjuntos que
          envíes por mensajes o por el chat directo con Soporte de Bestie o Feedback de Bestie. Declaras que cuentas con los
          derechos y autorizaciones necesarios sobre dicho contenido.
        </p>
        <p>
          Al publicar contenido en Bestie, otorgas al Titular una licencia no exclusiva, mundial, libre
          de regalías y por el tiempo que el contenido permanezca en la Plataforma, para alojar,
          reproducir, adaptar el formato y mostrar dicho contenido con el único fin de operar y promover
          el Servicio.
        </p>
        <p>
          Bestie puede moderar, editar, rechazar, ocultar o eliminar contenido que, a su juicio,
          incumpla estos Términos o la ley, sin que ello genere responsabilidad para el Titular.
        </p>
        <p>
          <strong>Borradores asistidos.</strong> Bestie puede crear borradores de anuncios de dos
          formas: (i) como parte de sus actividades de crecimiento, cuando el Titular o su equipo
          captura de forma <strong>manual</strong> (por ejemplo, copiar y pegar texto e imágenes) el
          contenido de una publicación pública de renta compartida en grupos de Facebook u otros
          canales públicos, y genera un borrador interno con un enlace de reclamación para el
          propietario; y (ii) cuando tú pegas el texto o un infográfico de tu propia publicación en el
          flujo de publicar un cuarto o una propiedad. En ambos casos estos borradores{" "}
          <strong>nunca se publican sin tu consentimiento expreso</strong>: revisas el contenido, lo
          editas si lo deseas y, al publicarlo, asumes la plena responsabilidad sobre el anuncio. La
          información del borrador es orientativa y puede estar incompleta o contener errores de
          extracción; eres responsable de verificar, corregir y completar los datos antes de
          publicar. Los borradores del supuesto (i) que no sean reclamados se eliminan
          automáticamente a los <strong>7 días</strong>.
        </p>
        <p>
          <strong>Asistencia con inteligencia artificial.</strong> Cuando Bestie usa un modelo de IA
          para proponer campos de un anuncio o un texto sugerido para compartir, el resultado es solo
          una propuesta. <strong>Ningún anuncio se publica automáticamente</strong>: debes revisar,
          editar si procede y confirmar expresamente la publicación. Al confirmar, declaras que el
          contenido es veraz y asumes la responsabilidad exclusiva frente a terceros por ese
          anuncio, sin que el Titular garantice la exactitud de la propuesta generada por la IA.
        </p>
      </LegalSection>

      <LegalSection id="rol" index={8} title="Rol de Bestie e intermediación">
        <p>
          Bestie es únicamente una plataforma tecnológica que facilita el contacto entre usuarios.{" "}
          <strong>Bestie no es parte de las relaciones de arrendamiento</strong> ni garantiza la
          identidad de los usuarios, la existencia, legalidad, condiciones o calidad de las propiedades,
          ni el cumplimiento de los acuerdos entre las partes.
        </p>
        <LegalList
          items={[
            "En esta etapa, Bestie no verifica en campo cada anuncio ni realiza estudios de crédito o antecedentes de los usuarios.",
            "Los usuarios son responsables de verificar por su cuenta la identidad de su contraparte, las condiciones de la propiedad y de firmar los contratos correspondientes.",
            "Recomendamos no realizar pagos por adelantado sin haber verificado la propiedad y la identidad de la contraparte.",
            "Antes de ver mensajes entre usuarios sobre un anuncio, puedes recibir un aviso de seguridad en la app. Al aceptarlo, reconoces el riesgo de estafas o fraudes entre usuarios y que Bestie y el Titular no son responsables por el uso del chat ni por acuerdos o pagos entre ustedes. Registramos esa aceptación (fecha y versión del aviso) como evidencia de tu consentimiento.",
          ]}
        />
      </LegalSection>

      <LegalSection id="propiedad" index={9} title="Propiedad intelectual y marca">
        <p>
          El software, diseño, interfaces, textos, logotipos y demás elementos del Servicio son
          propiedad del Titular o se usan bajo licencia, y están protegidos por la legislación de
          propiedad intelectual e industrial. No se te otorga ningún derecho sobre ellos salvo el uso
          personal del Servicio conforme a estos Términos.
        </p>
        <p>
          La marca <strong>“Bestie”</strong> se encuentra en trámite de registro ante el IMPI en las
          clases 35, 36 y 42. Queda prohibido usar la marca, el nombre o los signos distintivos de
          Bestie sin autorización previa y por escrito del Titular.
        </p>
      </LegalSection>

      <LegalSection id="terceros" index={10} title="Servicios de terceros">
        <p>
          El Servicio se apoya en proveedores externos, por ejemplo: proveedores de inicio de sesión
          (Google, Facebook/Meta), mapas y teselas de terceros (por ejemplo, OpenStreetMap),
          envío de correos electrónicos, infraestructura de alojamiento,
          analítica de producto (PostHog), medición de anuncios (píxel de Meta / Facebook e Instagram Ads)
          y modelos de inteligencia artificial (Google Gemini) para
          extraer datos de un texto o infográfico que tú proporcionas al crear un anuncio de cuarto o de propiedad, y
          para sugerir textos de compartir de anuncios. El uso de estas funciones puede estar sujeto a los términos
          y políticas de dichos terceros. Bestie no es responsable por los servicios, la disponibilidad
          ni las prácticas de esos terceros.
        </p>
      </LegalSection>

      <LegalSection id="monetizacion" index={11} title="Tarifas y monetización">
        <p>
          Actualmente el uso del Servicio es gratuito tanto para quienes buscan como para quienes
          publican. En el futuro, Bestie podrá introducir funciones de pago (por ejemplo, anuncios
          destacados, planes o servicios premium).
        </p>
        <LegalList
          items={[
            "Cualquier tarifa, condición de pago, facturación o cancelación se comunicará de forma clara y previa a su contratación.",
            "Ninguna función de pago se activará de forma automática sin tu consentimiento expreso.",
            "El Titular emitirá los comprobantes fiscales que correspondan conforme a su régimen fiscal (RESICO).",
          ]}
        />
      </LegalSection>

      <LegalSection id="suspension" index={12} title="Suspensión y terminación">
        <p>
          Podemos suspender o cancelar tu cuenta o el acceso al Servicio, total o parcialmente, si
          incumples estos Términos, la ley, o si tu conducta daña a la comunidad o a la Plataforma.
          También puedes dejar de usar el Servicio y solicitar la eliminación de tu cuenta en cualquier
          momento escribiendo a <LegalMail />.
        </p>
      </LegalSection>

      <LegalSection id="garantias" index={13} title="Descargo de garantías">
        <p>
          El Servicio se proporciona <strong>“tal cual”</strong> y <strong>“según disponibilidad”</strong>,
          sin garantías de ningún tipo, expresas o implícitas, incluyendo sin limitación garantías de
          comerciabilidad, idoneidad para un fin particular, exactitud de los anuncios o disponibilidad
          ininterrumpida. No garantizamos que el Servicio esté libre de errores o interrupciones.
        </p>
      </LegalSection>

      <LegalSection id="responsabilidad" index={14} title="Limitación de responsabilidad">
        <p>
          En la máxima medida permitida por la ley, el Titular no será responsable por daños indirectos,
          incidentales, especiales o consecuentes, ni por lucro cesante, pérdida de datos o daños
          derivados de: (i) tratos, acuerdos o disputas entre usuarios; (ii) la veracidad o legalidad de
          los anuncios; (iii) fraudes cometidos por terceros; o (iv) el uso o imposibilidad de uso del
          Servicio. Nada en estos Términos limita responsabilidades que no puedan excluirse conforme a la
          legislación mexicana aplicable, incluidos los derechos de consumidores.
        </p>
      </LegalSection>

      <LegalSection id="indemnizacion" index={15} title="Indemnización">
        <p>
          Te obligas a sacar en paz y a salvo e indemnizar al Titular frente a cualquier reclamación,
          daño, pérdida o gasto (incluidos honorarios legales razonables) que derive de: (i) tu uso del
          Servicio; (ii) el contenido que publiques; o (iii) tu incumplimiento de estos Términos o de la
          ley.
        </p>
      </LegalSection>

      <LegalSection id="privacidad" index={16} title="Privacidad">
        <p>
          El tratamiento de tus datos personales se rige por nuestro{" "}
          <Link to="/legal/privacidad" className="font-medium text-primary underline-offset-2 hover:underline">
            Aviso de Privacidad
          </Link>
          , que forma parte integral de estos Términos.
        </p>
      </LegalSection>

      <LegalSection id="cambios" index={17} title="Cambios a los términos">
        <p>
          Podemos actualizar estos Términos para reflejar cambios en el Servicio o en la legislación. La
          versión vigente se publicará en esta página con su fecha de actualización. El uso continuado
          del Servicio después de una modificación implica tu aceptación de los Términos actualizados.
        </p>
      </LegalSection>

      <LegalSection id="ley-aplicable" index={18} title="Ley aplicable y jurisdicción">
        <p>
          Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Para la interpretación y
          cumplimiento de los mismos, las partes se someten a la jurisdicción de los tribunales
          competentes de la ciudad de <strong>Guadalajara, Jalisco</strong>, renunciando a cualquier
          otro fuero que pudiera corresponderles. Lo anterior sin perjuicio de los derechos que la Ley
          Federal de Protección al Consumidor y demás normatividad aplicable otorguen a los
          consumidores.
        </p>
      </LegalSection>

      <LegalSection id="contacto" index={19} title="Contacto">
        <p>
          Para dudas sobre estos Términos, escríbenos a <LegalMail /> o visita nuestra página de{" "}
          <Link to="/contacto" className="font-medium text-primary underline-offset-2 hover:underline">
            Contacto
          </Link>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
