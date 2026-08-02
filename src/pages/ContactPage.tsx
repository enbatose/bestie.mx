import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ContactSupportForm } from "@/components/contact/ContactSupportForm";
import { usePageSeo } from "@/hooks/usePageSeo";

export function ContactPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [shouldResume] = useState(() => searchParams.get("resume") === "1");

  usePageSeo({
    title: "Contacto | Bestie MX — roomie Guadalajara",
    description:
      "Contacto Bestie MX — ayuda para buscar roomie en Guadalajara, publicar un cuarto compartido o resolver dudas de tu cuenta.",
    canonicalPath: "/contacto",
  });

  useEffect(() => {
    if (!shouldResume) return;
    if (searchParams.get("resume") !== "1") return;
    const next = new URLSearchParams(searchParams);
    next.delete("resume");
    setSearchParams(next, { replace: true });
  }, [shouldResume, searchParams, setSearchParams]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">Contacto</h1>
      <p className="mt-3 text-sm text-muted">
        ¿Problemas con la búsqueda, un anuncio o tu cuenta? Elige la opción que mejor se ajuste a tu caso.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-semibold text-body">Chat directo con Bestie</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Cuéntanos tu comentario, pregunta sobre el producto o solicitud. Inicia sesión para una
          respuesta personalizada: seguimos la conversación dentro de tu chat de Mensajes en Bestie. Las
          respuestas pueden tardar hasta 48 horas.
        </p>

        <ContactSupportForm
          className="mt-4"
          oauthReturnTo="/contacto?resume=1"
          autoResume={shouldResume}
          onSuccess={(conversationId) => {
            navigate(`/mensajes?c=${encodeURIComponent(conversationId)}`);
          }}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium text-body">Escríbenos por correo</p>
        <p className="mt-1 text-xs text-muted">Para cualquier otra consulta que no necesite chat.</p>
        <a
          href="mailto:contacto@bestie.mx?subject=Bestie%20—%20Contacto"
          className="mt-2 inline-block text-lg font-semibold text-primary underline-offset-2 hover:underline"
        >
          contacto@bestie.mx
        </a>
        <p className="mt-2 text-xs text-muted">
          Asegúrate de que el dominio <span className="font-medium">bestie.mx</span> esté permitido en tu
          bandeja si usas filtros de spam.
        </p>
      </div>

      <p className="mt-8 text-sm text-muted">
        <Link to="/buscar" className="font-semibold text-primary underline-offset-2 hover:underline">
          Volver a buscar
        </Link>
      </p>
    </div>
  );
}
